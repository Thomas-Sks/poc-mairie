import "server-only";
import { and, asc, eq, inArray, ne, or, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import {
  beneficiaires,
  communes,
  contacts,
  foyers,
  historiqueModifications,
  liensCercle,
  prisesEnCharge,
  quartiers,
  structures,
  tags,
  utilisateurs,
} from "@/shared/infrastructure/db/schema";
import { completerGrille } from "@/shared/domain/priorite";
import type { Changement, SaisieBeneficiaire, SaisieFoyer, SaisieSante } from "../domain/fiche";
import type { FicheComplete, FicheRepository } from "../application/ports";

type LigneBeneficiaire = typeof beneficiaires.$inferSelect;
type LigneFoyer = typeof foyers.$inferSelect;

function versBeneficiaire(b: LigneBeneficiaire): SaisieBeneficiaire {
  return {
    civilite: b.civilite,
    nom: b.nom,
    nomNaissance: b.nomNaissance,
    prenom: b.prenom,
    sexe: b.sexe,
    dateNaissance: b.dateNaissance,
    telephoneFixe: b.telephoneFixe,
    telephoneMobile: b.telephoneMobile,
    pasDeTelephone: b.pasDeTelephone,
    email: b.email,
    langue: b.langue,
    preferenceContact: b.preferenceContact,
    creneauxAppel: b.creneauxAppel,
    modeDeVie: b.modeDeVie,
    categorie: b.categorie,
    protection: b.protection,
    mandataireStructure: b.mandataireStructure,
    mandataireTelephone: b.mandataireTelephone,
    caisseRetraite: b.caisseRetraite,
    aideCaisseRetraite: b.aideCaisseRetraite,
    origineInscription: b.origineInscription,
    habitudes: b.habitudes,
    centresInteret: b.centresInteret,
    tags: b.tags,
    infoPrioritaire: b.infoPrioritaire,
    consentementRegistre: b.consentementRegistre,
    personneInformee: b.personneInformee,
    consentementIa: b.consentementIa,
    consentementPartage: b.consentementPartage,
    consentementDate: b.consentementDate,
    consentementCanal: b.consentementCanal,
  };
}

function versSante(b: LigneBeneficiaire): SaisieSante {
  return {
    gir: b.gir,
    deplacement: b.deplacement,
    troublesAuditifs: b.troublesAuditifs,
    troublesVisuels: b.troublesVisuels,
    troublesCognitifs: b.troublesCognitifs,
    handicap: b.handicap,
    appareillage: b.appareillage,
    teleassistance: b.teleassistance,
    teleassistanceFournisseur: b.teleassistanceFournisseur,
    medecinTraitant: b.medecinTraitant,
  };
}

function versFoyer(f: LigneFoyer): SaisieFoyer {
  return {
    banId: f.banId,
    numero: f.numero,
    rep: f.rep,
    voie: f.voie,
    lon: f.lon,
    lat: f.lat,
    residence: f.residence,
    batiment: f.batiment,
    entree: f.entree,
    appartement: f.appartement,
    etage: f.etage,
    ascenseur: f.ascenseur,
    codeAcces: f.codeAcces,
    typeLogement: f.typeLogement,
    sousLesToits: f.sousLesToits,
    pieceFraiche: f.pieceFraiche,
    animaux: f.animaux,
  };
}

const telephoneNormalise = (colonne: AnyColumn) => sql`regexp_replace(coalesce(${colonne}, ''), '\\D', '', 'g')`;

export const ficheRepositoryDrizzle: FicheRepository = {
  async trouver(communeId, id) {
    const [ligne] = await db
      .select({ b: beneficiaires, f: foyers })
      .from(beneficiaires)
      .innerJoin(foyers, eq(foyers.id, beneficiaires.foyerId))
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
    if (!ligne) return null;
    const { b, f } = ligne;
    const autres = await db
      .select({ id: beneficiaires.id, civilite: beneficiaires.civilite, prenom: beneficiaires.prenom, nom: beneficiaires.nom, statut: beneficiaires.statut })
      .from(beneficiaires)
      .where(and(eq(beneficiaires.foyerId, f.id), ne(beneficiaires.id, b.id)));
    const fiche: FicheComplete = {
      id: b.id,
      statut: b.statut,
      motifArchivage: b.motifArchivage,
      motifStatut: b.motifStatut,
      score: b.score,
      niveauPriorite: b.niveauPriorite,
      niveauForce: b.niveauForce,
      niveauForceJustification: b.niveauForceJustification,
      dateInscription: b.dateInscription,
      retourHospitalisationLe: b.retourHospitalisationLe,
      iaActivee: b.iaActivee,
      beneficiaire: versBeneficiaire(b),
      sante: versSante(b),
      foyer: { ...versFoyer(f), id: f.id, codePostal: f.codePostal, ville: f.ville, quartier: f.quartier, adresseAVerifier: f.adresseAVerifier },
      autresMembresFoyer: autres,
    };
    return fiche;
  },

  async creer(communeId, fiche) {
    return db.transaction(async (tx) => {
      const [foyer] = await tx
        .insert(foyers)
        .values({ communeId, ...fiche.foyer, ...fiche.foyerComplement })
        .returning({ id: foyers.id });
      const [b] = await tx
        .insert(beneficiaires)
        .values({
          communeId,
          foyerId: foyer.id,
          ...fiche.beneficiaire,
          ...fiche.sante,
          statut: "active",
          score: fiche.score,
          niveauPriorite: fiche.niveauPriorite,
          dateInscription: fiche.dateInscription,
        })
        .returning({ id: beneficiaires.id });
      return b.id;
    });
  },

  async mettreAJour(communeId, id, fiche, changements, auteurId) {
    await db.transaction(async (tx) => {
      const [b] = await tx
        .update(beneficiaires)
        .set({ ...fiche.beneficiaire, ...(fiche.sante ?? {}), updatedAt: new Date() })
        .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)))
        .returning({ foyerId: beneficiaires.foyerId });
      if (!b) return;
      await tx
        .update(foyers)
        .set({ ...fiche.foyer, ...fiche.foyerComplement })
        .where(and(eq(foyers.communeId, communeId), eq(foyers.id, b.foyerId)));
      if (changements.length) {
        await tx.insert(historiqueModifications).values(changements.map((c) => ({ beneficiaireId: id, auteurId, ...c })));
      }
    });
  },

  async historiser(beneficiaireId, changements: Changement[], auteurId) {
    if (!changements.length) return;
    await db.insert(historiqueModifications).values(changements.map((c) => ({ beneficiaireId, auteurId, ...c })));
  },

  async candidatsDoublons(communeId, { dateNaissance, telephones }) {
    const conditions = [eq(beneficiaires.dateNaissance, dateNaissance)];
    if (telephones.length) {
      conditions.push(inArray(telephoneNormalise(beneficiaires.telephoneFixe), telephones));
      conditions.push(inArray(telephoneNormalise(beneficiaires.telephoneMobile), telephones));
    }
    const lignes = await db
      .select({
        id: beneficiaires.id,
        civilite: beneficiaires.civilite,
        prenom: beneficiaires.prenom,
        nom: beneficiaires.nom,
        dateNaissance: beneficiaires.dateNaissance,
        statut: beneficiaires.statut,
        fixe: beneficiaires.telephoneFixe,
        mobile: beneficiaires.telephoneMobile,
      })
      .from(beneficiaires)
      .where(and(eq(beneficiaires.communeId, communeId), or(...conditions)))
      .limit(20);
    return lignes.map((l) => ({ ...l, telephones: [l.fixe, l.mobile] }));
  },

  async entreeFaits(communeId, id) {
    const [ligne] = await db
      .select({ b: beneficiaires, f: foyers })
      .from(beneficiaires)
      .innerJoin(foyers, eq(foyers.id, beneficiaires.foyerId))
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
    if (!ligne) return null;
    const [cercle, prises] = await Promise.all([
      db
        .select({ relation: liensCercle.relation, possedeCles: liensCercle.possedeCles, ville: contacts.ville, telephone: contacts.telephone })
        .from(liensCercle)
        .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
        .where(eq(liensCercle.beneficiaireId, id)),
      db
        .select({ type: prisesEnCharge.type, possedeCles: prisesEnCharge.possedeCles, dateFin: prisesEnCharge.dateFin, gir: prisesEnCharge.gir })
        .from(prisesEnCharge)
        .where(eq(prisesEnCharge.beneficiaireId, id)),
    ]);
    const { b, f } = ligne;
    return {
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
      cercle,
      prisesEnCharge: prises,
    };
  },

  async enregistrerScore(communeId, id, score, niveau) {
    await db
      .update(beneficiaires)
      .set({ score, niveauPriorite: niveau })
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
  },

  async grilleScore(communeId) {
    const commune = await db.query.communes.findFirst({ where: eq(communes.id, communeId) });
    return completerGrille(commune?.parametres.grilleScore);
  },

  async archiver(communeId, id, motif, commentaire) {
    await db
      .update(beneficiaires)
      .set({ statut: "archivee", motifArchivage: motif, motifStatut: commentaire, updatedAt: new Date() })
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
  },

  async forcerNiveau(communeId, id, niveau, justification) {
    await db
      .update(beneficiaires)
      .set({ niveauForce: niveau, niveauForceJustification: justification, updatedAt: new Date() })
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
  },

  async definirIa(communeId, id, active) {
    await db
      .update(beneficiaires)
      .set({ iaActivee: active, updatedAt: new Date() })
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
  },

  async definirRetourHospitalisation(communeId, id, date) {
    await db
      .update(beneficiaires)
      .set({ retourHospitalisationLe: date })
      .where(and(eq(beneficiaires.communeId, communeId), eq(beneficiaires.id, id)));
  },

  async referentiels(communeId) {
    const [listeTags, equipe, listeStructures, listeQuartiers, commune] = await Promise.all([
      db.select({ libelle: tags.libelle }).from(tags).where(eq(tags.communeId, communeId)).orderBy(asc(tags.libelle)),
      db
        .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(utilisateurs)
        .where(and(eq(utilisateurs.communeId, communeId), eq(utilisateurs.actif, true), inArray(utilisateurs.role, ["admin", "agent"])))
        .orderBy(asc(utilisateurs.prenom)),
      db
        .select({ id: structures.id, nom: structures.nom, telephone: structures.telephone })
        .from(structures)
        .where(eq(structures.communeId, communeId))
        .orderBy(asc(structures.nom)),
      db.select({ nom: quartiers.nom, contour: quartiers.contour }).from(quartiers).where(eq(quartiers.communeId, communeId)),
      db.query.communes.findFirst({ where: eq(communes.id, communeId) }),
    ]);
    return {
      tags: listeTags.map((t) => t.libelle),
      equipe,
      structures: listeStructures,
      quartiers: listeQuartiers,
      commune: { codePostal: commune?.codePostal ?? "", nom: commune?.nom ?? "" },
    };
  },
};
