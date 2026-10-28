/**
 * Lecture d'une fiche (E1-US2 synthèse, E13-US3 : données de santé masquées sans la permission `fiches.sante`).
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { calculerScore, type CritereApplique } from "@/shared/domain/priorite";
import { extraireFaits } from "../domain/faits-priorite";
import type { SaisieSante } from "../domain/fiche";
import { construireSynthese, type Synthese } from "../domain/synthese";
import type { CibleActive, DepsBeneficiaires, FicheComplete, Referentiels } from "./ports";

const CRITERES_SANTE = ["Troubles cognitifs", "Mobilité réduite dans le domicile"];

export type DroitsFiche = { ecrire: boolean; archiver: boolean; sante: boolean };

export type FicheVue = Omit<FicheComplete, "sante"> & { sante: SaisieSante | null };

export type ConsultationFiche = {
  fiche: FicheVue;
  synthese: Synthese;
  cibleActive: CibleActive | null;
  droits: DroitsFiche;
  /** Critères RG-01 retenus (explication du score). */
  criteres: CritereApplique[];
};

export function droitsDe(ctx: Contexte): DroitsFiche {
  const role = ctx.utilisateur.role;
  return { ecrire: peut(role, "fiches.ecrire"), archiver: peut(role, "fiches.archiver"), sante: peut(role, "fiches.sante") };
}

export async function consulterFiche(
  deps: Pick<DepsBeneficiaires, "fiches" | "suivi" | "prises">,
  ctx: Contexte,
  entree: { id: string },
): Promise<ConsultationFiche | null> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const communeId = ctx.commune.id;
  const fiche = await deps.fiches.trouver(communeId, entree.id);
  if (!fiche) return null;

  const jour = aujourdhui(ctx.maintenant);
  const [prises, indisponibilites, interactions, rappels, cibleActive, entreeFaits, grille] = await Promise.all([
    deps.prises.lister(communeId, entree.id),
    deps.suivi.indisponibilites(communeId, entree.id),
    deps.suivi.interactions(communeId, entree.id),
    deps.suivi.rappels(communeId, entree.id),
    deps.suivi.cibleActive(communeId, entree.id, jour),
    deps.fiches.entreeFaits(communeId, entree.id),
    deps.fiches.grilleScore(communeId),
  ]);
  const criteres = entreeFaits ? calculerScore(extraireFaits({ ...entreeFaits, aujourdhui: jour }), grille).criteres : [];

  const droits = droitsDe(ctx);
  const synthese = construireSynthese({
    dateNaissance: fiche.beneficiaire.dateNaissance,
    modeDeVie: fiche.beneficiaire.modeDeVie,
    score: fiche.score,
    niveauPriorite: fiche.niveauPriorite,
    niveauForce: fiche.niveauForce,
    prises,
    indisponibilites,
    interactions,
    rappels,
    aujourdhui: jour,
    maintenant: ctx.maintenant,
  });

  return {
    fiche: { ...fiche, sante: droits.sante ? fiche.sante : null },
    synthese,
    cibleActive,
    droits,
    // Sans accès aux données de santé, on n'en révèle rien via l'explication du score.
    criteres: droits.sante ? criteres : criteres.map((c) => (CRITERES_SANTE.includes(c.critere) ? { ...c, critere: "Critère lié à la santé" } : c)),
  };
}

export async function consulterReferentiels(deps: Pick<DepsBeneficiaires, "fiches">, ctx: Contexte): Promise<Referentiels> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.fiches.referentiels(ctx.commune.id);
}

export async function rechercherAdresses(deps: Pick<DepsBeneficiaires, "fiches" | "geocodeur">, ctx: Contexte, entree: { recherche: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  if (entree.recherche.trim().length < 3) return [];
  const { commune } = await deps.fiches.referentiels(ctx.commune.id);
  return deps.geocodeur.rechercher(ctx.commune.id, entree.recherche.trim(), commune.codePostal);
}
