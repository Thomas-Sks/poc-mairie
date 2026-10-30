import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { campagnes, interactions, utilisateurs } from "@/shared/infrastructure/db/schema";

export type NoteAlerte = { auteur: string; at: Date; texte: string };

/**
 * « Fiche canicule » : comptes rendus de toutes les campagnes de la même alerte (ou de la campagne seule
 * si elle n'est rattachée à aucune alerte). Les échanges de l'année, hors alerte, ne sont jamais lus.
 */
export async function notesDeLAlerte(communeId: string, beneficiaireId: string, alerteId: string | null, campagneId: string): Promise<NoteAlerte[]> {
  const campagnesAlerte = alerteId
    ? db.select({ id: campagnes.id }).from(campagnes).where(and(eq(campagnes.communeId, communeId), eq(campagnes.alerteId, alerteId)))
    : db.select({ id: campagnes.id }).from(campagnes).where(eq(campagnes.id, campagneId));
  const lignes = await db
    .select({ prenom: utilisateurs.prenom, at: interactions.survenueLe, texte: interactions.compteRendu })
    .from(interactions)
    .leftJoin(utilisateurs, eq(utilisateurs.id, interactions.auteurId))
    .where(
      and(
        eq(interactions.communeId, communeId),
        eq(interactions.beneficiaireId, beneficiaireId),
        inArray(interactions.campagneId, campagnesAlerte),
        isNotNull(interactions.compteRendu),
      ),
    )
    .orderBy(desc(interactions.survenueLe))
    .limit(20);
  return lignes.map((l) => ({ auteur: l.prenom ?? "Agent IA", at: l.at, texte: l.texte! }));
}
