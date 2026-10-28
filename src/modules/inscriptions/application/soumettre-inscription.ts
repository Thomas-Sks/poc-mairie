/**
 * E7-US1 à E7-US4 — Soumission du formulaire public : aucune authentification (formulaire ouvert),
 * validation complète, création des fiches « en attente », accusé de réception et notification des admins.
 */
import { aujourdhui } from "@/shared/domain/dates";
import { validerFormulaire, type Erreurs } from "../domain/etapes";
import { destinataireAccuse, transformerInscription, type AccuseReception } from "../domain/transformation";
import type { ContextePublic, InscriptionRepository, Notifieur } from "./ports";

export type ResultatSoumission =
  | { ok: true; reference: string; accuse: AccuseReception | null }
  | { ok: false; erreurs: Erreurs };

export async function soumettreInscription(
  deps: { inscriptions: InscriptionRepository; notifieur: Notifieur },
  ctx: ContextePublic,
  entree: { reponses: unknown; potDeMiel: string },
): Promise<ResultatSoumission> {
  // E7-US6 : un robot remplit le champ caché. On répond « reçu » sans rien enregistrer.
  if (entree.potDeMiel.trim() !== "") return { ok: true, reference: "REG-0000", accuse: null };

  const validation = validerFormulaire(entree.reponses);
  if (!validation.ok) return validation;
  const formulaire = validation.formulaire;

  const donnees = transformerInscription(formulaire, {
    aujourdhui: aujourdhui(ctx.maintenant),
    commune: { nom: ctx.commune.nom, codePostal: ctx.commune.codePostal },
    grille: ctx.commune.grilleScore,
  });
  const { id } = await deps.inscriptions.enregistrer(ctx.commune.id, formulaire as unknown as Record<string, unknown>, donnees, ctx.maintenant);

  const noms = donnees.fiches.map((f) => `${f.civilite} ${f.prenom} ${f.nom}`).join(" et ");
  await deps.notifieur.notifierAdmins(ctx.commune.id, {
    titre: `Nouvelle inscription à valider : ${noms}`,
    message: formulaire.remplisseur === "tiers" ? "Inscription en ligne remplie par un proche." : "Inscription en ligne remplie par la personne elle-même.",
    lien: `/inscriptions/${id}`,
  });

  return { ok: true, reference: referenceInscription(id), accuse: destinataireAccuse(formulaire) };
}

/** Référence lisible communiquée au demandeur (« REG-3F9A2C »). */
export const referenceInscription = (id: string) => `REG-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
