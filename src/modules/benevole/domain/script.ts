/**
 * E10-US4 bis : rendu du script d'appel avec les variables injectées automatiquement.
 * Variables reconnues : {civilite} {nom} {prenom} {prenomAppelant} {structure} {commune}.
 */
import type { StatutCible } from "@/shared/domain/vocabulaire";
import type { Question } from "./questions";

/** Script tel que le lit le bénévole (même forme que le script copié dans la campagne). */
export type ScriptAppel = {
  introduction: string;
  questions: Question[];
  encart: { titre: string; items: string[] } | null;
  conclusion: string;
  boutonsSpecifiques: { libelle: string; consigne: string; statut: StatutCible }[];
  numerosUtiles: { libelle: string; numero: string }[];
};

export type VariablesScript = {
  civilite: string;
  nom: string;
  prenom: string;
  prenomAppelant: string;
  structure: string;
  commune: string;
};

const VARIABLE = /\{(\w+)\}/g;

/** Accorde les marques inclusives « inscrit(e) » selon la civilité : « inscrite » pour Mme, « inscrit » sinon. */
export function accorder(texte: string, civilite: string): string {
  const feminin = civilite === "Mme";
  return texte.replace(/(\p{L})\(e\)/gu, (_, lettre: string) => (feminin ? `${lettre}e` : lettre));
}

/**
 * Remplace chaque variable connue (une variable inconnue est laissée telle quelle, visible à la relecture),
 * puis accorde le texte au genre de la personne appelée.
 */
export function rendreTexte(modele: string, variables: VariablesScript): string {
  const texte = modele.replace(VARIABLE, (brut, cle: string) =>
    Object.hasOwn(variables, cle) ? variables[cle as keyof VariablesScript] : brut,
  );
  return accorder(texte, variables.civilite);
}

/** Nom tel qu'on le prononce : « Dupont » plutôt que « DUPONT ». */
export function nomPrononce(nom: string): string {
  return nom
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase("fr-FR"));
}
