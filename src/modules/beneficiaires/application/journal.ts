/**
 * E3 — Journal d'interactions (saisie, timeline), E4-US2 — rappels manuels, E11 — détail d'un appel IA.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui, type DateISO } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import type { Besoin, StatutCible, TypeInteraction } from "@/shared/domain/vocabulaire";
import { rappelDeSuivi } from "../domain/journal";
import { ErreurMetier, FicheIntrouvable } from "./erreurs";
import type { DepsBeneficiaires } from "./ports";

export type EntreeInteraction = {
  beneficiaireId: string;
  type: TypeInteraction;
  survenueLe: Date;
  dureeMinutes: number | null;
  interlocuteurContactId: string | null;
  resultat: StatutCible | null;
  compteRendu: string | null;
  besoins: Besoin[];
  actionSuivi: string | null;
  echeanceSuivi: DateISO | null;
  assigneSuivi: string | null;
};

export async function enregistrerInteraction(
  deps: Pick<DepsBeneficiaires, "fiches" | "suivi" | "cercle">,
  ctx: Contexte,
  e: EntreeInteraction,
): Promise<{ id: string; rappelCree: boolean }> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const fiche = await deps.fiches.trouver(ctx.commune.id, e.beneficiaireId);
  if (!fiche) throw new FicheIntrouvable();
  if (e.survenueLe.getTime() > ctx.maintenant.getTime() + 5 * 60_000) {
    throw new ErreurMetier("L'interaction ne peut pas être dans le futur.", { survenueLe: "Choisissez une date passée." });
  }
  if (e.interlocuteurContactId) {
    const cercle = await deps.cercle.liens(ctx.commune.id, e.beneficiaireId);
    if (!cercle.some((l) => l.contactId === e.interlocuteurContactId)) throw new ErreurMetier("Cet interlocuteur ne fait pas partie du cercle.");
  }
  await verifierMembreEquipe(deps, ctx, e.assigneSuivi);

  const rappel = rappelDeSuivi(
    { actionSuivi: e.actionSuivi, echeance: e.echeanceSuivi, assigneA: e.assigneSuivi },
    { auteurId: ctx.utilisateur.id, aujourdhui: aujourdhui(ctx.maintenant) },
  );
  const id = await deps.suivi.ajouterInteraction(
    ctx.commune.id,
    {
      beneficiaireId: e.beneficiaireId,
      type: e.type,
      survenueLe: e.survenueLe,
      dureeMinutes: e.dureeMinutes,
      auteurId: ctx.utilisateur.id,
      interlocuteurContactId: e.interlocuteurContactId,
      resultat: e.resultat,
      compteRendu: e.compteRendu,
      besoins: e.besoins,
      actionSuivi: e.actionSuivi?.trim() || null,
    },
    rappel ? { beneficiaireId: e.beneficiaireId, type: "suivi", objet: rappel.objet, echeance: rappel.echeance, assigneA: rappel.assigneA, creePar: ctx.utilisateur.id, urgent: false } : null,
  );
  return { id, rappelCree: rappel !== null };
}

async function verifierMembreEquipe(deps: Pick<DepsBeneficiaires, "fiches">, ctx: Contexte, utilisateurId: string | null) {
  if (!utilisateurId) return;
  const { equipe } = await deps.fiches.referentiels(ctx.commune.id);
  if (!equipe.some((u) => u.id === utilisateurId)) throw new ErreurMetier("Ce collègue est introuvable.");
}

export async function creerRappel(
  deps: Pick<DepsBeneficiaires, "fiches" | "suivi">,
  ctx: Contexte,
  e: { beneficiaireId: string; objet: string; echeance: DateISO; assigneA: string | null; urgent: boolean },
) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const fiche = await deps.fiches.trouver(ctx.commune.id, e.beneficiaireId);
  if (!fiche) throw new FicheIntrouvable();
  if (!e.objet.trim()) throw new ErreurMetier("Indiquez l'objet du rappel.", { objet: "Indiquez l'objet du rappel." });
  await verifierMembreEquipe(deps, ctx, e.assigneA);
  return deps.suivi.ajouterRappel(ctx.commune.id, {
    beneficiaireId: e.beneficiaireId,
    type: "manuel",
    objet: e.objet.trim(),
    echeance: e.echeance,
    assigneA: e.assigneA ?? ctx.utilisateur.id,
    creePar: ctx.utilisateur.id,
    urgent: e.urgent,
  });
}

export async function marquerRappelFait(deps: Pick<DepsBeneficiaires, "suivi">, ctx: Contexte, e: { rappelId: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  await deps.suivi.marquerRappelFait(ctx.commune.id, e.rappelId, ctx.maintenant);
}

export async function consulterJournal(deps: Pick<DepsBeneficiaires, "suivi">, ctx: Contexte, e: { beneficiaireId: string }) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const [interactions, modifications, rappels, notes] = await Promise.all([
    deps.suivi.interactions(ctx.commune.id, e.beneficiaireId),
    deps.suivi.modifications(ctx.commune.id, e.beneficiaireId),
    deps.suivi.rappels(ctx.commune.id, e.beneficiaireId),
    deps.suivi.notes(ctx.commune.id, e.beneficiaireId),
  ]);
  return { interactions, modifications, rappels, notes };
}

export async function consulterAppelIa(deps: Pick<DepsBeneficiaires, "suivi">, ctx: Contexte, e: { beneficiaireId: string; interactionId: string }) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.suivi.appelIa(ctx.commune.id, e.beneficiaireId, e.interactionId);
}
