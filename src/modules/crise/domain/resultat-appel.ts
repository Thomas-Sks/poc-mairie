/**
 * Décision après un appel de campagne (RG-03, RG-04, RG-06, E10-US5 à US7). Fonction pure.
 * Source de vérité unique du cycle de vie d'une cible : utilisée par le tableau de bord (agent)
 * et par l'interface bénévole (qui traduit ses boutons en `ResultatAppel`).
 *
 * Conventions :
 * - le verrou ne modifie jamais `statut` (« en cours » se déduit de `verrouActif(verrou_at)`) ;
 * - une non-réponse garde `non_joint`, est reprogrammée (+30 min, +2 h), puis passe au cercle
 *   (`rang_cercle_essaye`), puis `couvert_proche` ou `non_joint_a_traiter` (notification `escalade`).
 */
import { deciderApresNonReponse, RELANCE_PAR_DEFAUT, type ParametresRelance } from "@/shared/domain/campagne";
import { BESOIN_LIBELLES, type Besoin, type Couverture, type StatutCible } from "@/shared/domain/vocabulaire";

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
  /** Relance déjà programmée (conservée quand l'appel d'un proche ne change rien). */
  prochaineTentativeAt?: Date | null;
};

export type DecisionAppel = {
  statut: StatutCible;
  nbTentatives: number;
  prochaineTentativeAt: Date | null;
  rangCercleEssaye: number;
  couverture: Couverture | null;
  /** RG-04 / E10-US5 : il faut maintenant appeler le cercle (rang suivant) ; l'appelant garde le verrou. */
  appelerCercle: boolean;
  /** Notification à l'admin et aux agents (E10-US6, RG-06). */
  notification: "danger" | "escalade" | null;
  /** E10-US7 : un besoin crée une tâche pour le CCAS. */
  creerRappelBesoin: boolean;
  /** Un numéro invalide crée une tâche de vérification de la fiche. */
  creerRappelVerification: boolean;
};

export type EntreeDecision = {
  resultat: ResultatAppel;
  /** Pour un résultat du cercle : rang (1 = premier) du contact appelé parmi les contacts joignables. */
  rangCercle?: number;
  /** Nombre de contacts joignables du cercle. */
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
  creerRappelVerification: false,
});

export function deciderResultatAppel(
  etat: EtatCible,
  entree: EntreeDecision,
  maintenant: Date,
  relance: ParametresRelance = RELANCE_PAR_DEFAUT,
): DecisionAppel {
  const d = base(etat);
  const tentative = etat.nbTentatives + 1;
  const cercleEpuise = etat.rangCercleEssaye >= entree.nbContactsCercle;
  switch (entree.resultat) {
    case "joint_ras":
      return { ...d, statut: "joint_ras", nbTentatives: tentative, couverture: "appel" };
    case "joint_besoin":
      return { ...d, statut: "joint_besoin", nbTentatives: tentative, couverture: "appel", creerRappelBesoin: true };
    case "absent":
      return { ...d, statut: "absent", nbTentatives: tentative, couverture: "absence" };
    case "danger":
      return { ...d, statut: "danger", nbTentatives: tentative, notification: "danger" };
    case "evacuation":
      return { ...d, statut: "evacuation", nbTentatives: tentative, notification: "danger" };
    case "numero_invalide": {
      // Pas de relance possible sur un numéro invalide : on passe directement au cercle, et la fiche est à vérifier.
      const n = { ...d, statut: "numero_invalide" as const, nbTentatives: tentative, creerRappelVerification: true };
      return relance.escaladeCercle && !cercleEpuise ? { ...n, appelerCercle: true } : aTraiter(n);
    }
    case "ne_repond_pas":
    case "messagerie": {
      const statut: StatutCible = entree.resultat === "messagerie" ? "messagerie" : "non_joint";
      const n = { ...d, statut, nbTentatives: tentative };
      const suite = deciderApresNonReponse(tentative, maintenant, relance, cercleEpuise);
      if (suite.type === "reprogrammer") return { ...n, prochaineTentativeAt: suite.prochaineTentativeAt };
      if (suite.type === "escalader_cercle") return { ...n, appelerCercle: true };
      return aTraiter(n);
    }
    case "couvert_proche":
      return {
        ...d,
        statut: "couvert_proche",
        rangCercleEssaye: Math.max(etat.rangCercleEssaye, entree.rangCercle ?? etat.rangCercleEssaye + 1),
        couverture: "proche",
      };
    case "proche_ne_repond_pas": {
      const rang = Math.max(etat.rangCercleEssaye, entree.rangCercle ?? etat.rangCercleEssaye + 1);
      // La personne elle-même reste non jointe : on conserve son statut et sa relance programmée.
      const inchange = { ...d, rangCercleEssaye: rang, prochaineTentativeAt: etat.prochaineTentativeAt ?? null };
      if (rang < entree.nbContactsCercle) return { ...inchange, appelerCercle: true };
      // Cercle épuisé alors qu'il reste des tentatives (E10-US5 : cercle appelé en parallèle) : on attend la relance.
      const relancePossible = etat.statut !== "numero_invalide" && etat.nbTentatives < relance.nbTentatives;
      if (relancePossible) return inchange;
      return aTraiter(inchange);
    }
  }
}

/** RG-04 : plus personne à joindre → « Non joint – à traiter », l'admin décide. */
const aTraiter = (d: DecisionAppel): DecisionAppel => ({
  ...d,
  statut: "non_joint_a_traiter",
  notification: "escalade",
  appelerCercle: false,
  prochaineTentativeAt: null,
});

/**
 * Objet de la tâche créée pour un besoin (E10-US7). Se termine par « – <campagne> » :
 * le rapport de campagne compte les tâches de besoin sur ce suffixe.
 */
export function objetRappelBesoin(personne: string, besoins: Besoin[], campagneNom: string, precision?: string | null): string {
  const liste = besoins.length ? besoins.map((b) => BESOIN_LIBELLES[b]).join(", ") : "à préciser";
  return `Besoin signalé (${liste}) : ${personne}${precision ? ` (${precision})` : ""} – ${campagneNom}`;
}
