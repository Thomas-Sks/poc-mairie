/**
 * E10-US3 « Ma liste » : tri, personne suivante et libellés sans jargon (E10-US8).
 */
import type { NiveauPriorite, StatutCible, Ton } from "@/shared/domain/vocabulaire";

/** Statuts encore « à faire » pour le bénévole. Les autres sont soit réglés, soit entre les mains du CCAS. */
export const STATUTS_A_FAIRE: ReadonlySet<StatutCible> = new Set(["a_appeler", "en_cours", "non_joint", "messagerie"]);

export const resteAFaire = (s: StatutCible) => STATUTS_A_FAIRE.has(s);

/** Libellés vus par le bénévole : ni « fiche », ni « campagne », ni sigles. */
export const STATUT_BENEVOLE: Record<StatutCible, { libelle: string; ton: Ton }> = {
  a_appeler: { libelle: "À appeler", ton: "accent" },
  en_cours: { libelle: "À appeler", ton: "accent" },
  non_joint: { libelle: "À rappeler", ton: "accent" },
  messagerie: { libelle: "À rappeler", ton: "accent" },
  joint_ras: { libelle: "Tout va bien", ton: "ok" },
  couvert_proche: { libelle: "Un proche a confirmé", ton: "ok" },
  couvert_passage: { libelle: "Déjà vu aujourd'hui", ton: "ok" },
  absent: { libelle: "Absent", ton: "neutre" },
  joint_besoin: { libelle: "Besoin transmis", ton: "neutre" },
  numero_invalide: { libelle: "Mauvais numéro", ton: "neutre" },
  escalade_humain: { libelle: "Transmis à l'équipe", ton: "neutre" },
  non_joint_a_traiter: { libelle: "Transmis à l'équipe", ton: "neutre" },
  danger: { libelle: "Urgence signalée", ton: "err" },
  evacuation: { libelle: "Relogement demandé", ton: "err" },
};

export type ElementListe = {
  id: string;
  statut: StatutCible;
  niveau: NiveauPriorite;
  score: number;
  prochaineTentativeAt: Date | null;
  /** Verrou d'appel tenu par quelqu'un d'autre. */
  verrouilleParAutre: boolean;
};

/** Priorité (P1, P2, P3 puis score), puis heure de rappel : sans heure d'abord, puis la plus proche. */
export function comparerMaListe(a: ElementListe, b: ElementListe): number {
  if (a.niveau !== b.niveau) return a.niveau.localeCompare(b.niveau);
  if (a.score !== b.score) return b.score - a.score;
  const ta = a.prochaineTentativeAt?.getTime() ?? 0;
  const tb = b.prochaineTentativeAt?.getTime() ?? 0;
  return ta - tb;
}

export function trierMaListe<T extends ElementListe>(elements: T[]): { aFaire: T[]; faits: T[] } {
  const tries = [...elements].sort(comparerMaListe);
  return { aFaire: tries.filter((e) => resteAFaire(e.statut)), faits: tries.filter((e) => !resteAFaire(e.statut)) };
}

export const estAppelableMaintenant = (e: ElementListe, maintenant: Date) =>
  resteAFaire(e.statut) &&
  !e.verrouilleParAutre &&
  (e.prochaineTentativeAt === null || e.prochaineTentativeAt.getTime() <= maintenant.getTime());

/** « Personne suivante » : la plus prioritaire qu'on peut appeler maintenant. */
export function personneSuivante<T extends ElementListe>(elements: T[], maintenant: Date): T | null {
  return [...elements].sort(comparerMaListe).find((e) => estAppelableMaintenant(e, maintenant)) ?? null;
}
