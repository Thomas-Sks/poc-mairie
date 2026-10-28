/**
 * Génération de la vague du jour d'une campagne (E9-US2, E9-US4, RG-02, RG-05, E5-US2, E6-US3).
 * Fonctions pures : la base est lue et écrite par l'infrastructure.
 */
import { comparerOrdreAppel, evaluerExclusion, passagesCouvrent, type FaitsExclusion } from "@/shared/domain/campagne";
import { ecartEnJours, type DateISO } from "@/shared/domain/dates";
import type { Canal, Couverture, Frequence, NiveauPriorite, StatutCible, TypeCampagne } from "@/shared/domain/vocabulaire";
import { attribuerMaquetteIa, type MaquetteIa } from "./maquette-ia";

export type BeneficiaireVague = {
  id: string;
  niveau: NiveauPriorite;
  score: number;
  consentementIa: boolean;
  iaActivee: boolean;
  /** Non joint lors de la vague précédente (RG-02, critère de départage). */
  nonJointVeille: boolean;
  faits: FaitsExclusion;
};

export type CibleGeneree = {
  beneficiaireId: string;
  /** Rang d'appel (RG-02), 1 = premier à appeler. */
  rang: number;
  canal: "humain" | "ia";
  statut: StatutCible;
  exclue: boolean;
  motifExclusion: string | null;
  couverture: Couverture | null;
  maquetteIa: MaquetteIa | null;
};

/** Ordre RG-02 : P1 → P3, score décroissant, non joints la veille d'abord. */
export function trierOrdreAppel<T extends { niveau: NiveauPriorite; score: number; nonJointVeille: boolean }>(liste: T[]): T[] {
  return [...liste].sort(comparerOrdreAppel);
}

/** E11-US1 : jamais d'IA sans consentement explicite ; l'IA n'appelle pas les P1. */
export const eligibleIa = (b: Pick<BeneficiaireVague, "consentementIa" | "iaActivee" | "niveau">) =>
  b.consentementIa && b.iaActivee && b.niveau !== "P1";

/**
 * Construit la vague du jour : exclusions automatiques RG-05 (motif conservé), tri RG-02,
 * et, pour une campagne mixte ou IA, attribution déterministe des cibles IA fictives (maquette E11).
 */
export function genererVague(
  beneficiaires: BeneficiaireVague[],
  jour: DateISO,
  canalCampagne: Canal,
  typeCampagne: TypeCampagne = "canicule",
): CibleGeneree[] {
  const options = { passagesCouvrent: passagesCouvrent(typeCampagne) };
  const tries = trierOrdreAppel(beneficiaires);
  const incluses = tries.filter((b) => !evaluerExclusion(b.faits, jour, options));
  const idsIa = new Set(
    canalCampagne === "humain"
      ? []
      : incluses
          .filter(eligibleIa)
          // Mixte : l'IA prend une cible éligible sur deux ; IA seule : toutes les éligibles.
          .filter((_, i) => canalCampagne === "ia" || i % 2 === 0)
          .map((b) => b.id),
  );
  const maquettes = attribuerMaquetteIa([...idsIa]);

  return tries.map((b, i) => {
    const exclusion = evaluerExclusion(b.faits, jour, options);
    if (exclusion) {
      return {
        beneficiaireId: b.id,
        rang: i + 1,
        canal: "humain",
        statut: exclusion.statut,
        exclue: true,
        motifExclusion: exclusion.motif,
        couverture: exclusion.couverture,
        maquetteIa: null,
      };
    }
    const maquette = maquettes.get(b.id) ?? null;
    return {
      beneficiaireId: b.id,
      rang: i + 1,
      canal: maquette ? "ia" : "humain",
      statut: maquette?.statut ?? "a_appeler",
      exclue: false,
      motifExclusion: null,
      couverture: maquette && maquette.statut.startsWith("joint") ? "appel" : null,
      maquetteIa: maquette,
    };
  });
}

/** E9-US3 / E9-US4 : une vague est-elle due ce jour-là ? */
export function vagueDueLe(
  campagne: { frequence: Frequence; frequenceJours: number | null; dateDebut: DateISO; dateFin: DateISO | null; statut: "active" | "cloturee" },
  jour: DateISO,
): boolean {
  if (campagne.statut !== "active") return false;
  if (jour < campagne.dateDebut) return false;
  if (campagne.dateFin && jour > campagne.dateFin) return false;
  const ecart = ecartEnJours(campagne.dateDebut, jour);
  switch (campagne.frequence) {
    case "unique":
      return ecart === 0;
    case "quotidienne":
      return true;
    case "tous_n_jours":
      return ecart % Math.max(1, campagne.frequenceJours ?? 1) === 0;
  }
}

/** Statuts qui signifient « pas joint » dans une vague (pour le critère « non joint la veille »). */
export const STATUTS_NON_JOINT: ReadonlySet<StatutCible> = new Set([
  "a_appeler",
  "non_joint",
  "messagerie",
  "numero_invalide",
  "non_joint_a_traiter",
  "escalade_humain",
]);
