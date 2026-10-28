import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "./db/client";
import { communes, utilisateurs } from "./db/schema";
import type { Contexte } from "@/shared/application/contexte";
import { exiger, type Permission } from "@/shared/domain/permissions";

/**
 * POC : pas d'authentification réelle. L'utilisateur courant est choisi via le sélecteur
 * en haut d'écran et stocké en cookie (§10.2). Les droits sont appliqués côté serveur.
 */
export const COOKIE_UTILISATEUR = "poc_utilisateur";

export const obtenirContexte = cache(async (): Promise<Contexte> => {
  const jar = await cookies();
  const idCookie = jar.get(COOKIE_UTILISATEUR)?.value;

  const candidat = idCookie
    ? await db.query.utilisateurs.findFirst({ where: eq(utilisateurs.id, idCookie) })
    : undefined;
  const utilisateur =
    candidat ??
    (await db.query.utilisateurs.findFirst({
      where: eq(utilisateurs.role, "admin"),
      orderBy: asc(utilisateurs.createdAt),
    }));
  if (!utilisateur?.communeId) throw new Error("Aucun utilisateur : lancez `pnpm db:seed`.");

  const commune = await db.query.communes.findFirst({ where: eq(communes.id, utilisateur.communeId) });
  if (!commune) throw new Error("Commune introuvable.");

  return {
    utilisateur: {
      id: utilisateur.id,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      role: utilisateur.role,
      communeId: utilisateur.communeId,
    },
    commune: {
      id: commune.id,
      nom: commune.nom,
      structureNom: commune.structureNom,
      structureTelephone: commune.structureTelephone,
    },
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
