/**
 * E10-US4 : questions oui/non du script et consignes conditionnelles.
 * Une réponse « préoccupante » déclenche : consigne à lire, encart de recommandations,
 * statut proposé, besoin et tag ajoutés à la personne (ex. « isolement »).
 */
import type { Besoin, StatutCible } from "@/shared/domain/vocabulaire";

export type Reponse = "oui" | "non";
export type Reponses = Record<string, Reponse>;

/** Forme d'une question (identique à `QuestionScript` du schéma, sans dépendre de l'infrastructure). */
export type Question = {
  id: string;
  texte: string;
  reponsePreoccupante: Reponse;
  consigne?: string;
  besoin?: Besoin;
  tag?: string;
  statutPropose?: StatutCible;
  afficherEncart?: boolean;
};

export type Evaluation = {
  /** Questions dont la réponse est préoccupante, dans l'ordre du script. */
  preoccupantes: string[];
  consignes: { questionId: string; texte: string }[];
  afficherEncart: boolean;
  statutPropose: StatutCible | null;
  besoins: Besoin[];
  tags: string[];
};

/** Plus le rang est petit, plus le statut proposé est grave (il l'emporte). */
const GRAVITE: Partial<Record<StatutCible, number>> = {
  danger: 0,
  evacuation: 1,
  joint_besoin: 2,
};

const rang = (s: StatutCible) => GRAVITE[s] ?? 99;

export function estPreoccupante(question: Question, reponse: Reponse | undefined): boolean {
  return reponse !== undefined && reponse === question.reponsePreoccupante;
}

export function evaluerReponses(questions: Question[], reponses: Reponses): Evaluation {
  const evaluation: Evaluation = {
    preoccupantes: [],
    consignes: [],
    afficherEncart: false,
    statutPropose: null,
    besoins: [],
    tags: [],
  };
  for (const q of questions) {
    if (!estPreoccupante(q, reponses[q.id])) continue;
    evaluation.preoccupantes.push(q.id);
    if (q.consigne) evaluation.consignes.push({ questionId: q.id, texte: q.consigne });
    if (q.afficherEncart) evaluation.afficherEncart = true;
    if (q.besoin && !evaluation.besoins.includes(q.besoin)) evaluation.besoins.push(q.besoin);
    if (q.tag && !evaluation.tags.includes(q.tag)) evaluation.tags.push(q.tag);
    if (q.statutPropose && (evaluation.statutPropose === null || rang(q.statutPropose) < rang(evaluation.statutPropose))) {
      evaluation.statutPropose = q.statutPropose;
    }
  }
  return evaluation;
}

/** Ne garde que les réponses aux questions du script (entrée non fiable venant du navigateur). */
export function filtrerReponses(questions: Question[], reponses: Record<string, unknown>): Reponses {
  const propres: Reponses = {};
  for (const q of questions) {
    const r = reponses[q.id];
    if (r === "oui" || r === "non") propres[q.id] = r;
  }
  return propres;
}
