import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, contacts, creneauxPassage, prisesEnCharge, structures } from "@/shared/infrastructure/db/schema";
import type { PriseEnChargeRepository } from "../application/ports";

export const priseEnChargeRepositoryDrizzle: PriseEnChargeRepository = {
  async lister(communeId, beneficiaireId) {
    const prises = await db
      .select({
        id: prisesEnCharge.id,
        type: prisesEnCharge.type,
        structureId: prisesEnCharge.structureId,
        structureNom: structures.nom,
        intervenantNom: prisesEnCharge.intervenantNom,
        telephone: prisesEnCharge.telephone,
        possedeCles: prisesEnCharge.possedeCles,
        dateDebut: prisesEnCharge.dateDebut,
        dateFin: prisesEnCharge.dateFin,
        gir: prisesEnCharge.gir,
        heuresParSemaine: prisesEnCharge.heuresParSemaine,
        contactId: prisesEnCharge.contactId,
        contactNom: sql<string | null>`case when ${contacts.id} is null then null else trim(coalesce(${contacts.prenom}, '') || ' ' || ${contacts.nom}) end`,
      })
      .from(prisesEnCharge)
      .innerJoin(beneficiaires, eq(beneficiaires.id, prisesEnCharge.beneficiaireId))
      .leftJoin(structures, eq(structures.id, prisesEnCharge.structureId))
      .leftJoin(contacts, eq(contacts.id, prisesEnCharge.contactId))
      .where(and(eq(beneficiaires.communeId, communeId), eq(prisesEnCharge.beneficiaireId, beneficiaireId)))
      .orderBy(asc(prisesEnCharge.type));
    if (!prises.length) return [];
    const creneaux = await db
      .select()
      .from(creneauxPassage)
      .where(
        inArray(
          creneauxPassage.priseEnChargeId,
          prises.map((p) => p.id),
        ),
      )
      .orderBy(asc(creneauxPassage.heureDebut));
    return prises.map((p) => ({
      ...p,
      creneaux: creneaux
        .filter((c) => c.priseEnChargeId === p.id)
        .map((c) => ({ id: c.id, joursSemaine: c.joursSemaine, heureDebut: c.heureDebut, heureFin: c.heureFin, exceptions: c.exceptions })),
    }));
  },

  async beneficiaireDe(communeId, { priseEnChargeId, creneauId }) {
    if (creneauId) {
      const [ligne] = await db
        .select({ id: beneficiaires.id })
        .from(creneauxPassage)
        .innerJoin(prisesEnCharge, eq(prisesEnCharge.id, creneauxPassage.priseEnChargeId))
        .innerJoin(beneficiaires, eq(beneficiaires.id, prisesEnCharge.beneficiaireId))
        .where(and(eq(creneauxPassage.id, creneauId), eq(beneficiaires.communeId, communeId)));
      return ligne?.id ?? null;
    }
    if (priseEnChargeId) {
      const [ligne] = await db
        .select({ id: beneficiaires.id })
        .from(prisesEnCharge)
        .innerJoin(beneficiaires, eq(beneficiaires.id, prisesEnCharge.beneficiaireId))
        .where(and(eq(prisesEnCharge.id, priseEnChargeId), eq(beneficiaires.communeId, communeId)));
      return ligne?.id ?? null;
    }
    return null;
  },

  async ajouter(beneficiaireId, donnees) {
    const [ligne] = await db.insert(prisesEnCharge).values({ beneficiaireId, ...donnees }).returning({ id: prisesEnCharge.id });
    return ligne.id;
  },

  async modifier(priseEnChargeId, donnees) {
    await db.update(prisesEnCharge).set(donnees).where(eq(prisesEnCharge.id, priseEnChargeId));
  },

  async retirer(priseEnChargeId) {
    await db.delete(prisesEnCharge).where(eq(prisesEnCharge.id, priseEnChargeId));
  },

  async ajouterCreneau(priseEnChargeId, creneau) {
    const [ligne] = await db.insert(creneauxPassage).values({ priseEnChargeId, ...creneau }).returning({ id: creneauxPassage.id });
    return ligne.id;
  },

  async modifierCreneau(creneauId, creneau) {
    await db.update(creneauxPassage).set(creneau).where(eq(creneauxPassage.id, creneauId));
  },

  async retirerCreneau(creneauId) {
    await db.delete(creneauxPassage).where(eq(creneauxPassage.id, creneauId));
  },
};
