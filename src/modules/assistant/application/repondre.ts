import type { MoteurStatistiques } from "@/modules/statistiques/application/ports";
import { executerRequete, listerPersonnes } from "@/modules/statistiques/application/explorer";
import { QUESTIONS_SUGGEREES } from "@/modules/statistiques/domain/analyseur";
import type { Referentiels } from "@/modules/statistiques/domain/requete";
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { APPEL_INCONNU, appelDepuisAnalyseur, cleQuestion, lireAppel, type AppelOutil } from "../domain/appel";
import {
  PERSONNES_AFFICHEES,
  reponseFiches,
  reponseIncomprise,
  reponseNombre,
  reponseNonAutorisee,
  reponsePersonnes,
  type PersonneListee,
  type ReponseAssistant,
} from "../domain/reponse";
import type { Annuaire, InterpretationsRepository, Interpreteur, JournalExports, SourceInterpretation } from "./ports";

export type DepsAssistant = {
  moteur: MoteurStatistiques;
  interpretations: InterpretationsRepository;
  /** null sans clé d'API : l'analyseur de mots-clés prend le relais. */
  interpreteur: Interpreteur | null;
  annuaire: Annuaire;
};

/** Nombre maximal de lignes d'un téléchargement Excel. */
export const LIMITE_EXPORT = 5000;

export { QUESTIONS_SUGGEREES };

/**
 * Trouve l'appel d'outil d'une question. Déterministe : une question déjà posée (même texte, à la casse,
 * aux accents et à la ponctuation près) rejoue l'appel enregistré, sans interroger l'IA.
 */
export async function interpreter(
  deps: Omit<DepsAssistant, "annuaire" | "moteur">,
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

/** Assistant : une question en français, une réponse chiffrée ou une liste, toujours la même pour la même question. */
export async function repondre(deps: DepsAssistant, ctx: Contexte, entree: { question: string }): Promise<ReponseAssistant> {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  const referentiels = await deps.moteur.referentiels(ctx.commune.id);
  const { appel } = await interpreter(deps, ctx, entree.question, referentiels);
  const moteur = { moteur: deps.moteur };

  switch (appel.outil) {
    case "compter": {
      const r = await executerRequete(moteur, ctx, { definition: appel.definition, masquerPetitsEffectifs: false, referentiels });
      return reponseNombre(appel.definition, r, referentiels);
    }
    case "lister_personnes": {
      if (!peut(ctx.utilisateur.role, "statistiques.nominatif")) return reponseNonAutorisee();
      const r = await listerPersonnes(moteur, ctx, { definition: appel.definition, limite: PERSONNES_AFFICHEES });
      return reponsePersonnes(appel.definition, r, referentiels, peut(ctx.utilisateur.role, "export"));
    }
    case "chercher_personne": {
      if (!peut(ctx.utilisateur.role, "fiches.lire")) return reponseNonAutorisee();
      return reponseFiches(appel.texte, await deps.annuaire.chercher(ctx.commune.id, appel.texte, aujourdhui(ctx.maintenant)));
    }
    case "inconnu":
      return reponseIncomprise(QUESTIONS_SUGGEREES);
  }
}

/** Téléchargement Excel d'une réponse « liste » : rejoue la même interprétation, sans limite d'affichage. */
export async function exporterPersonnes(
  deps: DepsAssistant & { journal: JournalExports },
  ctx: Contexte,
  entree: { question: string },
): Promise<{ personnes: PersonneListee[]; titre: string } | null> {
  exiger(ctx.utilisateur.role, "export");
  const referentiels = await deps.moteur.referentiels(ctx.commune.id);
  const { appel } = await interpreter(deps, ctx, entree.question, referentiels);
  if (appel.outil !== "lister_personnes") return null;
  const { personnes } = await listerPersonnes({ moteur: deps.moteur }, ctx, { definition: appel.definition, limite: LIMITE_EXPORT });
  await deps.journal.enregistrer(ctx.commune.id, ctx.utilisateur.id, { question: entree.question, nb: personnes.length });
  return { personnes, titre: entree.question };
}
