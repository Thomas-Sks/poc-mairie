import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, communes, contacts, foyers, liensCercle, prisesEnCharge, utilisateurs } from "@/shared/infrastructure/db/schema";
import type { EntreeFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import type { ParametresRepository } from "../application/ports";

const colonnesMembre = {
  id: utilisateurs.id,
  prenom: utilisateurs.prenom,
  nom: utilisateurs.nom,
  email: utilisateurs.email,
  telephone: utilisateurs.telephone,
  role: utilisateurs.role,
  actif: utilisateurs.actif,
};

function grouper<T extends { beneficiaireId: string }>(lignes: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lignes) m.set(l.beneficiaireId, [...(m.get(l.beneficiaireId) ?? []), l]);
  return m;
}

export const parametresRepositoryDrizzle: ParametresRepository = {
  async lire(communeId) {
    const c = await db.query.communes.findFirst({ where: eq(communes.id, communeId), columns: { parametres: true } });
    if (!c) throw new Error("Commune introuvable.");
    return c.parametres;
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

  async equipe(communeId) {
    return db.select(colonnesMembre).from(utilisateurs).where(eq(utilisateurs.communeId, communeId)).orderBy(asc(utilisateurs.createdAt));
  },

  async emailUtilise(email) {
    const u = await db.query.utilisateurs.findFirst({ where: eq(sql`lower(${utilisateurs.email})`, email), columns: { id: true } });
    return Boolean(u);
  },

  async creerMembre(communeId, membre) {
    const [u] = await db.insert(utilisateurs).values({ ...membre, communeId }).returning(colonnesMembre);
    return u;
  },
};
