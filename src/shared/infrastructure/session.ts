import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { communes, utilisateurs } from "./db/schema";
import type { Contexte } from "@/shared/application/contexte";
import { exiger, type Permission } from "@/shared/domain/permissions";

/**
 * POC : pas d'authentification réelle. L'utilisateur courant est choisi via le sélecteur
 * en haut d'écran et stocké en cookie (§10.2). Les droits sont appliqués côté serveur.
 */
export const COOKIE_UTILISATEUR = "poc_utilisateur";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const colonnesContexte = {
  utilisateur: {
    id: utilisateurs.id,
    prenom: utilisateurs.prenom,
    nom: utilisateurs.nom,
    role: utilisateurs.role,
    communeId: utilisateurs.communeId,
  },
  commune: {
    id: communes.id,
    nom: communes.nom,
    structureNom: communes.structureNom,
    structureTelephone: communes.structureTelephone,
  },
};

/** Utilisateur et commune en une seule requête (appelée à chaque page et à chaque rafraîchissement). */
async function chargerUtilisateur(condition: SQL) {
  const [ligne] = await db
    .select(colonnesContexte)
    .from(utilisateurs)
    .innerJoin(communes, eq(communes.id, utilisateurs.communeId))
    .where(condition)
    .orderBy(asc(utilisateurs.createdAt))
    .limit(1);
  return ligne;
}

export const obtenirContexte = cache(async (): Promise<Contexte> => {
  const jar = await cookies();
  const idCookie = jar.get(COOKIE_UTILISATEUR)?.value;

  const candidat = idCookie && UUID.test(idCookie) ? await chargerUtilisateur(eq(utilisateurs.id, idCookie)) : undefined;
  const trouve = candidat ?? (await chargerUtilisateur(eq(utilisateurs.role, "admin")));
  if (!trouve) throw new Error("Aucun utilisateur : lancez `pnpm db:seed`.");
  const { utilisateur, commune } = trouve;

  return {
    utilisateur: { ...utilisateur, communeId: commune.id },
    commune,
    maintenant: new Date(),
  };
});

/** Pour les pages : renvoie le contexte, ou redirige l'utilisateur vers son accueil s'il n'a pas le droit. */
export async function contexteAvec(permission: Permission): Promise<Contexte> {
  const ctx = await obtenirContexte();
  try {
    exiger(ctx.utilisateur.role, permission);
  } catch {
    redirect(ctx.utilisateur.role === "benevole" ? "/benevole" : "/");
  }
  return ctx;
}
