/**
 * E3 — Journal d'interactions : rappel de suivi automatique (E3-US3) et timeline filtrable (E3-US2).
 */
import { ajouterJours, type DateISO } from "@/shared/domain/dates";
import type { TypeInteraction } from "@/shared/domain/vocabulaire";

export type SuiviDemande = { actionSuivi: string | null; echeance: DateISO | null; assigneA: string | null };

/**
 * E3-US3 : une action de suivi saisie crée un rappel assigné à l'auteur ou à un collègue.
 * Sans échéance précisée, le rappel est fixé au lendemain.
 */
export function rappelDeSuivi(
  suivi: SuiviDemande,
  { auteurId, aujourdhui }: { auteurId: string; aujourdhui: DateISO },
): { objet: string; echeance: DateISO; assigneA: string } | null {
  const objet = suivi.actionSuivi?.trim();
  if (!objet) return null;
  return { objet, echeance: suivi.echeance ?? ajouterJours(aujourdhui, 1), assigneA: suivi.assigneA ?? auteurId };
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export const PERIODES = ["30j", "3m", "12m", "tout"] as const;
export type Periode = (typeof PERIODES)[number];
export const PERIODE_LIBELLES: Record<Periode, string> = {
  "30j": "30 derniers jours",
  "3m": "3 derniers mois",
  "12m": "12 derniers mois",
  tout: "Depuis l'inscription",
};

/** Filtre « type » : un type d'interaction, les modifications de fiche, ou tout. */
export type FiltreType = TypeInteraction | "modification" | "campagne" | "tous";

export type EvenementTimeline = {
  genre: "interaction" | "modification";
  type: TypeInteraction | null;
  date: Date;
  campagneId: string | null;
};

export function debutPeriode(periode: Periode, aujourdhui: DateISO): DateISO | null {
  switch (periode) {
    case "30j":
      return ajouterJours(aujourdhui, -30);
    case "3m":
      return ajouterJours(aujourdhui, -91);
    case "12m":
      return ajouterJours(aujourdhui, -365);
    case "tout":
      return null;
  }
}

export function filtrerTimeline<T extends EvenementTimeline>(
  evenements: T[],
  { type, periode }: { type: FiltreType; periode: Periode },
  aujourdhui: DateISO,
): T[] {
  const debut = debutPeriode(periode, aujourdhui);
  const debutDate = debut ? new Date(`${debut}T00:00:00Z`) : null;
  return evenements
    .filter((e) => debutDate === null || e.date >= debutDate)
    .filter((e) => {
      if (type === "tous") return true;
      if (type === "modification") return e.genre === "modification";
      if (type === "campagne") return e.campagneId !== null;
      return e.genre === "interaction" && e.type === type;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
