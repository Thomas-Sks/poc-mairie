/**
 * Boutons de résultat de l'écran « Appel » (E10-US4, E10-US5) et leur traduction en résultat de campagne.
 * La décision (statut, relances RG-04, escalade, notifications) appartient au module Crise
 * (`crise/domain/resultat-appel.ts`) : ce fichier n'en garde que le vocabulaire bénévole.
 *
 * Ce vocabulaire est aussi celui des opérations conservées dans la file hors connexion du navigateur :
 * le changer rendrait illisibles des opérations en attente de renvoi.
 */
import type { ResultatAppel as ResultatCampagne } from "@/modules/crise/domain/resultat-appel";

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

export const RESULTAT_PROCHE_LIBELLES: Record<ResultatProche, string> = {
  confirme: "Le proche confirme que tout va bien",
  va_passer: "Le proche va passer",
  ne_repond_pas: "Le proche ne répond pas",
};

const VERS_CAMPAGNE: Record<ResultatAppel, ResultatCampagne> = {
  tout_va_bien: "joint_ras",
  besoin: "joint_besoin",
  ne_repond_pas: "ne_repond_pas",
  mauvais_numero: "numero_invalide",
  absent: "absent",
  danger: "danger",
  evacuation: "evacuation",
};

export const resultatCampagne = (r: ResultatAppel): ResultatCampagne => VERS_CAMPAGNE[r];

/** « Confirme » et « va passer » couvrent la personne ; « ne répond pas » fait passer au proche suivant. */
export const resultatCampagneProche = (r: ResultatProche): ResultatCampagne =>
  r === "ne_repond_pas" ? "proche_ne_repond_pas" : "couvert_proche";

/** Précision gardée au compte rendu quand le résultat de campagne ne suffit pas à la dire (« va passer »). */
export const precisionProche = (r: ResultatProche): string | null => (r === "va_passer" ? RESULTAT_PROCHE_LIBELLES.va_passer : null);
