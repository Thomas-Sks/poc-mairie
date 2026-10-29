import type { MoteurStatistiques } from "@/modules/statistiques/application/ports";
import { executerRequete, listerPersonnes } from "@/modules/statistiques/application/explorer";
import { QUESTIONS_SUGGEREES } from "@/modules/statistiques/domain/analyseur";
import type { Referentiels } from "@/modules/statistiques/domain/requete";
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { APPEL_INCONNU, appelDepuisAnalyseur, cleQuestion, lireAppel, type AppelOutil } from "../domain/appel";
import { reponseChiffre, reponseIncomprise, reponseNonAutorisee, reponsePersonnes, type ReponseRegistre } from "../domain/reponse";
import type { InterpretationsRepository, Interpreteur, SourceInterpretation } from "./ports";

export type DepsAssistant = {
  moteur: MoteurStatistiques;
  interpretations: InterpretationsRepository;
  /** null sans clé d'API : l'analyseur de mots-clés prend le relais. */
  interpreteur: Interpreteur | null;
};

/** Trois mots au plus, sans point d'interrogation : « Vasseur », « Simone Duval », « rue du Marais ». */
const estCourt = (question: string) => !question.includes("?") && question.trim().split(/\s+/).length <= 3;

/** Plafond de fiches renvoyées pour filtrer le tableau (au-delà, la commune dépasse largement le POC). */
const LIMITE_FICHES = 20_000;

export { QUESTIONS_SUGGEREES };

/**
 * Trouve l'appel d'outil d'une question. Déterministe : une question déjà posée (même texte, à la casse,
 * aux accents et à la ponctuation près) rejoue l'appel enregistré, sans interroger l'IA.
 */
export async function interpreter(
  deps: Omit<DepsAssistant, "moteur">,
  ctx: Contexte,
  question: string,
  referentiels: Referentiels,
): Promise<{ appel: AppelOutil; source: SourceInterpretation }> {
  const cle = cleQuestion(question);
  if (!cle) return { appel: APPEL_INCONNU, source: "analyseur" };

  const enregistre = await deps.interpretations.trouver(ctx.commune.id, cle);
  const relu = enregistre && lireAppel(enregistre.appel);
  if (enregistre && relu) return { appel: relu, source: enregistre.source };

  let appel: AppelOutil | null = null;
  let source: SourceInterpretation = "ia";
  if (deps.interpreteur) {
    try {
      const brut = await deps.interpreteur.interpreter(question, { referentiels, jour: aujourdhui(ctx.maintenant) });
      appel = brut === null ? APPEL_INCONNU : lireAppel(brut);
    } catch {
      appel = null; // service indisponible : on se rabat sur l'analyseur, sans rien figer
    }
  }
  if (!appel) {
    appel = appelDepuisAnalyseur(question, referentiels);
    source = "analyseur";
  }
  // Une incompréhension de l'analyseur n'est pas figée : l'IA pourra peut-être répondre plus tard.
  if (source === "ia" || appel.outil !== "inconnu") await deps.interpretations.enregistrer(ctx.commune.id, cle, appel, source);
  return { appel, source };
}

/**
 * Question posée dans le registre (page Bénéficiaires). Une question sur des personnes filtre le tableau et la carte ;
 * une question chiffrée sur autre chose (appels, inscriptions…) répond en une ligne ; un nom devient une recherche.
 * Toujours la même réponse pour la même question.
 */
export async function interrogerRegistre(deps: DepsAssistant, ctx: Contexte, entree: { question: string }): Promise<ReponseRegistre> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const referentiels = await deps.moteur.referentiels(ctx.commune.id);
  const { appel } = await interpreter(deps, ctx, entree.question, referentiels);
  const moteur = { moteur: deps.moteur };

  switch (appel.outil) {
    case "chercher_personne":
      return { type: "recherche", texte: appel.texte };
    case "inconnu":
      // Quelques mots sans critère reconnu : c'est un nom ou une adresse, on les cherche dans le registre.
      return estCourt(entree.question) ? { type: "recherche", texte: entree.question.trim() } : reponseIncomprise(QUESTIONS_SUGGEREES);
    case "compter":
    case "lister_personnes": {
      const definition = appel.definition;
      const chiffres = await executerRequete(moteur, ctx, { definition, masquerPetitsEffectifs: false, referentiels });
      if (definition.sujet !== "beneficiaires") return reponseChiffre(definition, chiffres, referentiels);
      if (!peut(ctx.utilisateur.role, "statistiques.nominatif")) return reponseNonAutorisee();
      const { personnes } = await listerPersonnes(moteur, ctx, { definition: { ...definition, decoupage: null }, limite: LIMITE_FICHES });
      return reponsePersonnes(definition, chiffres, personnes.map((p) => p.id), referentiels);
    }
  }
}
