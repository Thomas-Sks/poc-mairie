/**
 * Cas d'usage du module Crise. Versions câblées (dépendances injectées) : `@/modules/crise/infrastructure`.
 */
export {
  enregistrerResultatAppel,
  prendreVerrou,
  libererVerrou,
  ouvrirFicheAppel,
  VerrouPris,
  type EntreeResultatAppel,
  type ResultatEnregistrement,
  type ResultatVerrou,
} from "./appels";
export { declencherAlerte, listerAlertes, obtenirAlerte, cloturerAlerte, type EntreeAlerte } from "./alertes";
export {
  preparerCampagne,
  compterSelection,
  creerCampagne,
  assurerVagueDuJour,
  consulterTableauDeBord,
  reintegrerCible,
  repartirCibles,
  assignerCible,
  rapportCampagne,
  exporterListeCsv,
  consulterAppelIa,
  decrireSource,
  type EntreeCampagne,
  type TableauDeBord,
} from "./campagnes";
export type { SelecteurBeneficiaires, DepotCrise, FicheAppel } from "./ports";
export { RESULTATS_APPEL, RESULTAT_APPEL_LIBELLES, type ResultatAppel } from "../domain/resultat-appel";
