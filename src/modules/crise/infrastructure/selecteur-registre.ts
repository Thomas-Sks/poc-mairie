import "server-only";
import type { SelecteurBeneficiaires } from "../application/ports";
import { filtreGeographiqueSchema } from "../domain/filtre-geographique";
import { rechercherBeneficiaireIds } from "@/modules/registre/infrastructure";
import type { Filtre } from "@/modules/registre/domain/filtre";

/**
 * Adaptateur du port SelecteurBeneficiaires sur le module Registre.
 * Accepte un filtre Registre (listes dynamiques) ou le filtre géographique « à la volée » du formulaire
 * de campagne, traduit vers le filtre Registre. Une campagne ne cible que des fiches actives.
 */
export const selecteurRegistre: SelecteurBeneficiaires = {
  async rechercherBeneficiaireIds(ctx, filtre) {
    const filtreRegistre: Filtre =
      "version" in filtre ? { ...(filtre as Filtre), statuts: ["active"] } : depuisFiltreGeographique(filtre);
    return rechercherBeneficiaireIds(ctx, filtreRegistre);
  },
};

function depuisFiltreGeographique(brut: Record<string, unknown>): Filtre {
  const f = filtreGeographiqueSchema.parse(brut);
  return {
    version: 1,
    statuts: ["active"],
    rues: f.voie ? [{ voie: f.voie, numeroMin: f.numeroMin, numeroMax: f.numeroMax, cote: f.parite ?? "tous" }] : undefined,
    quartiers: f.quartier ? [f.quartier] : undefined,
  };
}
