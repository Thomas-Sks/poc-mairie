import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, communes, contacts, foyers, liensCercle, prisesEnCharge } from "@/shared/infrastructure/db/schema";
import type { EntreeFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import { completerGrille } from "@/shared/domain/priorite";
import type { ParametresRepository } from "../application/ports";

function grouper<T extends { beneficiaireId: string }>(lignes: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lignes) m.set(l.beneficiaireId, [...(m.get(l.beneficiaireId) ?? []), l]);
  return m;
}

export const parametresRepositoryDrizzle: ParametresRepository = {
  async lire(communeId) {
    const c = await db.query.communes.findFirst({ where: eq(communes.id, communeId), columns: { parametres: true } });
    if (!c) throw new Error("Commune introuvable.");
    return { ...c.parametres, grilleScore: completerGrille(c.parametres.grilleScore) };
  },

  async enregistrer(communeId, parametres) {
    await db.update(communes).set({ parametres }).where(eq(communes.id, communeId));
  },

  async fichesActivesPourScore(communeId) {
    const fiches = await db
      .select({ b: beneficiaires, f: foyers })
      .from(beneficiaires)
      .innerJoin(foyers, eq(foyers.id, beneficiaires.foyerId))
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.statut, "active")));
    const ids = fiches.map(({ b }) => b.id);
    if (ids.length === 0) return [];

    const [cercle, prises] = await Promise.all([
      db
        .select({
          beneficiaireId: liensCercle.beneficiaireId,
          relation: liensCercle.relation,
          possedeCles: liensCercle.possedeCles,
          ville: contacts.ville,
          telephone: contacts.telephone,
        })
        .from(liensCercle)
        .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
        .where(inArray(liensCercle.beneficiaireId, ids)),
      db
        .select({
          beneficiaireId: prisesEnCharge.beneficiaireId,
          type: prisesEnCharge.type,
          possedeCles: prisesEnCharge.possedeCles,
          dateFin: prisesEnCharge.dateFin,
          gir: prisesEnCharge.gir,
        })
        .from(prisesEnCharge)
        .where(inArray(prisesEnCharge.beneficiaireId, ids)),
    ]);
    const cercleDe = grouper(cercle);
    const prisesDe = grouper(prises);

    return fiches.map(({ b, f }) => {
      const faits: Omit<EntreeFaits, "aujourdhui"> = {
        beneficiaire: {
          dateNaissance: b.dateNaissance,
          modeDeVie: b.modeDeVie,
          deplacement: b.deplacement,
          protection: b.protection,
          troublesCognitifs: b.troublesCognitifs,
          pasDeTelephone: b.pasDeTelephone,
          retourHospitalisationLe: b.retourHospitalisationLe,
          gir: b.gir,
          aideCaisseRetraite: b.aideCaisseRetraite,
        },
        foyer: { sousLesToits: f.sousLesToits, pieceFraiche: f.pieceFraiche, etage: f.etage, typeLogement: f.typeLogement },
        cercle: cercleDe.get(b.id) ?? [],
        prisesEnCharge: prisesDe.get(b.id) ?? [],
      };
      return { id: b.id, score: b.score, niveauPriorite: b.niveauPriorite, niveauForce: b.niveauForce, faits };
    });
  },

  async enregistrerScores(communeId, scores) {
    if (scores.length === 0) return;
    await db.transaction(async (tx) => {
      for (const s of scores) {
        await tx
          .update(beneficiaires)
          .set({ score: s.score, niveauPriorite: s.niveauPriorite, updatedAt: sql`now()` })
          .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, s.id)));
      }
    });
  },
};
