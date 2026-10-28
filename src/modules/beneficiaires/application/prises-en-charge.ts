/**
 * E6-US1 / E6-US2 — Prises en charge et planning récurrent de passages (avec exceptions).
 * Les prises en charge influencent le score (personne « invisible », clés) : recalcul à chaque changement.
 */
import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import { ErreurMetier, FicheIntrouvable } from "./erreurs";
import type { DepsBeneficiaires, DonneesCreneau, DonneesPriseEnCharge } from "./ports";
import { recalculerScoreHistorise } from "./score";

type Deps = Pick<DepsBeneficiaires, "fiches" | "prises" | "cercle">;

export async function listerPrisesEnCharge(deps: Pick<DepsBeneficiaires, "prises">, ctx: Contexte, e: { beneficiaireId: string }) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.prises.lister(ctx.commune.id, e.beneficiaireId);
}

async function verifierPrise(deps: Deps, ctx: Contexte, beneficiaireId: string, d: DonneesPriseEnCharge) {
  if (!d.intervenantNom?.trim() && !d.structureId) {
    throw new ErreurMetier("Indiquez l'organisme ou l'intervenant.", { intervenantNom: "Indiquez l'organisme ou le nom de l'intervenant." });
  }
  if (d.dateDebut && d.dateFin && d.dateFin < d.dateDebut) {
    throw new ErreurMetier("La date de fin doit suivre la date de début.", { dateFin: "La date de fin doit suivre la date de début." });
  }
  if (d.contactId) {
    const liens = await deps.cercle.liens(ctx.commune.id, beneficiaireId);
    if (!liens.some((l) => l.contactId === d.contactId)) throw new ErreurMetier("Le contact référent doit faire partie du cercle.");
  }
  if (d.structureId) {
    const { structures } = await deps.fiches.referentiels(ctx.commune.id);
    if (!structures.some((s) => s.id === d.structureId)) throw new ErreurMetier("Cette structure est introuvable.");
  }
}

async function beneficiaireDe(deps: Deps, ctx: Contexte, ref: { priseEnChargeId?: string; creneauId?: string }) {
  const id = await deps.prises.beneficiaireDe(ctx.commune.id, ref);
  if (!id) throw new ErreurMetier("Cette prise en charge est introuvable.");
  return id;
}

export async function ajouterPriseEnCharge(deps: Deps, ctx: Contexte, e: { beneficiaireId: string; donnees: DonneesPriseEnCharge }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  if (!(await deps.fiches.trouver(ctx.commune.id, e.beneficiaireId))) throw new FicheIntrouvable();
  await verifierPrise(deps, ctx, e.beneficiaireId, e.donnees);
  const id = await deps.prises.ajouter(e.beneficiaireId, e.donnees);
  await recalculerScoreHistorise(deps, ctx, e.beneficiaireId);
  return id;
}

export async function modifierPriseEnCharge(deps: Deps, ctx: Contexte, e: { priseEnChargeId: string; donnees: DonneesPriseEnCharge }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const beneficiaireId = await beneficiaireDe(deps, ctx, { priseEnChargeId: e.priseEnChargeId });
  await verifierPrise(deps, ctx, beneficiaireId, e.donnees);
  await deps.prises.modifier(e.priseEnChargeId, e.donnees);
  await recalculerScoreHistorise(deps, ctx, beneficiaireId);
  return beneficiaireId;
}

export async function retirerPriseEnCharge(deps: Deps, ctx: Contexte, e: { priseEnChargeId: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const beneficiaireId = await beneficiaireDe(deps, ctx, { priseEnChargeId: e.priseEnChargeId });
  await deps.prises.retirer(e.priseEnChargeId);
  await recalculerScoreHistorise(deps, ctx, beneficiaireId);
  return beneficiaireId;
}

function verifierCreneau(c: DonneesCreneau) {
  if (!c.joursSemaine.length) throw new ErreurMetier("Choisissez au moins un jour.", { joursSemaine: "Choisissez au moins un jour." });
  if (c.heureFin <= c.heureDebut) throw new ErreurMetier("L'heure de fin doit suivre l'heure de début.", { heureFin: "L'heure de fin doit suivre l'heure de début." });
}

/** Normalise un créneau : jours uniques triés, exceptions uniques triées. */
function normaliser(c: DonneesCreneau): DonneesCreneau {
  return { ...c, joursSemaine: [...new Set(c.joursSemaine)].sort(), exceptions: [...new Set(c.exceptions)].sort() };
}

export async function enregistrerCreneau(
  deps: Deps,
  ctx: Contexte,
  e: { priseEnChargeId: string; creneauId: string | null; creneau: DonneesCreneau },
) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  verifierCreneau(e.creneau);
  const beneficiaireId = await beneficiaireDe(deps, ctx, { priseEnChargeId: e.priseEnChargeId });
  if (e.creneauId) {
    if ((await beneficiaireDe(deps, ctx, { creneauId: e.creneauId })) !== beneficiaireId) throw new ErreurMetier("Créneau introuvable.");
    await deps.prises.modifierCreneau(e.creneauId, normaliser(e.creneau));
  } else {
    await deps.prises.ajouterCreneau(e.priseEnChargeId, normaliser(e.creneau));
  }
  return beneficiaireId;
}

export async function retirerCreneau(deps: Deps, ctx: Contexte, e: { creneauId: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const beneficiaireId = await beneficiaireDe(deps, ctx, { creneauId: e.creneauId });
  await deps.prises.retirerCreneau(e.creneauId);
  return beneficiaireId;
}
