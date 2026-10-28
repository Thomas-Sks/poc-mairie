/**
 * E5 — Indisponibilités : déclaration (avec rappel « Vérifier le retour », E5-US3),
 * retour anticipé, et bonus « retour d'hospitalisation » au score (E5-US5).
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui, type DateISO } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import type { TypeIndisponibilite } from "@/shared/domain/vocabulaire";
import { nomComplet } from "../domain/fiche";
import { rappelDeRetour, verifierPeriode } from "../domain/indisponibilites";
import { ErreurMetier, FicheIntrouvable } from "./erreurs";
import type { DepsBeneficiaires } from "./ports";
import { recalculerScoreHistorise } from "./score";

export async function listerIndisponibilites(deps: Pick<DepsBeneficiaires, "suivi">, ctx: Contexte, e: { beneficiaireId: string }) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.suivi.indisponibilites(ctx.commune.id, e.beneficiaireId);
}

export async function declarerIndisponibilite(
  deps: Pick<DepsBeneficiaires, "fiches" | "suivi">,
  ctx: Contexte,
  e: { beneficiaireId: string; type: TypeIndisponibilite; debut: DateISO; fin: DateISO | null; joignabilite: string | null; source: string | null },
): Promise<{ id: string; rappelLe: DateISO | null }> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const fiche = await deps.fiches.trouver(ctx.commune.id, e.beneficiaireId);
  if (!fiche) throw new FicheIntrouvable();
  if (verifierPeriode(e) === "fin_avant_debut") {
    throw new ErreurMetier("La date de fin doit suivre la date de début.", { fin: "La date de fin doit suivre la date de début." });
  }
  const rappel = rappelDeRetour(e, nomComplet(fiche.beneficiaire));
  const id = await deps.suivi.ajouterIndisponibilite(
    ctx.commune.id,
    { ...e, creePar: ctx.utilisateur.id },
    rappel
      ? { beneficiaireId: e.beneficiaireId, type: "retour_absence", objet: rappel.objet, echeance: rappel.echeance, assigneA: ctx.utilisateur.id, creePar: ctx.utilisateur.id, urgent: false }
      : null,
  );
  // E5-US5 : le retour d'hospitalisation donne un bonus de priorité pendant 30 jours.
  if (e.type === "hospitalisation" && e.fin) {
    await deps.fiches.definirRetourHospitalisation(ctx.commune.id, e.beneficiaireId, e.fin);
    await recalculerScoreHistorise(deps, ctx, e.beneficiaireId);
  }
  return { id, rappelLe: rappel?.echeance ?? null };
}

/** « Signaler le retour » : l'indisponibilité se termine aujourd'hui. */
export async function signalerRetour(deps: Pick<DepsBeneficiaires, "fiches" | "suivi">, ctx: Contexte, e: { indisponibiliteId: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const jour = aujourdhui(ctx.maintenant);
  const indispo = await deps.suivi.terminerIndisponibilite(ctx.commune.id, e.indisponibiliteId, jour);
  if (indispo.type === "hospitalisation") {
    await deps.fiches.definirRetourHospitalisation(ctx.commune.id, indispo.beneficiaireId, jour);
    await recalculerScoreHistorise(deps, ctx, indispo.beneficiaireId);
  }
  return indispo.beneficiaireId;
}
