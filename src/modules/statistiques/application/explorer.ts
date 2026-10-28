import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { AccesRefuse, exiger, peut } from "@/shared/domain/permissions";
import { estSujetPersonne } from "../domain/catalogue";
import type { DefinitionRequete, Referentiels } from "../domain/requete";
import { construireResultat } from "../domain/resultat";
import { appliquerSecret, secretApplicable, type ResultatAffiche } from "../domain/secret";
import type { MoteurStatistiques, PersonneTrouvee, RequeteRepository } from "./ports";

type DepsMoteur = { moteur: MoteurStatistiques };

export const aDroitNominatif = (ctx: Contexte) => peut(ctx.utilisateur.role, "statistiques.nominatif");

/** E12-US1 / US5 / US7 : exécute une requête ; le secret statistique est appliqué ici, côté serveur. */
export async function executerRequete(
  deps: DepsMoteur,
  ctx: Contexte,
  entree: { definition: DefinitionRequete; masquerPetitsEffectifs: boolean; referentiels?: Referentiels },
): Promise<ResultatAffiche> {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  const d = entree.definition;
  const reference = aujourdhui(ctx.maintenant);
  const [brut, brutComparaison, referentiels] = await Promise.all([
    deps.moteur.compter(ctx.commune.id, d, d.periode, reference),
    d.comparaison ? deps.moteur.compter(ctx.commune.id, d, d.comparaison, reference) : Promise.resolve(null),
    entree.referentiels ? Promise.resolve(entree.referentiels) : deps.moteur.referentiels(ctx.commune.id),
  ]);
  const resultat = construireResultat(d, brut, brutComparaison, referentiels);
  return appliquerSecret(resultat, secretApplicable(aDroitNominatif(ctx), entree.masquerPetitsEffectifs));
}

/** Liste nominative des personnes correspondantes : réservée au droit `statistiques.nominatif`. */
export async function listerPersonnes(
  deps: DepsMoteur,
  ctx: Contexte,
  definition: DefinitionRequete,
): Promise<{ total: number; personnes: PersonneTrouvee[] }> {
  exiger(ctx.utilisateur.role, "statistiques.nominatif");
  if (!estSujetPersonne(definition.sujet)) throw new AccesRefuse("statistiques.nominatif");
  return deps.moteur.personnes(ctx.commune.id, definition, aujourdhui(ctx.maintenant), 200);
}

export async function obtenirReferentiels(deps: DepsMoteur, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  return deps.moteur.referentiels(ctx.commune.id);
}

export async function obtenirQuartiers(deps: DepsMoteur, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  return deps.moteur.quartiers(ctx.commune.id);
}

// ─── Requêtes enregistrées ────────────────────────────────────────────────────

type DepsRequetes = { requetes: RequeteRepository };

export async function listerRequetes(deps: DepsRequetes, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  return deps.requetes.lister(ctx.commune.id);
}

export async function obtenirRequete(deps: DepsRequetes, ctx: Contexte, id: string) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  return deps.requetes.obtenir(ctx.commune.id, id);
}

export async function enregistrerRequete(deps: DepsRequetes, ctx: Contexte, entree: { nom: string; definition: DefinitionRequete }) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  return deps.requetes.creer(ctx.commune.id, ctx.utilisateur.id, entree.nom, entree.definition);
}

export async function supprimerRequete(deps: DepsRequetes, ctx: Contexte, id: string) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  await deps.requetes.supprimer(ctx.commune.id, id);
}
