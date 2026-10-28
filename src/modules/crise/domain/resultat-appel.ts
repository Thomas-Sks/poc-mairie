/**
 * Décision après un appel de campagne (RG-03, RG-04, RG-06, E10-US5 à US7). Fonction pure.
 */
import { deciderApresNonReponse, RELANCE_PAR_DEFAUT, type ParametresRelance } from "@/shared/domain/campagne";
import type { Besoin, Couverture, StatutCible } from "@/shared/domain/vocabulaire";

/** Résultats saisissables par un appelant (bénévole ou agent). */
export const RESULTATS_APPEL = [
  "joint_ras",
  "joint_besoin",
  "ne_repond_pas",
  "messagerie",
  "numero_invalide",
  "absent",
  "couvert_proche",
  "proche_ne_repond_pas",
  "danger",
  "evacuation",
] as const;
export type ResultatAppel = (typeof RESULTATS_APPEL)[number];

export const RESULTAT_APPEL_LIBELLES: Record<ResultatAppel, string> = {
  joint_ras: "Joint – tout va bien",
  joint_besoin: "Joint – a besoin de quelque chose",
  ne_repond_pas: "Ne répond pas",
  messagerie: "Messagerie",
  numero_invalide: "Numéro invalide",
  absent: "Absent du domicile",
  couvert_proche: "Un proche confirme que tout va bien",
  proche_ne_repond_pas: "Le proche ne répond pas",
  danger: "Danger – urgence",
  evacuation: "Besoin d'évacuation / de relogement",
};

export type EtatCible = {
  statut: StatutCible;
  nbTentatives: number;
  /** Rang du dernier contact du cercle essayé (0 = aucun). */
  rangCercleEssaye: number;
};

export type DecisionAppel = {
  statut: StatutCible;
  nbTentatives: number;
  prochaineTentativeAt: Date | null;
  rangCercleEssaye: number;
  couverture: Couverture | null;
  /** RG-04 : il faut maintenant appeler le cercle (rang suivant). */
  appelerCercle: boolean;
  /** Notification à l'admin et aux agents (E10-US6, RG-06). */
  notification: "danger" | "escalade" | null;
  /** E10-US7 : un besoin crée une tâche (rappel) pour le CCAS. */
  creerRappelBesoin: boolean;
};

export type EntreeDecision = {
  resultat: ResultatAppel;
  /** Pour « le proche ne répond pas » : rang du contact appelé. */
  rangCercle?: number;
  besoins?: Besoin[];
  /** Nombre de contacts du cercle à appeler en cas de non-réponse. */
  nbContactsCercle: number;
};

const base = (etat: EtatCible): DecisionAppel => ({
  statut: etat.statut,
  nbTentatives: etat.nbTentatives,
  prochaineTentativeAt: null,
  rangCercleEssaye: etat.rangCercleEssaye,
  couverture: null,
  appelerCercle: false,
  notification: null,
  creerRappelBesoin: false,
});

export function deciderResultatAppel(
  etat: EtatCible,
  entree: EntreeDecision,
  maintenant: Date,
  relance: ParametresRelance = RELANCE_PAR_DEFAUT,
): DecisionAppel {
  const d = base(etat);
  const tentative = etat.nbTentatives + 1;
  switch (entree.resultat) {
    case "joint_ras":
      return { ...d, statut: "joint_ras", nbTentatives: tentative, couverture: "appel" };
    case "joint_besoin":
      return { ...d, statut: "joint_besoin", nbTentatives: tentative, couverture: "appel", creerRappelBesoin: (entree.besoins ?? []).length > 0 };
    case "absent":
      return { ...d, statut: "absent", nbTentatives: tentative, couverture: "absence" };
    case "numero_invalide":
      // Pas de relance possible sur un numéro invalide : on passe directement au cercle.
      return suiteSansReponse({ ...d, statut: "numero_invalide", nbTentatives: tentative }, entree, relance, true);
    case "danger":
      return { ...d, statut: "danger", nbTentatives: tentative, notification: "danger" };
    case "evacuation":
      return { ...d, statut: "evacuation", nbTentatives: tentative, notification: "danger" };
    case "couvert_proche":
      return { ...d, statut: "couvert_proche", rangCercleEssaye: Math.max(etat.rangCercleEssaye, entree.rangCercle ?? 1), couverture: "proche" };
    case "ne_repond_pas":
    case "messagerie": {
      const statut: StatutCible = entree.resultat === "messagerie" ? "messagerie" : "non_joint";
      const decision = deciderApresNonReponse(tentative, maintenant, relance, etat.rangCercleEssaye > 0);
      if (decision.type === "reprogrammer") {
        return { ...d, statut, nbTentatives: tentative, prochaineTentativeAt: decision.prochaineTentativeAt };
      }
      return suiteSansReponse({ ...d, statut, nbTentatives: tentative }, entree, relance, decision.type === "escalader_cercle");
    }
    case "proche_ne_repond_pas": {
      const rang = Math.max(etat.rangCercleEssaye, entree.rangCercle ?? etat.rangCercleEssaye + 1);
      if (rang < entree.nbContactsCercle) return { ...d, statut: "non_joint", rangCercleEssaye: rang, appelerCercle: true };
      return aTraiter({ ...d, rangCercleEssaye: rang });
    }
  }
}

function suiteSansReponse(d: DecisionAppel, entree: EntreeDecision, relance: ParametresRelance, escaladerCercle: boolean): DecisionAppel {
  const resteCercle = d.rangCercleEssaye < entree.nbContactsCercle;
  if (escaladerCercle && relance.escaladeCercle && resteCercle) return { ...d, appelerCercle: true };
  return aTraiter(d);
}

/** RG-04 : plus personne à joindre → « Non joint – à traiter », l'admin décide. */
const aTraiter = (d: DecisionAppel): DecisionAppel => ({ ...d, statut: "non_joint_a_traiter", notification: "escalade", appelerCercle: false });
