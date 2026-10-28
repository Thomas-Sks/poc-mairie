/**
 * Assemblage des cas d'usage du registre avec les adaptateurs Drizzle.
 *
 * Pour les autres modules (Alertes / Crise) :
 *   import { rechercherBeneficiaireIds, resoudreListe } from "@/modules/registre/infrastructure";
 *   const ids = await rechercherBeneficiaireIds(ctx, filtre); // ids dans l'ordre de priorité
 */
import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import type { Filtre } from "../domain/filtre";
import * as rechercher from "../application/rechercher-beneficiaire-ids";
import * as tableau from "../application/consulter-tableau";
import * as groupees from "../application/actions-groupees";
import * as appel from "../application/appel-rapide";
import * as listes from "../application/listes";
import * as vuesPresence from "../application/vues-presence";
import { actionsDrizzle, listesDrizzle, presencesDrizzle, referentielsDrizzle, registreDrizzle, vuesDrizzle } from "./depots-drizzle";

const deps = {
  registre: registreDrizzle,
  referentiels: referentielsDrizzle,
  actions: actionsDrizzle,
  listes: listesDrizzle,
  vues: vuesDrizzle,
  presences: presencesDrizzle,
};

type Entree<F extends (d: never, c: Contexte, e: never) => unknown> = Parameters<F>[2];

/** Ids des bénéficiaires correspondant au filtre (validé), dans l'ordre de priorité RG-02. */
export const rechercherBeneficiaireIds = (ctx: Contexte, filtre: Filtre | Record<string, unknown>) =>
  rechercher.rechercherBeneficiaireIds(deps, ctx, filtre);

/** Ids d'une liste enregistrée (dynamique : filtre réévalué ; figée : instantané). */
export const resoudreListe = (ctx: Contexte, listeId: string) => rechercher.resoudreListe(deps, ctx, listeId);

export const casDUsage = {
  rechercherBeneficiaireIds,
  resoudreListe,
  consulterTableau: (ctx: Contexte, e: Entree<typeof tableau.consulterTableau>) => tableau.consulterTableau(deps, ctx, e),
  consulterCarte: (ctx: Contexte, e: Entree<typeof tableau.consulterCarte>) => tableau.consulterCarte(deps, ctx, e),
  toutSelectionner: (ctx: Contexte, e: Entree<typeof tableau.toutSelectionner>) => tableau.toutSelectionner(deps, ctx, e),
  suggererVoies: (ctx: Contexte, recherche: string) => tableau.suggererVoies(deps, ctx, recherche),
  chargerReferentiels: (ctx: Contexte) => tableau.chargerReferentiels(deps, ctx),
  assigner: (ctx: Contexte, e: Entree<typeof groupees.assigner>) => groupees.assigner(deps, ctx, e),
  retirerAssignations: (ctx: Contexte, e: Entree<typeof groupees.retirerAssignations>) => groupees.retirerAssignations(deps, ctx, e),
  ajouterTag: (ctx: Contexte, e: Entree<typeof groupees.ajouterTag>) => groupees.ajouterTag(deps, ctx, e),
  changerStatut: (ctx: Contexte, e: Entree<typeof groupees.changerStatut>) => groupees.changerStatut(deps, ctx, e),
  exporterCsv: (ctx: Contexte, e: Entree<typeof groupees.exporterCsv>) => groupees.exporterCsv(deps, ctx, e),
  saisirAppel: (ctx: Contexte, e: Entree<typeof appel.saisirAppel>) => appel.saisirAppel(deps, ctx, e),
  commenterAppel: (ctx: Contexte, e: Entree<typeof appel.commenterAppel>) => appel.commenterAppel(deps, ctx, e),
  listerListes: (ctx: Contexte) => listes.listerListes(deps, ctx),
  consulterListe: (ctx: Contexte, id: string) => listes.consulterListe(deps, ctx, id),
  creerListe: (ctx: Contexte, e: Entree<typeof listes.creerListe>) => listes.creerListe(deps, ctx, e),
  renommerListe: (ctx: Contexte, e: Entree<typeof listes.renommerListe>) => listes.renommerListe(deps, ctx, e),
  supprimerListe: (ctx: Contexte, id: string) => listes.supprimerListe(deps, ctx, id),
  listerVues: (ctx: Contexte) => vuesPresence.listerVues(deps, ctx),
  enregistrerVue: (ctx: Contexte, e: Entree<typeof vuesPresence.enregistrerVue>) => vuesPresence.enregistrerVue(deps, ctx, e),
  supprimerVue: (ctx: Contexte, id: string) => vuesPresence.supprimerVue(deps, ctx, id),
  signalerPresence: (ctx: Contexte, ressource: string) => vuesPresence.signalerPresence(deps, ctx, ressource),
};
