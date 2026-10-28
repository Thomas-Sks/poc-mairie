/**
 * E6 — Prises en charge et planning récurrent de passages (avec exceptions), échéances (E6-US7).
 */
import { ajouterJours, ecartEnJours, jourDeSemaine, type DateISO } from "@/shared/domain/dates";
import type { TypePriseEnCharge } from "@/shared/domain/vocabulaire";

export type Creneau = {
  joursSemaine: number[]; // 1 = lundi … 7 = dimanche
  heureDebut: string; // "08:30"
  heureFin: string;
  exceptions: DateISO[];
};

export type PeriodePriseEnCharge = { dateDebut: DateISO | null; dateFin: DateISO | null };

const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
export const JOURS_LONGS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Types de prise en charge qui donnent lieu à des passages au domicile (planning utile à l'anti-doublon). */
export const PRISES_AVEC_PASSAGES: TypePriseEnCharge[] = ["aide_domicile", "portage_repas", "soins_infirmiers", "ssiad", "kine"];

/** « Tous les jours », « Du lundi au vendredi », « Lun, mer, ven ». */
export function formaterJours(jours: number[]): string {
  const tries = [...new Set(jours)].sort((a, b) => a - b);
  if (tries.length === 7) return "Tous les jours";
  if (tries.join() === "1,2,3,4,5") return "Du lundi au vendredi";
  if (tries.length === 0) return "Aucun jour";
  const texte = tries.map((j) => JOURS_COURTS[j - 1]).join(", ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** « 08:30 » → « 8h30 », « 12:00 » → « 12h ». */
export function formaterHeureCourte(heure: string): string {
  const [h, m] = heure.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

export function formaterCreneau(c: Pick<Creneau, "joursSemaine" | "heureDebut" | "heureFin">): string {
  return `${formaterJours(c.joursSemaine)}, ${formaterHeureCourte(c.heureDebut)} – ${formaterHeureCourte(c.heureFin)}`;
}

export function estActive(p: PeriodePriseEnCharge, date: DateISO): boolean {
  return (p.dateDebut === null || p.dateDebut <= date) && (p.dateFin === null || p.dateFin >= date);
}

/** Passage prévu ce jour-là (jour de semaine prévu et pas d'exception). */
export function passagePrevu(c: Creneau, date: DateISO): boolean {
  return c.joursSemaine.includes(jourDeSemaine(date)) && !c.exceptions.includes(date);
}

/** E6-US7 : nombre de jours avant la fin d'une prise en charge, si elle se termine dans le délai d'alerte. */
export function joursAvantEcheance(p: PeriodePriseEnCharge, date: DateISO, delaiAlerte = 30): number | null {
  if (p.dateFin === null || p.dateFin < date) return null;
  const jours = ecartEnJours(date, p.dateFin);
  return jours <= delaiAlerte ? jours : null;
}

export function lundiDeLaSemaine(date: DateISO): DateISO {
  return ajouterJours(date, 1 - jourDeSemaine(date));
}

export type PassageSemaine<T> = { prise: T; heureDebut: string; heureFin: string; annule: boolean };
export type JourPlanning<T> = { date: DateISO; jour: string; passages: PassageSemaine<T>[] };

/**
 * Planning de la semaine contenant `date` : pour chaque jour, les passages prévus (triés par heure).
 * Un passage tombant sur une exception est conservé mais marqué « annulé ».
 */
export function planningSemaine<T extends PeriodePriseEnCharge & { creneaux: Creneau[] }>(prises: T[], date: DateISO): JourPlanning<T>[] {
  const lundi = lundiDeLaSemaine(date);
  return JOURS_LONGS.map((jour, i) => {
    const jourDate = ajouterJours(lundi, i);
    const passages = prises
      .filter((p) => estActive(p, jourDate))
      .flatMap((prise) =>
        prise.creneaux
          .filter((c) => c.joursSemaine.includes(i + 1))
          .map((c) => ({ prise, heureDebut: c.heureDebut, heureFin: c.heureFin, annule: c.exceptions.includes(jourDate) })),
      )
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
    return { date: jourDate, jour, passages };
  });
}
