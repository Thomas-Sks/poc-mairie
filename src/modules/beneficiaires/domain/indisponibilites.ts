/**
 * E5 — Indisponibilités : état d'une période d'absence et rappel « Vérifier le retour » (E5-US3).
 */
import type { DateISO } from "@/shared/domain/dates";
import type { TypeIndisponibilite } from "@/shared/domain/vocabulaire";

export type PeriodeIndisponibilite = { type: TypeIndisponibilite; debut: DateISO; fin: DateISO | null };

export type EtatIndisponibilite = "a_venir" | "en_cours" | "terminee";

export const ETAT_INDISPONIBILITE_LIBELLES: Record<EtatIndisponibilite, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  terminee: "Terminée",
};

export function etatIndisponibilite(p: PeriodeIndisponibilite, date: DateISO): EtatIndisponibilite {
  if (p.debut > date) return "a_venir";
  if (p.fin !== null && p.fin < date) return "terminee";
  return "en_cours";
}

/** Indisponibilité active à la date donnée (la plus récente si plusieurs). */
export function indisponibiliteEnCours<T extends PeriodeIndisponibilite>(periodes: T[], date: DateISO): T | null {
  return (
    periodes
      .filter((p) => etatIndisponibilite(p, date) === "en_cours")
      .sort((a, b) => b.debut.localeCompare(a.debut))[0] ?? null
  );
}

export type ErreurIndisponibilite = "fin_avant_debut";

export function verifierPeriode(p: PeriodeIndisponibilite): ErreurIndisponibilite | null {
  return p.fin !== null && p.fin < p.debut ? "fin_avant_debut" : null;
}

/** E5-US3 : à la date de fin, un rappel « Vérifier le retour de M. X » ; rien si « jusqu'à nouvel ordre ». */
export function rappelDeRetour(p: PeriodeIndisponibilite, nomBeneficiaire: string): { objet: string; echeance: DateISO } | null {
  if (p.fin === null) return null;
  const objet =
    p.type === "hospitalisation"
      ? `Vérifier le retour d'hospitalisation de ${nomBeneficiaire} (fragilité accrue)`
      : `Vérifier le retour de ${nomBeneficiaire}`;
  return { objet, echeance: p.fin };
}
