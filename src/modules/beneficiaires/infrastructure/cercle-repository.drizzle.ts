import "server-only";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, contacts, liensCercle } from "@/shared/infrastructure/db/schema";
import type { CercleRepository, LienCercleVue } from "../application/ports";

const colonnesLien = {
  lienId: liensCercle.id,
  beneficiaireId: liensCercle.beneficiaireId,
  contactId: liensCercle.contactId,
  relation: liensCercle.relation,
  rangAppel: liensCercle.rangAppel,
  possedeCles: liensCercle.possedeCles,
  estUrgence: liensCercle.estUrgence,
  estRepresentantLegal: liensCercle.estRepresentantLegal,
  prenom: contacts.prenom,
  nom: contacts.nom,
  structure: contacts.structure,
  telephone: contacts.telephone,
  telephone2: contacts.telephone2,
  email: contacts.email,
  ville: contacts.ville,
  disponibilites: contacts.disponibilites,
  partageAvec: sql<number>`(select count(*)::int from ${liensCercle} as autres where autres.contact_id = ${contacts.id} and autres.beneficiaire_id <> ${liensCercle.beneficiaireId})`,
};

/** Liens du cercle (avec le contact) d'un bénéficiaire de la commune, filtrés par `condition`. */
function requeteLiens(communeId: string, condition: SQL) {
  return db
    .select(colonnesLien)
    .from(liensCercle)
    .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
    .innerJoin(beneficiaires, eq(beneficiaires.id, liensCercle.beneficiaireId))
    .where(and(eq(beneficiaires.communeId, communeId), condition));
}

type Ligne = Awaited<ReturnType<typeof requeteLiens>>[number];

function versVue(l: Ligne): LienCercleVue & { beneficiaireId: string } {
  return {
    lienId: l.lienId,
    beneficiaireId: l.beneficiaireId,
    contactId: l.contactId,
    relation: l.relation,
    rangAppel: l.rangAppel,
    possedeCles: l.possedeCles,
    estUrgence: l.estUrgence,
    estRepresentantLegal: l.estRepresentantLegal,
    partageAvec: l.partageAvec,
    contact: {
      prenom: l.prenom,
      nom: l.nom,
      structure: l.structure,
      telephone: l.telephone,
      telephone2: l.telephone2,
      email: l.email,
      ville: l.ville,
      disponibilites: l.disponibilites,
    },
  };
}

export const cercleRepositoryDrizzle: CercleRepository = {
  async liens(communeId, beneficiaireId) {
    const lignes = await requeteLiens(communeId, eq(liensCercle.beneficiaireId, beneficiaireId)).orderBy(asc(liensCercle.rangAppel));
    return lignes.map(versVue);
  },

  async lien(communeId, lienId) {
    const [ligne] = await requeteLiens(communeId, eq(liensCercle.id, lienId));
    return ligne ? versVue(ligne) : null;
  },

  async chercherContacts(communeId, recherche) {
    const motif = `%${recherche}%`;
    const chiffres = recherche.replace(/\D/g, "");
    const conditions = [ilike(contacts.nom, motif), ilike(contacts.prenom, motif), ilike(contacts.structure, motif)];
    if (chiffres.length >= 4) {
      conditions.push(sql`regexp_replace(coalesce(${contacts.telephone}, ''), '\\D', '', 'g') like ${`%${chiffres}%`}`);
    }
    return db
      .select({
        id: contacts.id,
        prenom: contacts.prenom,
        nom: contacts.nom,
        structure: contacts.structure,
        telephone: contacts.telephone,
        telephone2: contacts.telephone2,
        email: contacts.email,
        ville: contacts.ville,
        disponibilites: contacts.disponibilites,
        nbBeneficiaires: sql<number>`(select count(*)::int from ${liensCercle} where ${liensCercle.contactId} = ${contacts.id})`,
      })
      .from(contacts)
      .where(and(eq(contacts.communeId, communeId), or(...conditions)))
      .orderBy(asc(contacts.nom))
      .limit(8);
  },

  async creerContact(communeId, contact) {
    const [ligne] = await db.insert(contacts).values({ communeId, ...contact }).returning({ id: contacts.id });
    return ligne.id;
  },

  async contactExiste(communeId, contactId) {
    const [ligne] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.communeId, communeId), eq(contacts.id, contactId)));
    return Boolean(ligne);
  },

  async lier(beneficiaireId, contactId, lien) {
    const [ligne] = await db.insert(liensCercle).values({ beneficiaireId, contactId, ...lien }).returning({ id: liensCercle.id });
    return ligne.id;
  },

  async modifierContact(communeId, contactId, contact) {
    await db
      .update(contacts)
      .set(contact)
      .where(and(eq(contacts.communeId, communeId), eq(contacts.id, contactId)));
  },

  async modifierLien(communeId, lienId, lien) {
    await db
      .update(liensCercle)
      .set(lien)
      .where(
        and(
          eq(liensCercle.id, lienId),
          sql`exists (select 1 from ${beneficiaires} where ${beneficiaires.id} = ${liensCercle.beneficiaireId} and ${beneficiaires.communeId} = ${communeId})`,
        ),
      );
  },

  async retirerLien(communeId, lienId) {
    await db
      .delete(liensCercle)
      .where(
        and(
          eq(liensCercle.id, lienId),
          sql`exists (select 1 from ${beneficiaires} where ${beneficiaires.id} = ${liensCercle.beneficiaireId} and ${beneficiaires.communeId} = ${communeId})`,
        ),
      );
  },
};
