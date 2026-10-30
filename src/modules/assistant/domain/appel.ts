/**
 * Assistant : ce que l'on demande au moteur pour répondre à une question.
 * L'IA (ou, à défaut, l'analyseur de mots-clés) ne fait que choisir un de ces appels ; l'application l'exécute
 * et met la réponse en forme elle-même. Une question déjà posée rejoue exactement le même appel.
 */
import { z } from "zod";
import { analyserQuestion, normaliser, type AnalyseQuestion } from "@/modules/statistiques/domain/analyseur";
import { estSujetPersonne } from "@/modules/statistiques/domain/catalogue";
import { schemaDefinition, type DefinitionRequete, type Referentiels } from "@/modules/statistiques/domain/requete";

export const OUTILS = ["compter", "lister_personnes", "chercher_personne", "inconnu"] as const;
export type Outil = (typeof OUTILS)[number];

export const schemaAppel = z.discriminatedUnion("outil", [
  z.object({ outil: z.literal("compter"), definition: schemaDefinition }),
  z.object({
    outil: z.literal("lister_personnes"),
    definition: schemaDefinition.refine((d) => estSujetPersonne(d.sujet), "Seules des personnes peuvent être listées."),
  }),
  z.object({ outil: z.literal("chercher_personne"), texte: z.string().trim().min(2).max(80) }),
  z.object({ outil: z.literal("inconnu") }),
]);
export type AppelOutil = z.infer<typeof schemaAppel>;

export const APPEL_INCONNU: AppelOutil = { outil: "inconnu" };

/** Clé de la question : minuscules, sans accents ni ponctuation. « Combien de P1 ? » = « combien de p1 ». */
export function cleQuestion(question: string): string {
  return normaliser(question)
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RECHERCHE = /^(?:(?:ouvr(?:e|ir)|montre(?:r)?|affiche(?:r)?) (?:la )?fiche (?:de )?|fiche (?:de )?|(?:trouve(?:r)?|cherche(?:r)?) |ou habite )(?:m |mr |mme |madame |monsieur )?(.{2,})$/;
const LISTE = /^(?:liste|lister|qui sont|qui est|quel(?:le)?s? (?:sont les )?personnes|donne(?:z)?(?: moi)? (?:la liste|les)|affiche(?:r)? les|montre(?:r)? les|exporte(?:r)?)\b|\bliste des\b/;

/** Interprétation sans IA (mots-clés) : utilisée sans clé d'API ou si le service ne répond pas. */
export function appelDepuisAnalyseur(question: string, referentiels: Referentiels): AppelOutil {
  const cle = cleQuestion(question);
  const recherche = cle.match(RECHERCHE);
  if (recherche) return { outil: "chercher_personne", texte: recherche[1].trim() };
  const analyse: AnalyseQuestion = analyserQuestion(question, referentiels);
  if (analyse.vide) return APPEL_INCONNU;
  if (LISTE.test(cle)) return { outil: "lister_personnes", definition: versPersonnes(analyse.definition) };
  return { outil: "compter", definition: analyse.definition };
}

/** Une liste porte sur les personnes : on garde les filtres, sans découpage ni graphique. */
function versPersonnes(d: DefinitionRequete): DefinitionRequete {
  return { ...d, sujet: estSujetPersonne(d.sujet) ? d.sujet : "beneficiaires", decoupage: null, graphique: null, comparaison: null };
}

/** Lecture tolérante d'un appel (cache ou réponse de l'IA) : null s'il n'est pas valide. */
export function lireAppel(brut: unknown): AppelOutil | null {
  const r = schemaAppel.safeParse(brut);
  return r.success ? r.data : null;
}
