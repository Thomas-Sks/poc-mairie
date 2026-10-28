/**
 * E7-US3 — Traitement d'une inscription : valider, rejeter (motif), fusionner avec une fiche existante.
 * « Compléter puis valider » passe par la fiche bénéficiaire (module beneficiaires), puis par `validerInscription`.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import { calculerScore } from "@/shared/domain/priorite";
import { extraireFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import type { InscriptionRepository } from "./ports";

export class InscriptionIntrouvable extends Error {
  constructor() {
    super("Cette inscription n'existe pas ou a déjà été traitée.");
    this.name = "InscriptionIntrouvable";
  }
}

async function enAttente(deps: { inscriptions: InscriptionRepository }, ctx: Contexte, id: string) {
  const inscription = await deps.inscriptions.obtenir(ctx.commune.id, id);
  if (!inscription || inscription.statut !== "en_attente") throw new InscriptionIntrouvable();
  return inscription;
}

export async function validerInscription(deps: { inscriptions: InscriptionRepository }, ctx: Contexte, entree: { id: string }) {
  exiger(ctx.utilisateur.role, "inscriptions.valider");
  await enAttente(deps, ctx, entree.id);
  await deps.inscriptions.valider(ctx.commune.id, entree.id, ctx.utilisateur.id, ctx.maintenant);
}

export async function rejeterInscription(deps: { inscriptions: InscriptionRepository }, ctx: Contexte, entree: { id: string; motif: string }) {
  exiger(ctx.utilisateur.role, "inscriptions.valider");
  await enAttente(deps, ctx, entree.id);
  await deps.inscriptions.rejeter(ctx.commune.id, entree.id, entree.motif.trim(), ctx.utilisateur.id, ctx.maintenant);
}

export async function fusionnerFiche(
  deps: { inscriptions: InscriptionRepository },
  ctx: Contexte,
  entree: { inscriptionId: string; ficheEnAttenteId: string; ficheExistanteId: string },
) {
  exiger(ctx.utilisateur.role, "inscriptions.valider");
  const inscription = await enAttente(deps, ctx, entree.inscriptionId);
  const fiche = inscription.fiches.find((f) => f.id === entree.ficheEnAttenteId && f.statut === "en_attente");
  if (!fiche) throw new InscriptionIntrouvable();
  const comparables = await deps.inscriptions.fichesComparables(ctx.commune.id, inscription.fiches.map((f) => f.id));
  if (!comparables.some((c) => c.id === entree.ficheExistanteId)) throw new Error("La fiche existante est introuvable.");

  await deps.inscriptions.fusionner(ctx.commune.id, entree, ctx.utilisateur.id, ctx.maintenant);

  // RG-01 : le score de la fiche conservée est recalculé avec le cercle et les intervenants rattachés.
  const faits = await deps.inscriptions.entreeFaits(ctx.commune.id, entree.ficheExistanteId);
  if (faits) {
    const grille = await deps.inscriptions.grilleScore(ctx.commune.id);
    const r = calculerScore(extraireFaits({ ...faits, aujourdhui: aujourdhui(ctx.maintenant) }), grille);
    await deps.inscriptions.mettreAJourScore(ctx.commune.id, entree.ficheExistanteId, r.score, r.niveau);
  }
}
