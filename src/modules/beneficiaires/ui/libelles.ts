/** Libellés et tons d'affichage du module (utilisables côté serveur et client). */
import type { StatutCible, Ton } from "@/shared/domain/vocabulaire";

export const options = <T extends string>(valeurs: readonly T[], libelles: Record<T, string>) =>
  valeurs.map((v) => ({ valeur: v, libelle: libelles[v] }));

/** Ton de pastille d'un résultat d'interaction (RG-03). */
export function tonResultat(statut: StatutCible): Ton {
  switch (statut) {
    case "joint_ras":
    case "couvert_proche":
    case "couvert_passage":
      return "ok";
    case "joint_besoin":
    case "non_joint":
    case "messagerie":
    case "absent":
    case "escalade_humain":
      return "warn";
    case "danger":
    case "non_joint_a_traiter":
    case "numero_invalide":
    case "evacuation":
      return "err";
    default:
      return "neutre";
  }
}

/** Résultats proposés à la saisie d'une interaction hors campagne. */
export const RESULTATS_INTERACTION: StatutCible[] = [
  "joint_ras",
  "joint_besoin",
  "non_joint",
  "messagerie",
  "numero_invalide",
  "absent",
  "couvert_proche",
  "danger",
];
