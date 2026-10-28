/**
 * API publique de l'application du registre, pour les autres modules (Alertes / Crise…).
 * Version déjà câblée sur la base : `rechercherBeneficiaireIds(ctx, filtre)` dans `@/modules/registre/infrastructure`.
 */
export { rechercherBeneficiaireIds, resoudreListe, ListeIntrouvable } from "./rechercher-beneficiaire-ids";
export type { RegistreRepository, ListesRepository, Liste } from "./ports";
export type { Filtre, FiltreRue, ZoneCarte } from "../domain/filtre";
export { validerFiltre, lireFiltre, serialiserFiltre, deserialiserFiltre, decrireFiltre, FILTRE_VIDE } from "../domain/filtre";
