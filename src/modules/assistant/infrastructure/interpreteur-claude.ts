import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  CHAMP_IDS,
  CHAMPS,
  DECOUPAGE_IDS,
  DECOUPAGES,
  OPERATEUR_LIBELLES,
  OPERATEURS,
  SUJET_LIBELLES,
  SUJETS,
} from "@/modules/statistiques/domain/catalogue";
import { optionsDuChamp, type Referentiels } from "@/modules/statistiques/domain/requete";
import type { Interpreteur } from "../application/ports";

/**
 * Function calling avec Claude : le modèle choisit un outil et ses paramètres, rien d'autre.
 * L'application valide l'appel (Zod), l'exécute et rédige la réponse avec ses propres gabarits.
 */
const MODELE = "claude-opus-5-5";

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const FILTRES = {
  type: "array",
  description: "Critères, tous combinés (ET). Tableau vide si la question n'en donne aucun.",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["champ", "operateur", "valeur"],
    properties: {
      champ: { type: "string", enum: CHAMP_IDS },
      operateur: { type: "string", enum: OPERATEURS },
      valeur: { type: "string", description: "Une valeur autorisée pour ce champ (voir la liste dans les consignes)." },
    },
  },
};

const PERIODE = nullable({
  type: "object",
  additionalProperties: false,
  required: ["du", "au"],
  properties: { du: { type: "string", description: "AAAA-MM-JJ" }, au: { type: "string", description: "AAAA-MM-JJ" } },
});

const OUTILS: Anthropic.Beta.BetaTool[] = [
  {
    name: "compter",
    description: "Compter des personnes, des appels, des interactions, des inscriptions ou des rappels (« combien… »), éventuellement découpé (« par quartier »).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["sujet", "filtres", "decoupage", "periode"],
      properties: {
        sujet: { type: "string", enum: SUJETS },
        filtres: FILTRES,
        decoupage: nullable({ type: "string", enum: DECOUPAGE_IDS }),
        periode: PERIODE,
      },
    },
  },
  {
    name: "lister_personnes",
    description: "Donner la liste nominative des personnes suivies qui correspondent aux critères (« liste des… », « qui sont… »), pour l'afficher ou l'exporter.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["filtres"], properties: { filtres: FILTRES } },
  },
  {
    name: "chercher_personne",
    description: "Retrouver la fiche d'une personne précise à partir de son nom (ou de sa rue).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["texte"],
      properties: { texte: { type: "string", description: "Nom, prénom et nom, ou nom de rue." } },
    },
  },
];

/** Vocabulaire du registre, généré depuis le catalogue : la seule source des champs et valeurs autorisés. */
function consignes(referentiels: Referentiels): string {
  const champs = CHAMP_IDS.map((id) => {
    const c = CHAMPS[id];
    const sujets = c.sujets.join(", ");
    const operateurs = c.operateurs.join(", ");
    const valeurs =
      c.type === "oui_non"
        ? '"oui" ou "non"'
        : c.type === "nombre"
          ? `nombre entier${c.unite ? ` (en ${c.unite})` : ""}`
          : optionsDuChamp(id, referentiels)
              .map((o) => `"${o.valeur}" (${o.libelle})`)
              .join(", ");
    return `- ${id} : ${c.libelle}. Sujets : ${sujets}. Opérateurs : ${operateurs}. Valeurs : ${valeurs}.`;
  }).join("\n");
  const decoupages = DECOUPAGE_IDS.map((id) => `- ${id} : ${DECOUPAGES[id].libelle} (sujets : ${DECOUPAGES[id].sujets.join(", ")})`).join("\n");
  const sujets = SUJETS.map((s) => `- ${s} : ${SUJET_LIBELLES[s]}`).join("\n");
  const operateurs = OPERATEURS.map((o) => `- ${o} : ${OPERATEUR_LIBELLES[o].liste}`).join("\n");

  return `Tu traduis les questions des agents d'un CCAS (registre des personnes vulnérables) en un appel d'outil.
Appelle toujours exactement un outil, avec uniquement des champs et des valeurs de la liste ci-dessous. N'écris aucun texte.
Si la question ne porte pas sur le registre, ou si aucun champ ne permet d'y répondre, n'appelle aucun outil et réponds seulement « inconnu ».

Conventions :
- « plus de 80 ans », « au moins 80 ans », « 80 ans et plus » : age, sup_egal, "80". « moins de 70 ans » : age, inf_egal, "69".
- « vit seul(e) », « isolé(e) » : mode_de_vie est "seul". « forte difficulté de mobilité » : mobilite est "forte_difficulte".
- « touche l'APA », « bénéficiaire de l'APA » : prise_en_charge est "apa" (de même pour la PCH : "pch").
- « P1 », « très prioritaire » : priorite est "P1".
- Une période relative se calcule à partir de la date du jour donnée dans le message.

Sujets :
${sujets}

Opérateurs :
${operateurs}

Champs :
${champs}

Découpages :
${decoupages}`;
}

type EntreeOutil = { filtres?: unknown; sujet?: unknown; decoupage?: unknown; periode?: unknown; texte?: unknown };

/** Réponse de l'outil → appel au format de l'application (encore à valider). */
function versAppel(nom: string, e: EntreeOutil): unknown {
  switch (nom) {
    case "compter":
      return { outil: "compter", definition: { sujet: e.sujet, filtres: e.filtres, decoupage: e.decoupage, periode: e.periode, comparaison: null, graphique: null } };
    case "lister_personnes":
      return { outil: "lister_personnes", definition: { sujet: "beneficiaires", filtres: e.filtres, decoupage: null, periode: null, comparaison: null, graphique: null } };
    case "chercher_personne":
      return { outil: "chercher_personne", texte: e.texte };
    default:
      return null;
  }
}

export function interpreteurClaude(client: Anthropic): Interpreteur {
  return {
    async interpreter(question, { referentiels, jour }) {
      const reponse = await client.beta.messages.create({
        model: MODELE,
        max_tokens: 4096,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: consignes(referentiels), cache_control: { type: "ephemeral" } }],
        tools: OUTILS,
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: `Date du jour : ${jour}.\nQuestion : ${question}` }],
      });
      if (reponse.stop_reason === "refusal") return null;
      const outil = reponse.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      return outil ? versAppel(outil.name, outil.input as EntreeOutil) : null;
    },
  };
}

/** Interpréteur Claude si une clé d'API est configurée, sinon null (l'analyseur de mots-clés répond seul). */
export function creerInterpreteur(): Interpreteur | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return interpreteurClaude(new Anthropic());
}
