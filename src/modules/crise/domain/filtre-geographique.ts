/**
 * Filtre géographique « à la volée » pour créer une campagne localisée (E9-US2, §10.4-6) :
 * rue, plage de numéros (pairs, impairs ou tous) et quartier. Fonction pure.
 * Provisoire : le module Registre fournira le filtre complet (rechercherBeneficiaireIds).
 */
import { z } from "zod";

export const filtreGeographiqueSchema = z.object({
  voie: z.string().trim().optional(),
  numeroMin: z.number().int().nonnegative().optional(),
  numeroMax: z.number().int().nonnegative().optional(),
  parite: z.enum(["tous", "pair", "impair"]).optional(),
  quartier: z.string().trim().optional(),
});
export type FiltreGeographique = z.infer<typeof filtreGeographiqueSchema>;

export type AdresseFoyer = { voie: string; numero: number | null; quartier: string | null };

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export function correspondAuFiltre(adresse: AdresseFoyer, filtre: FiltreGeographique): boolean {
  if (filtre.voie && normaliser(adresse.voie) !== normaliser(filtre.voie)) return false;
  if (filtre.quartier && normaliser(adresse.quartier ?? "") !== normaliser(filtre.quartier)) return false;
  const bornes = filtre.numeroMin !== undefined || filtre.numeroMax !== undefined;
  const parite = filtre.parite && filtre.parite !== "tous";
  if (!bornes && !parite) return true;
  if (adresse.numero === null) return false;
  if (filtre.numeroMin !== undefined && adresse.numero < filtre.numeroMin) return false;
  if (filtre.numeroMax !== undefined && adresse.numero > filtre.numeroMax) return false;
  if (filtre.parite === "pair" && adresse.numero % 2 !== 0) return false;
  if (filtre.parite === "impair" && adresse.numero % 2 !== 1) return false;
  return true;
}

export function decrireFiltre(f: FiltreGeographique): string {
  const morceaux: string[] = [];
  if (f.voie) morceaux.push(f.voie);
  if (f.numeroMin !== undefined || f.numeroMax !== undefined) {
    const parite = f.parite === "pair" ? " pairs" : f.parite === "impair" ? " impairs" : "";
    morceaux.push(`n°${parite} ${f.numeroMin ?? 1} à ${f.numeroMax ?? "…"}`);
  } else if (f.parite && f.parite !== "tous") {
    morceaux.push(f.parite === "pair" ? "numéros pairs" : "numéros impairs");
  }
  if (f.quartier) morceaux.push(`quartier ${f.quartier}`);
  return morceaux.join(", ") || "Toute la commune";
}
