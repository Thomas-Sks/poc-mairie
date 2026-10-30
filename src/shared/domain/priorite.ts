/**
 * RG-01 — Score de priorité (0-100) et niveaux P1/P2/P3.
 * Fonction pure : aucune dépendance à la base. Les pondérations sont paramétrables par commune.
 */
import type { Deplacement, ModeDeVie, NiveauPriorite, Protection, TypeAlerte } from "./vocabulaire";

export type GrilleScore = {
  vitSeul: number;
  age85: number;
  age75: number;
  deplacement: Record<Deplacement, number>;
  protection: number;
  aucuneCle: number;
  troublesCognitifs: number;
  aucunProcheJoignable: number;
  logementChaud: number;
  aucunePriseEnCharge: number;
  retourHospitalisation: number;
  pasDeTelephone: number;
  /** Décret n° 2026-590 : APA selon le GIR (GIR inconnu = GIR 5-6), PCH, aide de la caisse de retraite. */
  apaGir12: number;
  apaGir34: number;
  apaGir56: number;
  pch: number;
  aideCaisseRetraite: number;
  seuilP1: number;
  seuilP2: number;
};

export const GRILLE_PAR_DEFAUT: GrilleScore = {
  vitSeul: 20,
  age85: 15,
  age75: 8,
  deplacement: { seul: 0, canne: 5, deambulateur: 10, fauteuil: 15, immobilise: 20 },
  protection: 5,
  aucuneCle: 5,
  troublesCognitifs: 15,
  aucunProcheJoignable: 15,
  logementChaud: 10,
  aucunePriseEnCharge: 10,
  retourHospitalisation: 10,
  pasDeTelephone: 10,
  apaGir12: 15,
  apaGir34: 10,
  apaGir56: 5,
  pch: 10,
  aideCaisseRetraite: 5,
  seuilP1: 60,
  seuilP2: 30,
};

/** Complète une grille enregistrée avant l'ajout de nouveaux critères. */
export function completerGrille(g: Partial<GrilleScore> | null | undefined): GrilleScore {
  return { ...GRILLE_PAR_DEFAUT, ...g, deplacement: { ...GRILLE_PAR_DEFAUT.deplacement, ...g?.deplacement } };
}

/** Faits utiles au calcul, extraits de la fiche, du foyer, du cercle et des prises en charge. */
export type FaitsPriorite = {
  age: number;
  modeDeVie: ModeDeVie | null;
  deplacement: Deplacement | null;
  protection: Protection | null;
  troublesCognitifs: boolean;
  quelquUnPossedeLesCles: boolean;
  aUnProcheJoignable: boolean;
  sousLesToits: boolean;
  pieceFraiche: boolean | null;
  rezDeChaussee: boolean;
  nbPrisesEnChargeADomicile: number;
  retourHospitalisationRecent: boolean;
  pasDeTelephone: boolean;
  /** null : pas d'APA ; sinon le GIR connu (ou null s'il n'est pas renseigné). */
  apa: { gir: number | null } | null;
  pch: boolean;
  aideCaisseRetraite: boolean;
};

export type CritereApplique = { critere: string; points: number };

export type ResultatScore = {
  score: number;
  niveau: NiveauPriorite;
  criteres: CritereApplique[];
};

export function niveauDepuisScore(score: number, grille: GrilleScore = GRILLE_PAR_DEFAUT): NiveauPriorite {
  if (score >= grille.seuilP1) return "P1";
  if (score >= grille.seuilP2) return "P2";
  return "P3";
}

/**
 * Le score dépend du type d'alerte : le logement sous les toits compte en canicule,
 * le rez-de-chaussée compte en inondation. Sans alerte, on applique la grille « canicule »
 * (risque saisonnier principal du registre).
 */
export function calculerScore(
  faits: FaitsPriorite,
  grille: GrilleScore = GRILLE_PAR_DEFAUT,
  typeAlerte: TypeAlerte = "canicule",
): ResultatScore {
  const criteres: CritereApplique[] = [];
  const ajouter = (critere: string, points: number) => {
    if (points > 0) criteres.push({ critere, points });
  };

  if (faits.modeDeVie === "seul") ajouter("Vit seul(e)", grille.vitSeul);
  if (faits.age >= 85) ajouter("85 ans et plus", grille.age85);
  else if (faits.age >= 75) ajouter("75 à 84 ans", grille.age75);
  if (faits.deplacement) ajouter("Mobilité réduite dans le domicile", grille.deplacement[faits.deplacement]);
  if (faits.protection && faits.protection !== "non") ajouter("Mesure de protection", grille.protection);
  if (!faits.quelquUnPossedeLesCles) ajouter("Personne ne possède les clés", grille.aucuneCle);
  if (faits.troublesCognitifs) ajouter("Troubles cognitifs", grille.troublesCognitifs);
  if (!faits.aUnProcheJoignable) ajouter("Aucun proche joignable", grille.aucunProcheJoignable);

  if (typeAlerte === "inondation") {
    if (faits.rezDeChaussee) ajouter("Logement en rez-de-chaussée", grille.logementChaud);
  } else if (typeAlerte === "canicule") {
    if (faits.sousLesToits || faits.pieceFraiche === false) ajouter("Logement chaud (sous les toits ou sans pièce fraîche)", grille.logementChaud);
  }

  if (faits.nbPrisesEnChargeADomicile === 0) ajouter("Aucune aide à domicile", grille.aucunePriseEnCharge);
  if (faits.retourHospitalisationRecent) ajouter("Retour d'hospitalisation récent", grille.retourHospitalisation);
  if (faits.pasDeTelephone) ajouter("Pas de téléphone (visite nécessaire)", grille.pasDeTelephone);

  if (faits.apa) {
    const gir = faits.apa.gir;
    if (gir !== null && gir <= 2) ajouter("APA, GIR 1 ou 2", grille.apaGir12);
    else if (gir !== null && gir <= 4) ajouter("APA, GIR 3 ou 4", grille.apaGir34);
    else ajouter("APA, GIR 5-6 ou non précisé", grille.apaGir56);
  }
  if (faits.pch) ajouter("PCH (handicap)", grille.pch);
  if (faits.aideCaisseRetraite) ajouter("Aide de la caisse de retraite", grille.aideCaisseRetraite);

  const score = Math.min(100, criteres.reduce((total, c) => total + c.points, 0));
  return { score, niveau: niveauDepuisScore(score, grille), criteres };
}
