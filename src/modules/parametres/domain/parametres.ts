/**
 * Paramètres de la commune (E13-US6, RG-01) — règles pures.
 */
import type { GrilleScore } from "@/shared/domain/priorite";
import type { Deplacement, NiveauPriorite } from "@/shared/domain/vocabulaire";

/** Même forme que `communes.parametres` en base. */
export type ParametresCommune = {
  grilleScore: GrilleScore;
};

type CleSimple = Exclude<keyof GrilleScore, "deplacement" | "seuilP1" | "seuilP2">;

/** Libellés des critères de la grille, dans l'ordre d'affichage. */
export const CRITERES_GRILLE: { cle: CleSimple; libelle: string }[] = [
  { cle: "vitSeul", libelle: "Vit seul(e)" },
  { cle: "age85", libelle: "85 ans et plus" },
  { cle: "age75", libelle: "75 à 84 ans" },
  { cle: "troublesCognitifs", libelle: "Troubles cognitifs" },
  { cle: "aucunProcheJoignable", libelle: "Aucun proche joignable" },
  { cle: "logementChaud", libelle: "Logement exposé (chaleur ou rez-de-chaussée)" },
  { cle: "aucunePriseEnCharge", libelle: "Aucune aide à domicile" },
  { cle: "retourHospitalisation", libelle: "Retour d'hospitalisation récent" },
  { cle: "pasDeTelephone", libelle: "Pas de téléphone" },
  { cle: "protection", libelle: "Mesure de protection" },
  { cle: "aucuneCle", libelle: "Personne ne possède les clés" },
];

/** Décret n° 2026-590 : aides transmises par le Département et les caisses de retraite. */
export const CRITERES_AIDES: { cle: CleSimple; libelle: string }[] = [
  { cle: "apaGir12", libelle: "APA, GIR 1 ou 2" },
  { cle: "apaGir34", libelle: "APA, GIR 3 ou 4" },
  { cle: "apaGir56", libelle: "APA, GIR 5-6 ou non précisé" },
  { cle: "pch", libelle: "PCH (handicap)" },
  { cle: "aideCaisseRetraite", libelle: "Aide de la caisse de retraite" },
];

export const CRITERES_DEPLACEMENT: { cle: Deplacement; libelle: string }[] = [
  { cle: "canne", libelle: "Se déplace avec une canne" },
  { cle: "deambulateur", libelle: "Se déplace avec un déambulateur" },
  { cle: "fauteuil", libelle: "En fauteuil roulant" },
  { cle: "immobilise", libelle: "Immobilisé(e)" },
];

const entre = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** Contrôles de cohérence de la grille. Renvoie la liste des problèmes (vide si valide). */
export function verifierGrille(g: GrilleScore): string[] {
  const erreurs: string[] = [];
  const points = [...CRITERES_GRILLE.map((c) => g[c.cle]), ...CRITERES_AIDES.map((c) => g[c.cle]), ...Object.values(g.deplacement)];
  if (!points.every((p) => entre(p, 0, 100))) erreurs.push("Chaque critère vaut entre 0 et 100 points.");
  if (!entre(g.seuilP2, 1, 100) || !entre(g.seuilP1, 1, 100)) erreurs.push("Les seuils sont compris entre 1 et 100.");
  if (g.seuilP1 <= g.seuilP2) erreurs.push("Le seuil P1 doit être supérieur au seuil P2.");
  return erreurs;
}

/** Un niveau forcé manuellement par un agent prime sur le niveau calculé (RG-01). */
export function niveauRetenu(calcule: NiveauPriorite, force: NiveauPriorite | null): NiveauPriorite {
  return force ?? calcule;
}

export class ParametresInvalides extends Error {
  constructor(public readonly erreurs: string[]) {
    super(erreurs.join(" "));
    this.name = "ParametresInvalides";
  }
}
