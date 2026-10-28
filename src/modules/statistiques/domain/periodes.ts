/** E12-US5 — Périodes proposées dans les listes déroulantes (relatives au jour courant). */
import { ajouterJours, formaterDate, type DateISO } from "@/shared/domain/dates";
import type { Periode } from "./requete";

export type PeriodeProposee = { cle: string; libelle: string; periode: Periode | null };

export function periodesProposees(jour: DateISO): PeriodeProposee[] {
  const an = Number(jour.slice(0, 4));
  return [
    { cle: "tout", libelle: "Toute la période", periode: null },
    { cle: "3m", libelle: "3 derniers mois", periode: { du: ajouterJours(jour, -91), au: jour } },
    { cle: "12m", libelle: "12 derniers mois", periode: { du: ajouterJours(jour, -364), au: jour } },
    { cle: "annee", libelle: `Année ${an}`, periode: { du: `${an}-01-01`, au: `${an}-12-31` } },
    { cle: "annee-1", libelle: `Année ${an - 1}`, periode: { du: `${an - 1}-01-01`, au: `${an - 1}-12-31` } },
    { cle: "ete", libelle: `Été ${an} (juin à août)`, periode: { du: `${an}-06-01`, au: `${an}-08-31` } },
    { cle: "ete-1", libelle: `Été ${an - 1} (juin à août)`, periode: { du: `${an - 1}-06-01`, au: `${an - 1}-08-31` } },
  ];
}

/** Retrouve la période proposée correspondante ; sinon « personnalisée ». */
export function clePeriode(p: Periode | null, proposees: PeriodeProposee[]): string {
  const trouvee = proposees.find((x) => (x.periode === null ? p === null : p !== null && x.periode.du === p.du && x.periode.au === p.au));
  return trouvee?.cle ?? "personnalisee";
}

export function decrirePeriode(p: Periode | null): string {
  return p ? `du ${formaterDate(p.du)} au ${formaterDate(p.au)}` : "toute la période";
}
