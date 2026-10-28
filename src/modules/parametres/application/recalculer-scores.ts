import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import { calculerScore } from "@/shared/domain/priorite";
import { extraireFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import { niveauRetenu } from "../domain/parametres";
import type { ParametresRepository } from "./ports";

export type BilanRecalcul = { fiches: number; scoresModifies: number; niveauxModifies: number };

/**
 * RG-01 / E13-US6 : recalcule le score et le niveau de toutes les fiches actives avec la grille de la commune.
 * Un niveau forcé manuellement reste prioritaire.
 */
export async function recalculerScores(deps: { parametres: ParametresRepository }, ctx: Contexte): Promise<BilanRecalcul> {
  exiger(ctx.utilisateur.role, "parametres.gerer");
  const jour = aujourdhui(ctx.maintenant);
  const [{ grilleScore }, fiches] = await Promise.all([
    deps.parametres.lire(ctx.commune.id),
    deps.parametres.fichesActivesPourScore(ctx.commune.id),
  ]);

  let niveauxModifies = 0;
  const changements = fiches.flatMap((f) => {
    const r = calculerScore(extraireFaits({ ...f.faits, aujourdhui: jour }), grilleScore);
    const niveau = niveauRetenu(r.niveau, f.niveauForce);
    if (r.score === f.score && niveau === f.niveauPriorite) return [];
    if (niveau !== f.niveauPriorite) niveauxModifies += 1;
    return [{ id: f.id, score: r.score, niveauPriorite: niveau }];
  });

  await deps.parametres.enregistrerScores(ctx.commune.id, changements);
  return { fiches: fiches.length, scoresModifies: changements.length, niveauxModifies };
}
