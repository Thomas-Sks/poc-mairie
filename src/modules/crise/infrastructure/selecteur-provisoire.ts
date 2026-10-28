import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import * as s from "@/shared/infrastructure/db/schema";
import type { SelecteurBeneficiaires } from "../application/ports";
import { correspondAuFiltre, filtreGeographiqueSchema } from "../domain/filtre-geographique";

/**
 * ADAPTATEUR PROVISOIRE du port SelecteurBeneficiaires : comprend seulement rue, plage de numéros,
 * parité et quartier. À remplacer à la fusion par `rechercherBeneficiaireIds` du module Registre.
 */
export const selecteurProvisoire: SelecteurBeneficiaires = {
  async rechercherBeneficiaireIds(ctx, filtre) {
    const f = filtreGeographiqueSchema.safeParse(filtre);
    const critere = f.success ? f.data : {};
    const lignes = await db
      .select({ id: s.beneficiaires.id, voie: s.foyers.voie, numero: s.foyers.numero, quartier: s.foyers.quartier })
      .from(s.beneficiaires)
      .innerJoin(s.foyers, eq(s.foyers.id, s.beneficiaires.foyerId))
      .where(and(eq(s.beneficiaires.communeId, ctx.commune.id), eq(s.beneficiaires.statut, "active")));
    return lignes.filter((l) => correspondAuFiltre(l, critere)).map((l) => l.id);
  },
};
