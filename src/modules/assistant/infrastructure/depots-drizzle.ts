import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { calculerAge } from "@/shared/domain/dates";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, foyers, interpretationsAssistant, journalAudit } from "@/shared/infrastructure/db/schema";
import type { Annuaire, InterpretationsRepository, JournalExports } from "../application/ports";

export const interpretationsDrizzle: InterpretationsRepository = {
  async trouver(communeId, cle) {
    const [l] = await db
      .select({ appel: interpretationsAssistant.appel, source: interpretationsAssistant.source })
      .from(interpretationsAssistant)
      .where(and(eq(interpretationsAssistant.communeId, communeId), eq(interpretationsAssistant.questionNormalisee, cle)));
    return l ?? null;
  },

  async enregistrer(communeId, cle, appel, source) {
    // La première interprétation l'emporte : deux écrans qui posent la même question au même moment obtiennent la même réponse.
    await db
      .insert(interpretationsAssistant)
      .values({ communeId, questionNormalisee: cle, appel: appel as Record<string, unknown>, source })
      .onConflictDoNothing();
  },
};

export const annuaireDrizzle: Annuaire = {
  async chercher(communeId, texte, jour) {
    const motif = `%${texte.replace(/[%_]/g, "")}%`;
    const lignes = await db
      .select({
        id: beneficiaires.id,
        civilite: beneficiaires.civilite,
        nom: beneficiaires.nom,
        prenom: beneficiaires.prenom,
        dateNaissance: beneficiaires.dateNaissance,
        adresse: sql<string>`concat_ws(' ', ${foyers.numero}::text, ${foyers.rep}, ${foyers.voie})`,
        telephone: sql<string | null>`coalesce(${beneficiaires.telephoneMobile}, ${beneficiaires.telephoneFixe})`,
        priorite: sql<"P1" | "P2" | "P3">`coalesce(${beneficiaires.niveauForce}, ${beneficiaires.niveauPriorite})`,
      })
      .from(beneficiaires)
      .innerJoin(foyers, eq(foyers.id, beneficiaires.foyerId))
      .where(
        and(
          eq(beneficiaires.communeId, communeId),
          eq(beneficiaires.statut, "active"),
          or(
            ilike(beneficiaires.nom, motif),
            ilike(beneficiaires.prenom, motif),
            ilike(sql`${beneficiaires.prenom} || ' ' || ${beneficiaires.nom}`, motif),
            ilike(foyers.voie, motif),
          ),
        ),
      )
      .orderBy(asc(beneficiaires.nom), asc(beneficiaires.prenom))
      .limit(10);
    return lignes.map(({ dateNaissance, ...l }) => ({ ...l, age: calculerAge(dateNaissance, jour) }));
  },
};

export const journalExportsDrizzle: JournalExports = {
  async enregistrer(communeId, utilisateurId, details) {
    await db.insert(journalAudit).values({ communeId, utilisateurId, action: "assistant.export_excel", details });
  },
};
