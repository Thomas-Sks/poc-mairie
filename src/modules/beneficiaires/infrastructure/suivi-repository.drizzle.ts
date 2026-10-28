import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import {
  beneficiaires,
  campagnes,
  ciblesCampagne,
  contacts,
  historiqueModifications,
  indisponibilites,
  interactions,
  rappels,
  utilisateurs,
} from "@/shared/infrastructure/db/schema";
import { ErreurMetier } from "../application/erreurs";
import type { InteractionVue, SuiviRepository } from "../application/ports";

const nomUtilisateur = sql<string | null>`case when ${utilisateurs.id} is null then null else ${utilisateurs.prenom} || ' ' || ${utilisateurs.nom} end`;
const nomContact = sql<string | null>`case when ${contacts.id} is null then null else trim(coalesce(${contacts.prenom}, '') || ' ' || ${contacts.nom}) end`;

const colonnesInteraction = {
  id: interactions.id,
  type: interactions.type,
  survenueLe: interactions.survenueLe,
  dureeMinutes: interactions.dureeMinutes,
  auteur: nomUtilisateur,
  interlocuteur: nomContact,
  resultat: interactions.resultat,
  compteRendu: interactions.compteRendu,
  besoins: interactions.besoins,
  actionSuivi: interactions.actionSuivi,
  campagneId: campagnes.id,
  campagneNom: campagnes.nom,
  detailIa: interactions.detailIa,
};

function versVue({ campagneId, campagneNom, detailIa, ...l }: LigneInteraction): InteractionVue {
  return { ...l, campagne: campagneId && campagneNom ? { id: campagneId, nom: campagneNom } : null, aDetailIa: detailIa !== null };
}

type LigneInteraction = Awaited<ReturnType<typeof requeteInteractions>>[number];

function requeteInteractions() {
  return db
    .select(colonnesInteraction)
    .from(interactions)
    .leftJoin(utilisateurs, eq(utilisateurs.id, interactions.auteurId))
    .leftJoin(contacts, eq(contacts.id, interactions.interlocuteurContactId))
    .leftJoin(campagnes, eq(campagnes.id, interactions.campagneId));
}

/** Vérifie que le bénéficiaire appartient à la commune (tables enfants sans `commune_id`). */
const appartient = (communeId: string, beneficiaireId: string) =>
  sql`exists (select 1 from ${beneficiaires} where ${beneficiaires.id} = ${beneficiaireId} and ${beneficiaires.communeId} = ${communeId})`;

export const suiviRepositoryDrizzle: SuiviRepository = {
  async interactions(communeId, beneficiaireId) {
    const lignes = await requeteInteractions()
      .where(and(eq(interactions.communeId, communeId), eq(interactions.beneficiaireId, beneficiaireId)))
      .orderBy(desc(interactions.survenueLe));
    return lignes.map(versVue);
  },

  async appelIa(communeId, beneficiaireId, interactionId) {
    const [ligne] = await requeteInteractions().where(
      and(eq(interactions.communeId, communeId), eq(interactions.beneficiaireId, beneficiaireId), eq(interactions.id, interactionId)),
    );
    if (!ligne?.detailIa) return null;
    return { ...versVue(ligne), detail: ligne.detailIa };
  },

  async modifications(communeId, beneficiaireId) {
    return db
      .select({
        id: historiqueModifications.id,
        champ: historiqueModifications.champ,
        ancienneValeur: historiqueModifications.ancienneValeur,
        nouvelleValeur: historiqueModifications.nouvelleValeur,
        at: historiqueModifications.at,
        auteur: nomUtilisateur,
      })
      .from(historiqueModifications)
      .leftJoin(utilisateurs, eq(utilisateurs.id, historiqueModifications.auteurId))
      .where(and(eq(historiqueModifications.beneficiaireId, beneficiaireId), appartient(communeId, beneficiaireId)))
      .orderBy(desc(historiqueModifications.at));
  },

  async rappels(communeId, beneficiaireId) {
    return db
      .select({
        id: rappels.id,
        objet: rappels.objet,
        echeance: rappels.echeance,
        assigne: nomUtilisateur,
        urgent: rappels.urgent,
        faitLe: rappels.faitLe,
        type: rappels.type,
      })
      .from(rappels)
      .leftJoin(utilisateurs, eq(utilisateurs.id, rappels.assigneA))
      .where(and(eq(rappels.communeId, communeId), eq(rappels.beneficiaireId, beneficiaireId)))
      .orderBy(asc(rappels.echeance));
  },

  async indisponibilites(communeId, beneficiaireId) {
    return db
      .select({
        id: indisponibilites.id,
        type: indisponibilites.type,
        debut: indisponibilites.debut,
        fin: indisponibilites.fin,
        joignabilite: indisponibilites.joignabilite,
        source: indisponibilites.source,
        createdAt: indisponibilites.createdAt,
      })
      .from(indisponibilites)
      .where(and(eq(indisponibilites.beneficiaireId, beneficiaireId), appartient(communeId, beneficiaireId)))
      .orderBy(desc(indisponibilites.debut));
  },

  async cibleActive(communeId, beneficiaireId, jour) {
    const [ligne] = await db
      .select({ campagne: campagnes.nom, statut: ciblesCampagne.statut, exclue: ciblesCampagne.exclue, motifExclusion: ciblesCampagne.motifExclusion })
      .from(ciblesCampagne)
      .innerJoin(campagnes, eq(campagnes.id, ciblesCampagne.campagneId))
      .where(
        and(
          eq(campagnes.communeId, communeId),
          eq(campagnes.statut, "active"),
          eq(ciblesCampagne.beneficiaireId, beneficiaireId),
          eq(ciblesCampagne.vagueDate, jour),
        ),
      )
      .limit(1);
    return ligne ?? null;
  },

  async ajouterInteraction(communeId, interaction, rappel) {
    return db.transaction(async (tx) => {
      const [ligne] = await tx.insert(interactions).values({ communeId, ...interaction }).returning({ id: interactions.id });
      if (rappel) await tx.insert(rappels).values({ communeId, ...rappel });
      return ligne.id;
    });
  },

  async ajouterRappel(communeId, rappel) {
    const [ligne] = await db.insert(rappels).values({ communeId, ...rappel }).returning({ id: rappels.id });
    return ligne.id;
  },

  async marquerRappelFait(communeId, rappelId, at) {
    await db
      .update(rappels)
      .set({ faitLe: at })
      .where(and(eq(rappels.communeId, communeId), eq(rappels.id, rappelId), isNull(rappels.faitLe)));
  },

  async ajouterIndisponibilite(communeId, indisponibilite, rappel) {
    return db.transaction(async (tx) => {
      const [ligne] = await tx.insert(indisponibilites).values(indisponibilite).returning({ id: indisponibilites.id });
      if (rappel) await tx.insert(rappels).values({ communeId, ...rappel });
      return ligne.id;
    });
  },

  async terminerIndisponibilite(communeId, indisponibiliteId, fin) {
    return db.transaction(async (tx) => {
      const [existante] = await tx
        .select({ beneficiaireId: indisponibilites.beneficiaireId, fin: indisponibilites.fin })
        .from(indisponibilites)
        .innerJoin(beneficiaires, eq(beneficiaires.id, indisponibilites.beneficiaireId))
        .where(and(eq(indisponibilites.id, indisponibiliteId), eq(beneficiaires.communeId, communeId)));
      if (!existante) throw new ErreurMetier("Cette indisponibilité est introuvable.");
      const [maj] = await tx.update(indisponibilites).set({ fin }).where(eq(indisponibilites.id, indisponibiliteId)).returning();
      // Le rappel « Vérifier le retour » prévu à l'ancienne date de fin est avancé à aujourd'hui.
      if (existante.fin) {
        await tx
          .update(rappels)
          .set({ echeance: fin })
          .where(
            and(
              eq(rappels.communeId, communeId),
              eq(rappels.beneficiaireId, existante.beneficiaireId),
              eq(rappels.type, "retour_absence"),
              eq(rappels.echeance, existante.fin),
              isNull(rappels.faitLe),
            ),
          );
      }
      return {
        id: maj.id,
        beneficiaireId: maj.beneficiaireId,
        type: maj.type,
        debut: maj.debut,
        fin: maj.fin,
        joignabilite: maj.joignabilite,
        source: maj.source,
        createdAt: maj.createdAt,
      };
    });
  },
};
