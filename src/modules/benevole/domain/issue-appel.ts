/**
 * Issue d'un appel bénévole (E10-US4 à US7) : du bouton pressé au statut de la personne (RG-03),
 * avec la règle de relance RG-04 en cas de non-réponse et l'escalade vers le cercle (E10-US5).
 */
import { deciderApresNonReponse, type ParametresRelance } from "@/shared/domain/campagne";
import type { Couverture, StatutCible } from "@/shared/domain/vocabulaire";

/** Boutons de résultat de l'écran « Appel ». */
export const RESULTATS_APPEL = [
  "tout_va_bien",
  "besoin",
  "ne_repond_pas",
  "mauvais_numero",
  "absent",
  "danger",
  "evacuation",
] as const;
export type ResultatAppel = (typeof RESULTATS_APPEL)[number];

/** Résultat saisi pour un proche du cercle (E10-US5). */
export const RESULTATS_PROCHE = ["confirme", "va_passer", "ne_repond_pas"] as const;
export type ResultatProche = (typeof RESULTATS_PROCHE)[number];

export type EtatCible = {
  nbTentatives: number;
  rangCercleEssaye: number;
  /** Le cercle compte au moins un proche avec un numéro. */
  cercleJoignable: boolean;
};

export type MiseAJourCible = {
  statut: StatutCible;
  nbTentatives: number;
  prochaineTentativeAt: Date | null;
  couverture: Couverture | null;
  /** L'équipe du CCAS doit être prévenue tout de suite (danger, personne introuvable…). */
  alerterCcas: "danger" | "escalade" | null;
};

const STATUT_DIRECT: Record<Exclude<ResultatAppel, "ne_repond_pas">, StatutCible> = {
  tout_va_bien: "joint_ras",
  besoin: "joint_besoin",
  mauvais_numero: "numero_invalide",
  absent: "absent",
  danger: "danger",
  evacuation: "evacuation",
};

export function issueAppel(
  resultat: ResultatAppel,
  cible: EtatCible,
  maintenant: Date,
  relance: ParametresRelance,
): MiseAJourCible {
  const nbTentatives = cible.nbTentatives + 1;
  if (resultat !== "ne_repond_pas") {
    const statut = STATUT_DIRECT[resultat];
    return {
      statut,
      nbTentatives,
      prochaineTentativeAt: null,
      couverture: statut === "joint_ras" || statut === "joint_besoin" ? "appel" : statut === "absent" ? "absence" : null,
      alerterCcas: statut === "danger" || statut === "evacuation" ? "danger" : null,
    };
  }
  // RG-04 : on reprogramme ; le bénévole tente en parallèle le cercle (E10-US5).
  const decision = deciderApresNonReponse(nbTentatives, maintenant, relance, cible.rangCercleEssaye > 0 || !cible.cercleJoignable);
  if (decision.type === "reprogrammer") {
    return { statut: "non_joint", nbTentatives, prochaineTentativeAt: decision.prochaineTentativeAt, couverture: null, alerterCcas: null };
  }
  // Dernière tentative : on laisse le cercle être appelé ; s'il a déjà été essayé, c'est au CCAS de décider.
  if (decision.type === "escalader_cercle") {
    return { statut: "non_joint", nbTentatives, prochaineTentativeAt: null, couverture: null, alerterCcas: null };
  }
  return { statut: "non_joint_a_traiter", nbTentatives, prochaineTentativeAt: null, couverture: null, alerterCcas: "escalade" };
}

/**
 * Résultat de l'appel d'un proche. `cercleEpuise` : il ne reste plus personne à appeler après celui-ci.
 * Retourne null quand il n'y a rien à changer sur la personne (on passe au proche suivant).
 */
export function issueProche(
  resultat: ResultatProche,
  contexte: { nbTentatives: number; cercleEpuise: boolean },
  relance: ParametresRelance,
): Pick<MiseAJourCible, "statut" | "couverture" | "alerterCcas" | "prochaineTentativeAt"> | null {
  if (resultat === "confirme" || resultat === "va_passer") {
    return { statut: "couvert_proche", couverture: "proche", alerterCcas: null, prochaineTentativeAt: null };
  }
  if (!contexte.cercleEpuise) return null;
  // Personne dans le cercle : si toutes les tentatives sont faites, le CCAS prend le relais (RG-04).
  if (contexte.nbTentatives >= relance.nbTentatives) {
    return { statut: "non_joint_a_traiter", couverture: null, alerterCcas: "escalade", prochaineTentativeAt: null };
  }
  return null;
}

export const RESULTAT_PROCHE_LIBELLES: Record<ResultatProche, string> = {
  confirme: "Le proche confirme que tout va bien",
  va_passer: "Le proche va passer",
  ne_repond_pas: "Le proche ne répond pas",
};
