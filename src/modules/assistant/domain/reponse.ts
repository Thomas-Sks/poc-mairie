/**
 * Mise en forme des réponses de l'assistant, entièrement par gabarits : l'IA n'écrit jamais le texte affiché.
 * Même appel + mêmes données = même réponse, mot pour mot.
 */
import { DECOUPAGES, SUJET_LIBELLES, SUJET_UNITES } from "@/modules/statistiques/domain/catalogue";
import { decrirePeriode } from "@/modules/statistiques/domain/periodes";
import { decrireFiltre, type DefinitionRequete, type Referentiels } from "@/modules/statistiques/domain/requete";
import { formaterEffectif, type ResultatAffiche } from "@/modules/statistiques/domain/secret";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";

/** Nombre maximal de personnes affichées dans une réponse (le téléchargement Excel les contient toutes). */
export const PERSONNES_AFFICHEES = 200;

export type PersonneListee = {
  id: string;
  civilite: string;
  nom: string;
  prenom: string;
  age: number;
  adresse: string;
  telephone: string | null;
  priorite: NiveauPriorite;
};

export type LigneChiffree = { libelle: string; effectif: string; part: number };

export type ReponseAssistant =
  | { type: "nombre"; compris: string[]; phrase: string; lignes: LigneChiffree[] }
  | { type: "personnes"; compris: string[]; phrase: string; personnes: PersonneListee[]; total: number; telechargeable: boolean }
  | { type: "fiches"; phrase: string; personnes: PersonneListee[] }
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

export function reponseNombre(d: DefinitionRequete, r: ResultatAffiche, referentiels: Referentiels): ReponseAssistant {
  const unite = SUJET_UNITES[d.sujet];
  const total = r.total === null ? `${formaterEffectif(null)} ${unite[1]}` : `${formaterEffectif(r.total)} ${pluriel(r.total, unite)}`;
  const max = Math.max(1, ...r.lignes.map((l) => l.n ?? 0));
  return {
    type: "nombre",
    compris: decrireCompris(d, referentiels),
    phrase: total,
    lignes: r.lignes.map((l) => ({ libelle: l.libelle, effectif: formaterEffectif(l.n), part: (l.n ?? 0) / max })),
  };
}

export function reponsePersonnes(
  d: DefinitionRequete,
  resultat: { total: number; personnes: PersonneListee[] },
  referentiels: Referentiels,
  telechargeable: boolean,
): ReponseAssistant {
  const { total, personnes } = resultat;
  const phrase =
    total === 0
      ? "Aucune personne ne correspond."
      : total > personnes.length
        ? `${total.toLocaleString("fr-FR")} personnes. Les ${personnes.length} premières sont affichées ci-dessous.`
        : `${total.toLocaleString("fr-FR")} ${pluriel(total, ["personne", "personnes"])}.`;
  return { type: "personnes", compris: decrireCompris(d, referentiels), phrase, personnes, total, telechargeable: telechargeable && total > 0 };
}

export function reponseFiches(texte: string, personnes: PersonneListee[]): ReponseAssistant {
  return {
    type: "fiches",
    phrase:
      personnes.length === 0
        ? `Je ne trouve personne au nom de « ${texte} ».`
        : `${personnes.length} ${pluriel(personnes.length, ["fiche trouvée", "fiches trouvées"])} pour « ${texte} ».`,
    personnes,
  };
}

export const reponseIncomprise = (suggestions: readonly string[]): ReponseAssistant => ({
  type: "message",
  phrase: "Je ne sais pas encore répondre à cette question. Essayez par exemple :",
  suggestions,
});

export const reponseNonAutorisee = (): ReponseAssistant => ({
  type: "message",
  phrase: "Votre compte ne permet pas d'afficher la liste nominative des personnes. Vous pouvez demander « Combien… ».",
  suggestions: [],
});
