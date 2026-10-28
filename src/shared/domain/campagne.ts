/**
 * Règles de campagne d'appel : RG-02 (ordre), RG-03 (statuts), RG-04 (relances), RG-05 (anti-doublon),
 * verrou d'appel (E8-US7). Fonctions pures.
 */
import { jourDeSemaine, type DateISO } from "./dates";
import type { Couverture, NiveauPriorite, StatutCible, Ton, TypeCampagne } from "./vocabulaire";

/** RG-03 : statuts terminaux pour la vague du jour. */
export const STATUTS_TERMINAUX: ReadonlySet<StatutCible> = new Set([
  "joint_ras",
  "couvert_proche",
  "couvert_passage",
  "absent",
]);

export const estTerminal = (s: StatutCible) => STATUTS_TERMINAUX.has(s);

/** Statuts qui nécessitent une action humaine rapide (tête du tableau de bord). */
export const STATUTS_CRITIQUES: ReadonlySet<StatutCible> = new Set([
  "danger",
  "evacuation",
  "escalade_humain",
  "non_joint_a_traiter",
]);

export const TON_STATUT_CIBLE: Record<StatutCible, Ton> = {
  a_appeler: "accent",
  en_cours: "accent",
  joint_ras: "ok",
  couvert_proche: "ok",
  couvert_passage: "ok",
  absent: "neutre",
  joint_besoin: "warn",
  non_joint: "warn",
  messagerie: "warn",
  numero_invalide: "warn",
  escalade_humain: "warn",
  non_joint_a_traiter: "err",
  danger: "err",
  evacuation: "err",
};

/** RG-02 : P1 avant P2 avant P3 ; à niveau égal, score décroissant ; puis non joints la veille d'abord. */
export type CleOrdre = {
  niveau: NiveauPriorite;
  score: number;
  nonJointVeille: boolean;
  escalade?: boolean;
};

export function comparerOrdreAppel(a: CleOrdre, b: CleOrdre): number {
  // RG-06 : toute escalade passe en tête de liste.
  if (Boolean(a.escalade) !== Boolean(b.escalade)) return a.escalade ? -1 : 1;
  if (a.niveau !== b.niveau) return a.niveau.localeCompare(b.niveau);
  if (a.score !== b.score) return b.score - a.score;
  if (a.nonJointVeille !== b.nonJointVeille) return a.nonJointVeille ? -1 : 1;
  return 0;
}

/** RG-04 : paramètres de relance. */
export type ParametresRelance = {
  nbTentatives: number;
  delaisMinutes: number[]; // délai avant la tentative 2, 3…
  plageDebut: string; // "09:00"
  plageFin: string; // "19:00"
  escaladeCercle: boolean;
};

export const RELANCE_PAR_DEFAUT: ParametresRelance = {
  nbTentatives: 3,
  delaisMinutes: [30, 120],
  plageDebut: "09:00",
  plageFin: "19:00",
  escaladeCercle: true,
};

export type DecisionNonReponse =
  | { type: "reprogrammer"; tentative: number; prochaineTentativeAt: Date }
  | { type: "escalader_cercle" }
  | { type: "a_traiter" };

/**
 * RG-04 : après un « ne répond pas » à la tentative `tentativeFaite` (1-indexée).
 * Retourne la suite à donner.
 */
export function deciderApresNonReponse(
  tentativeFaite: number,
  maintenant: Date,
  params: ParametresRelance = RELANCE_PAR_DEFAUT,
  cercleDejaEssaye = false,
): DecisionNonReponse {
  if (tentativeFaite < params.nbTentatives) {
    const delai = params.delaisMinutes[tentativeFaite - 1] ?? params.delaisMinutes.at(-1) ?? 60;
    return {
      type: "reprogrammer",
      tentative: tentativeFaite + 1,
      prochaineTentativeAt: new Date(maintenant.getTime() + delai * 60_000),
    };
  }
  if (params.escaladeCercle && !cercleDejaEssaye) return { type: "escalader_cercle" };
  return { type: "a_traiter" };
}

/** RG-05 : passage d'intervenant prévu un jour donné ? */
export type CreneauPassage = {
  joursSemaine: number[]; // 1 = lundi … 7 = dimanche
  heureDebut: string;
  exceptions: DateISO[];
  dateDebut?: DateISO | null;
  dateFin?: DateISO | null;
};

export function passagePrevuLe(creneau: CreneauPassage, jour: DateISO): boolean {
  if (creneau.exceptions.includes(jour)) return false;
  if (creneau.dateDebut && jour < creneau.dateDebut) return false;
  if (creneau.dateFin && jour > creneau.dateFin) return false;
  return creneau.joursSemaine.includes(jourDeSemaine(jour));
}

export type Indispo = { debut: DateISO; fin: DateISO | null };

export function indisponibleLe(indispo: Indispo, jour: DateISO): boolean {
  return indispo.debut <= jour && (indispo.fin === null || jour <= indispo.fin);
}

export type FaitsExclusion = {
  passages: (CreneauPassage & { libelle: string })[];
  indisponibilites: (Indispo & { libelle: string })[];
  statutDuJour: StatutCible | null;
};

export type Exclusion = { couverture: Couverture; motif: string; statut: StatutCible } | null;

/**
 * Un passage d'intervenant couvre-t-il la personne pour ce type de campagne ?
 * Oui pour une canicule ou un grand froid (l'intervenant voit la personne chez elle).
 * Non pour une inondation ou une tempête : la situation peut changer dans la journée,
 * un passage prévu ne garantit pas que la personne soit en sécurité (décision client du 28/10/2026).
 */
export function passagesCouvrent(type: TypeCampagne): boolean {
  return type !== "inondation" && type !== "tempete";
}

/** RG-05 : un bénéficiaire est exclu de la vague du jour s'il est déjà couvert. */
export function evaluerExclusion(faits: FaitsExclusion, jour: DateISO, options: { passagesCouvrent: boolean } = { passagesCouvrent: true }): Exclusion {
  const indispo = faits.indisponibilites.find((i) => indisponibleLe(i, jour));
  if (indispo) return { couverture: "absence", motif: `Absent : ${indispo.libelle}`, statut: "absent" };

  const passage = faits.passages
    .filter((p) => options.passagesCouvrent && passagePrevuLe(p, jour))
    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))[0];
  if (passage) {
    return {
      couverture: "passage",
      motif: `Couvert par passage ${passage.libelle} à ${passage.heureDebut.replace(":", "h")}`,
      statut: "couvert_passage",
    };
  }

  if (faits.statutDuJour && estTerminal(faits.statutDuJour)) {
    return { couverture: "appel", motif: "Déjà joint aujourd'hui", statut: faits.statutDuJour };
  }
  return null;
}

/** E8-US7 : verrou d'appel auto-libéré après 10 min d'inactivité. */
export const DUREE_VERROU_MS = 10 * 60_000;

export function verrouActif(verrouAt: Date | null, maintenant: Date = new Date()): boolean {
  return verrouAt !== null && maintenant.getTime() - verrouAt.getTime() < DUREE_VERROU_MS;
}

/** Répartition équitable (E8-US6) en respectant l'ordre de priorité : distribution en tourniquet. */
export function repartir<T>(elementsOrdonnes: T[], nbPersonnes: number): T[][] {
  const lots: T[][] = Array.from({ length: nbPersonnes }, () => []);
  elementsOrdonnes.forEach((el, i) => lots[i % nbPersonnes].push(el));
  return lots;
}
