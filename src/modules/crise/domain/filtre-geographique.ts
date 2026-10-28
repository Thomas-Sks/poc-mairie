/**
 * Filtre géographique « à la volée » pour créer une campagne localisée (E9-US2, §10.4-6) :
 * rue, plage de numéros (pairs, impairs ou tous) et quartier. Fonction pure.
 * Traduit vers le filtre du Registre par l'adaptateur `selecteur-registre`.
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
