/**
 * Mise en forme des réponses de l'assistant, entièrement par gabarits : l'IA n'écrit jamais le texte affiché.
 * Même appel + mêmes données = même réponse, mot pour mot.
 */
import { DECOUPAGES, SUJET_LIBELLES, SUJET_UNITES } from "@/modules/statistiques/domain/catalogue";
import { decrirePeriode } from "@/modules/statistiques/domain/periodes";
import { decrireFiltre, type DefinitionRequete, type Referentiels } from "@/modules/statistiques/domain/requete";
import { formaterEffectif, type ResultatAffiche } from "@/modules/statistiques/domain/secret";

export type LigneChiffree = { libelle: string; effectif: string; part: number };

/**
 * Réponse affichée au-dessus du tableau des bénéficiaires.
 * - `personnes` : le tableau et la carte se limitent à ces fiches (on y exporte, assigne, appelle) ;
 * - `chiffre` : un total (et sa répartition) sur autre chose que des personnes (appels, inscriptions…) ;
 * - `recherche` : la question est un nom ou une adresse, elle devient une simple recherche ;
 * - `message` : question incomprise ou non autorisée.
 */
export type ReponseRegistre =
  | { type: "personnes"; ids: string[]; phrase: string; compris: string[]; lignes: LigneChiffree[] }
  | { type: "chiffre"; phrase: string; compris: string[]; lignes: LigneChiffree[] }
  | { type: "recherche"; texte: string }
  | { type: "message"; phrase: string; suggestions: readonly string[] };

const pluriel = (n: number, [un, plusieurs]: readonly [string, string]) => (n <= 1 ? un : plusieurs);

/** « Ce que j'ai compris » : les filtres, le découpage et la période, en mots simples. */
export function decrireCompris(d: DefinitionRequete, r: Referentiels): string[] {
  const puces: string[] = [];
  if (d.sujet !== "beneficiaires") puces.push(SUJET_LIBELLES[d.sujet]);
  for (const f of d.filtres) puces.push(decrireFiltre(f, r));
  if (d.decoupage) puces.push(`Par ${DECOUPAGES[d.decoupage].libelle.toLocaleLowerCase("fr-FR")}`);
  if (d.periode) puces.push(decrirePeriode(d.periode).replace(/^du/, "Du"));
  return puces;
}

/** Total (« 12 personnes », « < 5 appels ») et répartition, secret statistique déjà appliqué. */
export function chiffrer(d: DefinitionRequete, r: ResultatAffiche): { phrase: string; lignes: LigneChiffree[] } {
  const unite = SUJET_UNITES[d.sujet];
  const phrase = r.total === null ? `${formaterEffectif(null)} ${unite[1]}` : `${formaterEffectif(r.total)} ${pluriel(r.total, unite)}`;
  const max = Math.max(1, ...r.lignes.map((l) => l.n ?? 0));
  return { phrase, lignes: r.lignes.map((l) => ({ libelle: l.libelle, effectif: formaterEffectif(l.n), part: (l.n ?? 0) / max })) };
}

export function reponsePersonnes(d: DefinitionRequete, r: ResultatAffiche, ids: string[], referentiels: Referentiels): ReponseRegistre {
  return { type: "personnes", ids, compris: decrireCompris(d, referentiels), ...chiffrer(d, r) };
}

export function reponseChiffre(d: DefinitionRequete, r: ResultatAffiche, referentiels: Referentiels): ReponseRegistre {
  return { type: "chiffre", compris: decrireCompris(d, referentiels), ...chiffrer(d, r) };
}

export const reponseIncomprise = (suggestions: readonly string[]): ReponseRegistre => ({
  type: "message",
  phrase: "Je ne sais pas encore répondre à cette question. Essayez par exemple :",
  suggestions,
});

export const reponseNonAutorisee = (): ReponseRegistre => ({
  type: "message",
  phrase: "Votre compte ne permet pas d'afficher la liste nominative des personnes.",
  suggestions: [],
});
