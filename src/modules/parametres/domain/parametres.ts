/**
 * Paramètres de la commune (E13-US6, RG-01, RG-04, E4-US1, E1-US5) — règles pures.
 */
import type { ParametresRelance } from "@/shared/domain/campagne";
import type { GrilleScore } from "@/shared/domain/priorite";
import type { Deplacement, NiveauPriorite } from "@/shared/domain/vocabulaire";

export type TextesRgpd = { responsable: string; conservation: string; dpo: string; droits: string };

/** Même forme que `communes.parametres` en base. */
export type ParametresCommune = {
  grilleScore: GrilleScore;
  relance: ParametresRelance;
  anniversaireJoursAvant: number;
  verificationMois: number;
  rgpd: TextesRgpd;
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
  const points = [...CRITERES_GRILLE.map((c) => g[c.cle]), ...Object.values(g.deplacement)];
  if (!points.every((p) => entre(p, 0, 100))) erreurs.push("Chaque critère vaut entre 0 et 100 points.");
  if (!entre(g.seuilP2, 1, 100) || !entre(g.seuilP1, 1, 100)) erreurs.push("Les seuils sont compris entre 1 et 100.");
  if (g.seuilP1 <= g.seuilP2) erreurs.push("Le seuil P1 doit être supérieur au seuil P2.");
  return erreurs;
}

/** Ajuste la liste des délais au nombre de tentatives (un délai avant chaque tentative après la première). */
export function ajusterDelais(nbTentatives: number, delais: number[]): number[] {
  const n = Math.max(0, nbTentatives - 1);
  const dernier = delais.at(-1) ?? 60;
  return Array.from({ length: n }, (_, i) => delais[i] ?? dernier);
}

export function verifierRelance(r: ParametresRelance, anniversaireJoursAvant: number, verificationMois: number): string[] {
  const erreurs: string[] = [];
  if (!entre(r.nbTentatives, 1, 5)) erreurs.push("Le nombre de tentatives est compris entre 1 et 5.");
  if (r.delaisMinutes.length !== Math.max(0, r.nbTentatives - 1)) erreurs.push("Indiquez un délai avant chaque nouvelle tentative.");
  if (!r.delaisMinutes.every((d) => entre(d, 5, 1440))) erreurs.push("Chaque délai est compris entre 5 minutes et 24 heures.");
  if (!/^\d{2}:\d{2}$/.test(r.plageDebut) || !/^\d{2}:\d{2}$/.test(r.plageFin) || r.plageDebut >= r.plageFin)
    erreurs.push("La plage horaire d'appel doit commencer avant de finir.");
  if (!entre(anniversaireJoursAvant, 0, 30)) erreurs.push("Le rappel d'anniversaire se fait entre 0 et 30 jours avant.");
  if (!entre(verificationMois, 1, 60)) erreurs.push("La durée avant revérification est comprise entre 1 et 60 mois.");
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
