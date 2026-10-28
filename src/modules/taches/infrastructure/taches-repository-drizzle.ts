import "server-only";
import { and, asc, eq, isNull, lte, max, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, communes, inscriptions, interactions, rappels, utilisateurs } from "@/shared/infrastructure/db/schema";
import { aujourdhui } from "@/shared/domain/dates";
import type { TachesRepository } from "../application/ports";

const nomBeneficiaire = sql<string>`${beneficiaires.civilite} || ' ' || ${beneficiaires.prenom} || ' ' || ${beneficiaires.nom}`;

type PersonneInscrite = { civilite?: string; prenom?: string; nom?: string };

export const tachesRepositoryDrizzle: TachesRepository = {
  async rappelsOuverts(communeId, { jusquAu, assigneA }) {
    const lignes = await db
      .select({
        id: rappels.id,
        objet: rappels.objet,
        type: rappels.type,
        echeance: rappels.echeance,
        urgent: rappels.urgent,
        faitLe: rappels.faitLe,
        assigneA: rappels.assigneA,
        assignePrenom: utilisateurs.prenom,
        assigneNomFamille: utilisateurs.nom,
        beneficiaireId: beneficiaires.id,
        beneficiaireNom: nomBeneficiaire,
      })
      .from(rappels)
      .leftJoin(beneficiaires, eq(beneficiaires.id, rappels.beneficiaireId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, rappels.assigneA))
      .where(
        and(
          eq(rappels.communeId, communeId),
          isNull(rappels.faitLe),
          lte(rappels.echeance, jusquAu),
          assigneA ? eq(rappels.assigneA, assigneA) : undefined,
        ),
      )
      .orderBy(asc(rappels.echeance));
    return lignes.map((l) => ({
      id: l.id,
      objet: l.objet,
      type: l.type,
      echeance: l.echeance,
      urgent: l.urgent,
      faitLe: l.faitLe,
      assigneA: l.assigneA,
      assigneNom: l.assignePrenom ? `${l.assignePrenom} ${l.assigneNomFamille}` : null,
      beneficiaire: l.beneficiaireId ? { id: l.beneficiaireId, nom: l.beneficiaireNom } : null,
    }));
  },

  async trouverRappel(communeId, id) {
    const r = await db.query.rappels.findFirst({ where: and(eq(rappels.communeId, communeId), eq(rappels.id, id)) });
    if (!r) return null;
    return {
      id: r.id,
      objet: r.objet,
      type: r.type,
      echeance: r.echeance,
      urgent: r.urgent,
      faitLe: r.faitLe,
      assigneA: r.assigneA,
      beneficiaire: r.beneficiaireId ? { id: r.beneficiaireId, nom: "" } : null,
    };
  },

  async marquerFait(communeId, id, at) {
    await db.update(rappels).set({ faitLe: at }).where(and(eq(rappels.communeId, communeId), eq(rappels.id, id)));
  },

  async reporter(communeId, id, echeance) {
    await db.update(rappels).set({ echeance }).where(and(eq(rappels.communeId, communeId), eq(rappels.id, id)));
  },

  async personnesActives(communeId) {
    const derniers = db
      .select({ beneficiaireId: interactions.beneficiaireId, dernier: max(interactions.survenueLe).as("dernier") })
      .from(interactions)
      .where(eq(interactions.communeId, communeId))
      .groupBy(interactions.beneficiaireId)
      .as("derniers");

    const lignes = await db
      .select({
        id: beneficiaires.id,
        nom: nomBeneficiaire,
        dateNaissance: beneficiaires.dateNaissance,
        dateInscription: beneficiaires.dateInscription,
        dateDerniereVerification: beneficiaires.dateDerniereVerification,
        frequenceContactJours: beneficiaires.frequenceContactJours,
        dernier: derniers.dernier,
      })
      .from(beneficiaires)
      .leftJoin(derniers, eq(derniers.beneficiaireId, beneficiaires.id))
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.statut, "active")));

    return lignes.map(({ dernier, ...p }) => ({ ...p, dernierContact: dernier ? aujourdhui(new Date(dernier)) : null }));
  },

  async inscriptionsEnAttente(communeId) {
    const lignes = await db
      .select({ id: inscriptions.id, soumisLe: inscriptions.soumisLe, reponses: inscriptions.reponses })
      .from(inscriptions)
      .where(and(eq(inscriptions.communeId, communeId), eq(inscriptions.statut, "en_attente")))
      .orderBy(asc(inscriptions.soumisLe));
    return lignes.map((l) => {
      const personnes = Array.isArray(l.reponses.personnes) ? (l.reponses.personnes as PersonneInscrite[]) : [];
      return {
        id: l.id,
        soumisLe: l.soumisLe,
        personnes: personnes.map((p) => [p.civilite, p.prenom, p.nom].filter(Boolean).join(" ")).filter(Boolean),
      };
    });
  },

  async parametres(communeId) {
    const commune = await db.query.communes.findFirst({ where: eq(communes.id, communeId), columns: { parametres: true } });
    return {
      anniversaireJoursAvant: commune?.parametres.anniversaireJoursAvant ?? 3,
      verificationMois: commune?.parametres.verificationMois ?? 12,
    };
  },
};
