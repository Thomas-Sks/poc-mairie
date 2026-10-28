/**
 * Indicateurs du tableau de bord de campagne (E9-US5) et de la « Couverture du jour » (E6-US4). Fonctions pures.
 */
import { estTerminal, STATUTS_CRITIQUES, TON_STATUT_CIBLE } from "@/shared/domain/campagne";
import type { StatutCible, Ton } from "@/shared/domain/vocabulaire";

export type CibleIndicateur = {
  statut: StatutCible;
  exclue: boolean;
  canal: "humain" | "ia";
  assigneA: string | null;
};

/** E6-US4 : six catégories lisibles en un coup d'œil. */
export const CATEGORIES_COUVERTURE = ["passage", "appel", "absent", "a_appeler", "non_joint", "danger"] as const;
export type CategorieCouverture = (typeof CATEGORIES_COUVERTURE)[number];

export const COUVERTURE_LIBELLES: Record<CategorieCouverture, string> = {
  passage: "Couvert par passage",
  appel: "Couvert par appel",
  absent: "Absent",
  a_appeler: "À appeler",
  non_joint: "Non joint",
  danger: "En danger",
};

export const COUVERTURE_TONS: Record<CategorieCouverture, Ton> = {
  passage: "ok",
  appel: "ok",
  absent: "neutre",
  a_appeler: "accent",
  non_joint: "warn",
  danger: "err",
};

export function categorieCouverture(statut: StatutCible): CategorieCouverture {
  switch (statut) {
    case "couvert_passage":
      return "passage";
    case "joint_ras":
    case "joint_besoin":
    case "couvert_proche":
      return "appel";
    case "absent":
      return "absent";
    case "a_appeler":
    case "en_cours":
      return "a_appeler";
    case "danger":
    case "evacuation":
      return "danger";
    default:
      return "non_joint";
  }
}

export function compterCouverture(cibles: Pick<CibleIndicateur, "statut">[]): Record<CategorieCouverture, number> {
  const r = Object.fromEntries(CATEGORIES_COUVERTURE.map((c) => [c, 0])) as Record<CategorieCouverture, number>;
  for (const c of cibles) r[categorieCouverture(c.statut)] += 1;
  return r;
}

export function compterParStatut(cibles: Pick<CibleIndicateur, "statut">[]): Partial<Record<StatutCible, number>> {
  const r: Partial<Record<StatutCible, number>> = {};
  for (const c of cibles) r[c.statut] = (r[c.statut] ?? 0) + 1;
  return r;
}

/** Ordre de traitement des situations critiques : danger, évacuation, escalade IA, non joint à traiter. */
const RANG_CRITIQUE: Partial<Record<StatutCible, number>> = { danger: 0, evacuation: 1, escalade_humain: 2, non_joint_a_traiter: 3 };

export function situationsPrioritaires<T extends Pick<CibleIndicateur, "statut">>(cibles: T[]): T[] {
  return cibles
    .filter((c) => STATUTS_CRITIQUES.has(c.statut) || c.statut === "evacuation")
    .sort((a, b) => (RANG_CRITIQUE[a.statut] ?? 9) - (RANG_CRITIQUE[b.statut] ?? 9));
}

export type ProgressionAppelant = { utilisateurId: string; total: number; traitees: number; aTraiter: number };

/** E9-US5 : progression par appelant (cibles humaines assignées). */
export function progressionParAppelant(cibles: CibleIndicateur[]): ProgressionAppelant[] {
  const parId = new Map<string, ProgressionAppelant>();
  for (const c of cibles) {
    if (!c.assigneA || c.exclue || c.canal === "ia") continue;
    const p = parId.get(c.assigneA) ?? { utilisateurId: c.assigneA, total: 0, traitees: 0, aTraiter: 0 };
    p.total += 1;
    if (estTraitee(c.statut)) p.traitees += 1;
    else p.aTraiter += 1;
    parId.set(c.assigneA, p);
  }
  return [...parId.values()].sort((a, b) => b.total - a.total);
}

/** Une cible est « traitée » quand plus aucun appel n'est attendu d'un appelant. */
export const estTraitee = (s: StatutCible) => estTerminal(s) || s === "joint_besoin" || s === "danger" || s === "evacuation" || s === "non_joint_a_traiter";

export const tonStatut = (s: StatutCible): Ton => TON_STATUT_CIBLE[s];
