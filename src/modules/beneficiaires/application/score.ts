/**
 * RG-01 — Recalcul du score de priorité après toute modification qui l'influence
 * (fiche, cercle, prises en charge, retour d'hospitalisation). Le changement est historisé.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { calculerScore, type ResultatScore } from "@/shared/domain/priorite";
import { extraireFaits } from "../domain/faits-priorite";
import type { FicheRepository } from "./ports";

export async function recalculerScore(
  deps: { fiches: FicheRepository },
  ctx: Contexte,
  beneficiaireId: string,
  avant?: { score: number; niveauPriorite: string },
): Promise<ResultatScore | null> {
  const entree = await deps.fiches.entreeFaits(ctx.commune.id, beneficiaireId);
  if (!entree) return null;
  const grille = await deps.fiches.grilleScore(ctx.commune.id);
  const resultat = calculerScore(extraireFaits({ ...entree, aujourdhui: aujourdhui(ctx.maintenant) }), grille);
  await deps.fiches.enregistrerScore(ctx.commune.id, beneficiaireId, resultat.score, resultat.niveau);

  if (avant && (avant.score !== resultat.score || avant.niveauPriorite !== resultat.niveau)) {
    await deps.fiches.historiser(
      beneficiaireId,
      [
        {
          champ: "Score de priorité",
          ancienneValeur: `${avant.niveauPriorite} · ${avant.score}`,
          nouvelleValeur: `${resultat.niveau} · ${resultat.score}`,
        },
      ],
      ctx.utilisateur.id,
    );
  }
  return resultat;
}

/** Recalcule en historisant la variation par rapport au score actuel de la fiche. */
export async function recalculerScoreHistorise(deps: { fiches: FicheRepository }, ctx: Contexte, beneficiaireId: string) {
  const fiche = await deps.fiches.trouver(ctx.commune.id, beneficiaireId);
  if (!fiche) return null;
  return recalculerScore(deps, ctx, beneficiaireId, { score: fiche.score, niveauPriorite: fiche.niveauPriorite });
}
