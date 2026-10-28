/**
 * Dates métier. Les dates "calendaires" (naissance, échéance…) circulent au format ISO `YYYY-MM-DD`.
 * Fuseau de référence : Europe/Paris.
 */

export type DateISO = string; // YYYY-MM-DD

const FUSEAU = "Europe/Paris";

/** Date du jour à Paris, au format ISO. */
export function aujourdhui(maintenant: Date = new Date()): DateISO {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSEAU }).format(maintenant);
}

/** RG-08 : âge toujours calculé depuis la date de naissance. */
export function calculerAge(dateNaissance: DateISO, reference: DateISO = aujourdhui()): number {
  const [an, mois, jour] = dateNaissance.split("-").map(Number);
  const [refAn, refMois, refJour] = reference.split("-").map(Number);
  let age = refAn - an;
  if (refMois < mois || (refMois === mois && refJour < jour)) age -= 1;
  return age;
}

export function ajouterJours(date: DateISO, jours: number): DateISO {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

export function ecartEnJours(de: DateISO, a: DateISO): number {
  const ms = new Date(`${a}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** 1 = lundi … 7 = dimanche (ISO 8601). */
export function jourDeSemaine(date: DateISO): number {
  const j = new Date(`${date}T12:00:00Z`).getUTCDay();
  return j === 0 ? 7 : j;
}

/** Prochain anniversaire (date ISO) à partir de `reference`, et l'âge atteint ce jour-là. */
export function prochainAnniversaire(dateNaissance: DateISO, reference: DateISO = aujourdhui()) {
  const [an, mois, jour] = dateNaissance.split("-");
  const refAn = Number(reference.slice(0, 4));
  let date = `${refAn}-${mois}-${jour}`;
  if (date < reference) date = `${refAn + 1}-${mois}-${jour}`;
  return { date, age: Number(date.slice(0, 4)) - Number(an) };
}

export function estAnniversaireRond(age: number): boolean {
  return age >= 80 && age % 10 === 0;
}

const FORMAT_LONG = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const FORMAT_COURT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORMAT_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });
const FORMAT_DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSEAU,
});

/** « 14 octobre 2026 » */
export const formaterDateLongue = (d: DateISO) => FORMAT_LONG.format(new Date(`${d}T00:00:00Z`));
/** « 14/10/2026 » */
export const formaterDate = (d: DateISO) => FORMAT_COURT.format(new Date(`${d}T00:00:00Z`));
/** « 09:30 » */
export const formaterHeure = (d: Date) => FORMAT_HEURE.format(d);
/** « 14/10/2026 09:30 » */
export const formaterDateHeure = (d: Date) => FORMAT_DATE_HEURE.format(d);

/** Recule de N mois (le 31 devient le dernier jour du mois s'il est plus court). */
export function retirerMois(date: DateISO, mois: number): DateISO {
  const [an, m, j] = date.split("-").map(Number);
  const total = an * 12 + (m - 1) - mois;
  const nouvelAn = Math.floor(total / 12);
  const nouveauMois = (total % 12) + 1;
  const dernierJour = new Date(Date.UTC(nouvelAn, nouveauMois, 0)).getUTCDate();
  const jourFinal = Math.min(j, dernierJour);
  return `${String(nouvelAn).padStart(4, "0")}-${String(nouveauMois).padStart(2, "0")}-${String(jourFinal).padStart(2, "0")}`;
}
