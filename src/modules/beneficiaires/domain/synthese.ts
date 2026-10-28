/**
 * E1-US2 — Bandeau de synthèse en tête de fiche.
 */
import { calculerAge, type DateISO } from "@/shared/domain/dates";
import { PRISE_EN_CHARGE_LIBELLES, type ModeDeVie, type NiveauPriorite, type StatutCible, type TypeInteraction, type TypePriseEnCharge } from "@/shared/domain/vocabulaire";
import { niveauEffectif } from "./fiche";
import { indisponibiliteEnCours, type PeriodeIndisponibilite } from "./indisponibilites";
import { estActive } from "./planning";

export type EntreeSynthese = {
  dateNaissance: DateISO;
  modeDeVie: ModeDeVie | null;
  score: number;
  niveauPriorite: NiveauPriorite;
  niveauForce: NiveauPriorite | null;
  prises: { type: TypePriseEnCharge; dateDebut: DateISO | null; dateFin: DateISO | null }[];
  indisponibilites: (PeriodeIndisponibilite & { joignabilite: string | null })[];
  interactions: { type: TypeInteraction; survenueLe: Date; resultat: StatutCible | null }[];
  rappels: { objet: string; echeance: DateISO; faitLe: Date | null }[];
  aujourdhui: DateISO;
  maintenant: Date;
};

export type Synthese = {
  age: number;
  vitSeul: boolean;
  niveau: NiveauPriorite;
  niveauForce: boolean;
  score: number;
  prisesActives: string[];
  indisponibilite: (PeriodeIndisponibilite & { joignabilite: string | null }) | null;
  dernierContact: { type: TypeInteraction; date: Date; resultat: StatutCible | null } | null;
  prochainRappel: { objet: string; echeance: DateISO; enRetard: boolean } | null;
};

export function construireSynthese(e: EntreeSynthese): Synthese {
  const dernier = e.interactions
    .filter((i) => i.survenueLe <= e.maintenant)
    .sort((a, b) => b.survenueLe.getTime() - a.survenueLe.getTime())[0];
  const rappel = e.rappels.filter((r) => r.faitLe === null).sort((a, b) => a.echeance.localeCompare(b.echeance))[0];

  return {
    age: calculerAge(e.dateNaissance, e.aujourdhui),
    vitSeul: e.modeDeVie === "seul",
    niveau: niveauEffectif(e.niveauPriorite, e.niveauForce),
    niveauForce: e.niveauForce !== null,
    score: e.score,
    prisesActives: [...new Set(e.prises.filter((p) => estActive(p, e.aujourdhui)).map((p) => PRISE_EN_CHARGE_LIBELLES[p.type]))],
    indisponibilite: indisponibiliteEnCours(e.indisponibilites, e.aujourdhui),
    dernierContact: dernier ? { type: dernier.type, date: dernier.survenueLe, resultat: dernier.resultat } : null,
    prochainRappel: rappel ? { objet: rappel.objet, echeance: rappel.echeance, enRetard: rappel.echeance < e.aujourdhui } : null,
  };
}
