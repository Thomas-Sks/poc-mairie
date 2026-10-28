/**
 * E3-US4 — Saisie rapide d'un appel depuis le tableau : 1 clic pour ouvrir, 1 clic sur le résultat
 * (l'interaction est enregistrée), commentaire facultatif ensuite.
 */
import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import type { ResultatAppelRapide } from "../domain/tableau";
import type { ActionsRepository, RegistreRepository } from "./ports";
import { ErreurMetier } from "./actions-groupees";

export async function saisirAppel(
  deps: { registre: RegistreRepository; actions: ActionsRepository },
  ctx: Contexte,
  entree: { beneficiaireId: string; resultat: ResultatAppelRapide; commentaire?: string },
): Promise<string> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const [id] = await deps.registre.idsDeLaCommune(ctx.commune.id, [entree.beneficiaireId]);
  if (!id) throw new ErreurMetier("Personne introuvable.");
  return deps.actions.enregistrerAppel(ctx.commune.id, {
    beneficiaireId: id,
    auteurId: ctx.utilisateur.id,
    resultat: entree.resultat,
    commentaire: entree.commentaire?.trim() || undefined,
    at: ctx.maintenant,
  });
}

/** Ajoute le commentaire facultatif à l'appel qui vient d'être saisi (par son auteur uniquement). */
export async function commenterAppel(deps: { actions: ActionsRepository }, ctx: Contexte, entree: { interactionId: string; commentaire: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const texte = entree.commentaire.trim();
  if (!texte) throw new ErreurMetier("Le commentaire est vide.");
  const ok = await deps.actions.completerAppel(ctx.commune.id, entree.interactionId, ctx.utilisateur.id, texte);
  if (!ok) throw new ErreurMetier("Appel introuvable.");
}
