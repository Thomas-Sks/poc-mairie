import "server-only";
import { cache } from "react";
import { and, asc, eq, sql } from "drizzle-orm";
import { sansAccents } from "@/shared/domain/normalisation";
import { db } from "@/shared/infrastructure/db/client";
import * as s from "@/shared/infrastructure/db/schema";
import type { Contexte } from "@/shared/application/contexte";
import type { Notifieur } from "../application/ports";
import { soumettreInscription } from "../application/soumettre-inscription";
import { consulterInscription, listerInscriptions } from "../application/file-validation";
import { fusionnerFiche, rejeterInscription, validerInscription } from "../application/traiter-inscription";
import { communePubliqueDrizzle, inscriptionRepositoryDrizzle } from "./depot-inscriptions";

const notifieurDrizzle: Notifieur = {
  async notifierAdmins(communeId, n) {
    const admins = await db
      .select({ id: s.utilisateurs.id })
      .from(s.utilisateurs)
      .where(and(eq(s.utilisateurs.communeId, communeId), eq(s.utilisateurs.role, "admin"), eq(s.utilisateurs.actif, true)));
    if (admins.length === 0) return;
    await db.insert(s.notifications).values(admins.map((a) => ({ communeId, destinataireId: a.id, type: "inscription" as const, ...n })));
  },
};

const deps = { inscriptions: inscriptionRepositoryDrizzle, notifieur: notifieurDrizzle };

export const communePublique = cache(() => communePubliqueDrizzle.communePublique());

export const casDUsage = {
  soumettreInscription: async (entree: Parameters<typeof soumettreInscription>[2]) =>
    soumettreInscription(deps, { commune: await communePublique(), maintenant: new Date() }, entree),
  listerInscriptions: (ctx: Contexte) => listerInscriptions(deps, ctx),
  consulterInscription: (ctx: Contexte, id: string) => consulterInscription(deps, ctx, id),
  validerInscription: (ctx: Contexte, e: Parameters<typeof validerInscription>[2]) => validerInscription(deps, ctx, e),
  rejeterInscription: (ctx: Contexte, e: Parameters<typeof rejeterInscription>[2]) => rejeterInscription(deps, ctx, e),
  fusionnerFiche: (ctx: Contexte, e: Parameters<typeof fusionnerFiche>[2]) => fusionnerFiche(deps, ctx, e),
};

export type SuggestionAdresse = { libelle: string; banId: string; numero: number | null; rep: string; voie: string; lon: number; lat: number };

/** Repli de l'autocomplétion BAN : table `adresses` de la commune (« 12 rue victor » → 12 Rue Victor Hugo). */
export async function rechercherAdressesLocales(q: string): Promise<SuggestionAdresse[]> {
  const commune = await communePublique();
  const m = q.trim().match(/^(\d+)\s*(bis|ter)?\s*,?\s*(.*)$/i);
  const numero = m ? Number(m[1]) : null;
  const texte = (m ? m[3] : q).trim();
  if (texte.length < 3) return [];
  const mots = sansAccents(texte.toLowerCase()).replace(/['’-]/g, " ").replace(/[%_\\]/g, "").split(/\s+/).filter(Boolean);
  const motif = `%${mots.join("%")}%`;
  const lignes = await db
    .select()
    .from(s.adresses)
    .where(
      and(
        eq(s.adresses.communeId, commune.id),
        sql`translate(lower(${s.adresses.voie}), 'àâäéèêëîïôöùûüÿç''-', 'aaaeeeeiioouuuyc  ') like ${motif}`,
        numero !== null ? eq(s.adresses.numero, numero) : undefined,
      ),
    )
    .orderBy(asc(s.adresses.voie), asc(s.adresses.numero))
    .limit(5);
  return lignes.map((a) => ({
    libelle: `${a.numero}${a.rep ? ` ${a.rep}` : ""} ${a.voie}, ${commune.codePostal} ${commune.nom}`,
    banId: a.id,
    numero: a.numero,
    rep: a.rep ?? "",
    voie: a.voie,
    lon: a.lon,
    lat: a.lat,
  }));
}
