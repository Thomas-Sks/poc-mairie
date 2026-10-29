import "server-only";
import { and, asc, desc, eq, inArray, max, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import * as s from "@/shared/infrastructure/db/schema";
import { completerGrille } from "@/shared/domain/priorite";
import { chiffresTelephone, cleTexte } from "@/shared/domain/normalisation";
import type { FicheExistante } from "../domain/doublons";
import { RGPD_PAR_DEFAUT } from "../domain/rgpd";
import type { CommunePubliqueRepository, InscriptionEnregistree, InscriptionRepository, StatutInscription } from "../application/ports";

const colonnesFiche = {
  id: s.beneficiaires.id,
  civilite: s.beneficiaires.civilite,
  nom: s.beneficiaires.nom,
  prenom: s.beneficiaires.prenom,
  dateNaissance: s.beneficiaires.dateNaissance,
  telephoneFixe: s.beneficiaires.telephoneFixe,
  telephoneMobile: s.beneficiaires.telephoneMobile,
  statut: s.beneficiaires.statut,
  score: s.beneficiaires.score,
  niveauPriorite: s.beneficiaires.niveauPriorite,
  foyerId: s.beneficiaires.foyerId,
};

function adresseFoyer(f: typeof s.foyers.$inferSelect): string {
  return [f.numero ? `${f.numero}${f.rep ?? ""}` : null, f.voie].filter(Boolean).join(" ");
}

async function hydrater(lignes: (typeof s.inscriptions.$inferSelect)[]): Promise<InscriptionEnregistree[]> {
  const ids = lignes.flatMap((l) => l.beneficiaireIds);
  const fiches = ids.length ? await db.select(colonnesFiche).from(s.beneficiaires).where(inArray(s.beneficiaires.id, ids)) : [];
  const foyerIds = [...new Set(fiches.map((f) => f.foyerId))];
  const foyers = foyerIds.length ? await db.select().from(s.foyers).where(inArray(s.foyers.id, foyerIds)) : [];
  const agentsIds = [...new Set(lignes.map((l) => l.traiteePar).filter((x): x is string => x !== null))];
  const agents = agentsIds.length
    ? await db.select({ id: s.utilisateurs.id, prenom: s.utilisateurs.prenom, nom: s.utilisateurs.nom }).from(s.utilisateurs).where(inArray(s.utilisateurs.id, agentsIds))
    : [];

  return lignes.map((l) => {
    const siennes = l.beneficiaireIds.map((id) => fiches.find((f) => f.id === id)).filter((f) => f !== undefined);
    const foyer = foyers.find((f) => f.id === siennes[0]?.foyerId);
    const agent = agents.find((a) => a.id === l.traiteePar);
    const reponses = l.reponses as { adresse?: { numero?: number; voie?: string } };
    return {
      id: l.id,
      communeId: l.communeId,
      reponses: l.reponses,
      soumisLe: l.soumisLe,
      statut: l.statut,
      motifRejet: l.motifRejet,
      traiteeLe: l.traiteeLe,
      traiteePar: agent ? `${agent.prenom} ${agent.nom}` : null,
      adresse: foyer ? adresseFoyer(foyer) : reponses.adresse?.voie ? [reponses.adresse.numero, reponses.adresse.voie].filter(Boolean).join(" ") : null,
      fiches: siennes,
    };
  });
}

export const inscriptionRepositoryDrizzle: InscriptionRepository = {
  async enregistrer(communeId, reponses, d, soumisLe) {
    return db.transaction(async (tx) => {
      const [foyer] = await tx.insert(s.foyers).values({ communeId, ...d.foyer }).returning({ id: s.foyers.id });
      const contacts = d.contacts.length
        ? await tx
            .insert(s.contacts)
            .values(d.contacts.map((c) => ({ communeId, prenom: c.prenom, nom: c.nom, telephone: c.telephone, ville: c.ville })))
            .returning({ id: s.contacts.id })
        : [];
      const beneficiaireIds: string[] = [];
      for (const fiche of d.fiches) {
        const { criteres: _criteres, ...valeurs } = fiche;
        void _criteres;
        const [b] = await tx.insert(s.beneficiaires).values({ communeId, foyerId: foyer.id, ...valeurs }).returning({ id: s.beneficiaires.id });
        beneficiaireIds.push(b.id);
        if (contacts.length) {
          await tx.insert(s.liensCercle).values(
            d.contacts.map((c, i) => ({
              beneficiaireId: b.id,
              contactId: contacts[i].id,
              relation: c.relation,
              rangAppel: c.rangAppel,
              possedeCles: c.possedeCles,
              estUrgence: true,
            })),
          );
        }
        for (const p of d.prisesEnCharge) {
          const [pec] = await tx
            .insert(s.prisesEnCharge)
            .values({ beneficiaireId: b.id, type: p.type, intervenantNom: p.intervenantNom, telephone: p.telephone, possedeCles: p.possedeCles, dateDebut: valeurs.dateInscription })
            .returning({ id: s.prisesEnCharge.id });
          if (p.creneau) await tx.insert(s.creneauxPassage).values({ priseEnChargeId: pec.id, ...p.creneau });
        }
        if (d.indisponibilites.length) {
          await tx.insert(s.indisponibilites).values(d.indisponibilites.map((x) => ({ beneficiaireId: b.id, ...x })));
        }
      }
      const [inscription] = await tx
        .insert(s.inscriptions)
        .values({ communeId, reponses, soumisLe, beneficiaireIds })
        .returning({ id: s.inscriptions.id });
      return { id: inscription.id };
    });
  },

  async lister(communeId, statut, limite) {
    const filtre: StatutInscription[] = statut === "traitee" ? ["validee", "rejetee"] : [statut];
    const lignes = await db
      .select()
      .from(s.inscriptions)
      .where(and(eq(s.inscriptions.communeId, communeId), inArray(s.inscriptions.statut, filtre)))
      .orderBy(statut === "traitee" ? desc(s.inscriptions.traiteeLe) : asc(s.inscriptions.soumisLe))
      .limit(limite ?? 500);
    return hydrater(lignes);
  },

  async obtenir(communeId, id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const lignes = await db.select().from(s.inscriptions).where(and(eq(s.inscriptions.communeId, communeId), eq(s.inscriptions.id, id)));
    const [inscription] = await hydrater(lignes);
    return inscription ?? null;
  },

  async fichesComparables(communeId, exclure) {
    const lignes = await db
      .select(colonnesFiche)
      .from(s.beneficiaires)
      .where(
        and(
          eq(s.beneficiaires.communeId, communeId),
          ne(s.beneficiaires.statut, "archivee"),
          exclure.length ? notInArray(s.beneficiaires.id, exclure) : undefined,
        ),
      );
    return lignes.map(
      (b): FicheExistante => ({
        id: b.id,
        libelle: `${b.civilite} ${b.prenom} ${b.nom}`,
        nom: b.nom,
        prenom: b.prenom,
        dateNaissance: b.dateNaissance,
        telephones: [b.telephoneFixe, b.telephoneMobile],
      }),
    );
  },

  async valider(communeId, id, utilisateurId, maintenant) {
    await db.transaction(async (tx) => {
      const [inscription] = await tx.select().from(s.inscriptions).where(and(eq(s.inscriptions.communeId, communeId), eq(s.inscriptions.id, id)));
      if (inscription.beneficiaireIds.length) {
        await tx
          .update(s.beneficiaires)
          .set({ statut: "active", updatedAt: maintenant })
          .where(and(eq(s.beneficiaires.communeId, communeId), inArray(s.beneficiaires.id, inscription.beneficiaireIds), eq(s.beneficiaires.statut, "en_attente")));
      }
      await tx.update(s.inscriptions).set({ statut: "validee", traiteePar: utilisateurId, traiteeLe: maintenant }).where(eq(s.inscriptions.id, id));
      await tx.insert(s.journalAudit).values({ communeId, utilisateurId, action: "inscription.valider", cible: id });
    });
  },

  async rejeter(communeId, id, motif, utilisateurId, maintenant) {
    await db.transaction(async (tx) => {
      const [inscription] = await tx.select().from(s.inscriptions).where(and(eq(s.inscriptions.communeId, communeId), eq(s.inscriptions.id, id)));
      const enAttente = inscription.beneficiaireIds.length
        ? await tx
            .select({ id: s.beneficiaires.id, foyerId: s.beneficiaires.foyerId })
            .from(s.beneficiaires)
            .where(and(inArray(s.beneficiaires.id, inscription.beneficiaireIds), eq(s.beneficiaires.statut, "en_attente")))
        : [];
      const aSupprimer = enAttente.map((b) => b.id);
      if (aSupprimer.length) {
        const contacts = await tx.select({ id: s.liensCercle.contactId }).from(s.liensCercle).where(inArray(s.liensCercle.beneficiaireId, aSupprimer));
        await tx.delete(s.beneficiaires).where(inArray(s.beneficiaires.id, aSupprimer));
        await supprimerOrphelins(tx, contacts.map((c) => c.id), enAttente.map((b) => b.foyerId));
      }
      await tx
        .update(s.inscriptions)
        .set({
          statut: "rejetee",
          motifRejet: motif,
          traiteePar: utilisateurId,
          traiteeLe: maintenant,
          beneficiaireIds: inscription.beneficiaireIds.filter((b) => !aSupprimer.includes(b)),
        })
        .where(eq(s.inscriptions.id, id));
      await tx.insert(s.journalAudit).values({ communeId, utilisateurId, action: "inscription.rejeter", cible: id, details: { motif } });
    });
  },

  async fusionner(communeId, { inscriptionId, ficheEnAttenteId, ficheExistanteId }, utilisateurId, maintenant) {
    await db.transaction(async (tx) => {
      const [source] = await tx.select().from(s.beneficiaires).where(and(eq(s.beneficiaires.communeId, communeId), eq(s.beneficiaires.id, ficheEnAttenteId)));
      const [cible] = await tx.select().from(s.beneficiaires).where(and(eq(s.beneficiaires.communeId, communeId), eq(s.beneficiaires.id, ficheExistanteId)));

      // Cercle : les nouveaux contacts sont ajoutés après ceux déjà connus. Un contact déjà présent
      // (même contact, ou même numéro de téléphone) n'est pas dupliqué.
      const [{ rangMax }] = await tx.select({ rangMax: max(s.liensCercle.rangAppel) }).from(s.liensCercle).where(eq(s.liensCercle.beneficiaireId, cible.id));
      const cercleCible = await tx
        .select({ id: s.liensCercle.contactId, telephone: s.contacts.telephone })
        .from(s.liensCercle)
        .innerJoin(s.contacts, eq(s.contacts.id, s.liensCercle.contactId))
        .where(eq(s.liensCercle.beneficiaireId, cible.id));
      const dejaLies = new Set(cercleCible.map((c) => c.id));
      const numerosConnus = new Set(cercleCible.map((c) => chiffresTelephone(c.telephone)).filter(Boolean));
      const liens = await tx
        .select({ id: s.liensCercle.id, contactId: s.liensCercle.contactId, telephone: s.contacts.telephone })
        .from(s.liensCercle)
        .innerJoin(s.contacts, eq(s.contacts.id, s.liensCercle.contactId))
        .where(eq(s.liensCercle.beneficiaireId, source.id))
        .orderBy(asc(s.liensCercle.rangAppel));
      const ignores: string[] = [];
      let rang = rangMax ?? 0;
      for (const l of liens) {
        if (dejaLies.has(l.contactId) || numerosConnus.has(chiffresTelephone(l.telephone))) {
          ignores.push(l.contactId);
          continue;
        }
        rang += 1;
        await tx.update(s.liensCercle).set({ beneficiaireId: cible.id, rangAppel: rang }).where(eq(s.liensCercle.id, l.id));
      }

      // Intervenants et absences : déplacés, sauf s'ils sont déjà connus (même type et même nom, mêmes dates).
      const cle = (...v: (string | null)[]) => v.map((x) => cleTexte(x ?? "")).join("|");
      const pecCible = new Set(
        (await tx.select().from(s.prisesEnCharge).where(eq(s.prisesEnCharge.beneficiaireId, cible.id))).map((p) => cle(p.type, p.intervenantNom)),
      );
      for (const p of await tx.select().from(s.prisesEnCharge).where(eq(s.prisesEnCharge.beneficiaireId, source.id))) {
        if (!pecCible.has(cle(p.type, p.intervenantNom))) await tx.update(s.prisesEnCharge).set({ beneficiaireId: cible.id }).where(eq(s.prisesEnCharge.id, p.id));
      }
      const indispoCible = new Set(
        (await tx.select().from(s.indisponibilites).where(eq(s.indisponibilites.beneficiaireId, cible.id))).map((x) => cle(x.debut, x.fin)),
      );
      for (const x of await tx.select().from(s.indisponibilites).where(eq(s.indisponibilites.beneficiaireId, source.id))) {
        if (!indispoCible.has(cle(x.debut, x.fin))) await tx.update(s.indisponibilites).set({ beneficiaireId: cible.id }).where(eq(s.indisponibilites.id, x.id));
      }

      // Coordonnées : on complète la fiche existante sans écraser ce qu'elle contient.
      await tx
        .update(s.beneficiaires)
        .set({
          telephoneFixe: cible.telephoneFixe ?? source.telephoneFixe,
          telephoneMobile: cible.telephoneMobile ?? source.telephoneMobile,
          email: cible.email ?? source.email,
          pasDeTelephone: cible.pasDeTelephone && source.pasDeTelephone,
          mandataireStructure: cible.mandataireStructure ?? source.mandataireStructure,
          mandataireTelephone: cible.mandataireTelephone ?? source.mandataireTelephone,
          medecinTraitant: cible.medecinTraitant ?? source.medecinTraitant,
          creneauxAppel: cible.creneauxAppel ?? source.creneauxAppel,
          teleassistance: cible.teleassistance || source.teleassistance,
          troublesAuditifs: cible.troublesAuditifs || source.troublesAuditifs,
          consentementIa: cible.consentementIa || source.consentementIa,
          updatedAt: maintenant,
        })
        .where(eq(s.beneficiaires.id, cible.id));
      await tx.insert(s.historiqueModifications).values({
        beneficiaireId: cible.id,
        auteurId: utilisateurId,
        champ: "Fusion avec une inscription en ligne",
        nouvelleValeur: `Inscription du ${maintenant.toLocaleDateString("fr-FR")} rattachée à la fiche`,
      });

      await tx.delete(s.beneficiaires).where(eq(s.beneficiaires.id, source.id));
      await supprimerOrphelins(tx, ignores, [source.foyerId]);

      const [inscription] = await tx.select().from(s.inscriptions).where(eq(s.inscriptions.id, inscriptionId));
      const ids = [...new Set(inscription.beneficiaireIds.map((b) => (b === source.id ? cible.id : b)))];
      const restants = await tx
        .select({ id: s.beneficiaires.id })
        .from(s.beneficiaires)
        .where(and(inArray(s.beneficiaires.id, ids), eq(s.beneficiaires.statut, "en_attente")));
      await tx
        .update(s.inscriptions)
        .set(restants.length ? { beneficiaireIds: ids } : { beneficiaireIds: ids, statut: "validee", traiteePar: utilisateurId, traiteeLe: maintenant })
        .where(eq(s.inscriptions.id, inscriptionId));
      await tx.insert(s.journalAudit).values({ communeId, utilisateurId, action: "inscription.fusionner", cible: inscriptionId, details: { ficheEnAttenteId, ficheExistanteId } });
    });
  },

  async entreeFaits(communeId, beneficiaireId) {
    const [b] = await db.select().from(s.beneficiaires).where(and(eq(s.beneficiaires.communeId, communeId), eq(s.beneficiaires.id, beneficiaireId)));
    if (!b) return null;
    const [foyer] = await db.select().from(s.foyers).where(eq(s.foyers.id, b.foyerId));
    const cercle = await db
      .select({ relation: s.liensCercle.relation, possedeCles: s.liensCercle.possedeCles, ville: s.contacts.ville, telephone: s.contacts.telephone })
      .from(s.liensCercle)
      .innerJoin(s.contacts, eq(s.contacts.id, s.liensCercle.contactId))
      .where(eq(s.liensCercle.beneficiaireId, b.id));
    const prises = await db
      .select({ type: s.prisesEnCharge.type, possedeCles: s.prisesEnCharge.possedeCles, dateFin: s.prisesEnCharge.dateFin, gir: s.prisesEnCharge.gir })
      .from(s.prisesEnCharge)
      .where(eq(s.prisesEnCharge.beneficiaireId, b.id));
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
      foyer: { sousLesToits: foyer.sousLesToits, pieceFraiche: foyer.pieceFraiche, etage: foyer.etage, typeLogement: foyer.typeLogement },
      cercle,
      prisesEnCharge: prises,
    };
  },

  async mettreAJourScore(communeId, beneficiaireId, score, niveau) {
    await db
      .update(s.beneficiaires)
      .set({ score, niveauPriorite: niveau })
      .where(and(eq(s.beneficiaires.communeId, communeId), eq(s.beneficiaires.id, beneficiaireId)));
  },

  async grilleScore(communeId) {
    const [c] = await db.select({ parametres: s.communes.parametres }).from(s.communes).where(eq(s.communes.id, communeId));
    return completerGrille(c?.parametres.grilleScore);
  },
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Supprime les contacts et foyers qui ne sont plus rattachés à aucune fiche. */
async function supprimerOrphelins(tx: Tx, contactIds: string[], foyerIds: string[]) {
  for (const id of new Set(contactIds)) {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.liensCercle).where(eq(s.liensCercle.contactId, id));
    const [{ m }] = await tx.select({ m: sql<number>`count(*)::int` }).from(s.prisesEnCharge).where(eq(s.prisesEnCharge.contactId, id));
    if (n === 0 && m === 0) await tx.delete(s.contacts).where(eq(s.contacts.id, id));
  }
  for (const id of new Set(foyerIds)) {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.beneficiaires).where(eq(s.beneficiaires.foyerId, id));
    if (n === 0) await tx.delete(s.foyers).where(eq(s.foyers.id, id));
  }
}

export const communePubliqueDrizzle: CommunePubliqueRepository = {
  /** POC : une seule commune (celle du seed) sert le formulaire public. */
  async communePublique() {
    const [c] = await db.select().from(s.communes).orderBy(asc(s.communes.createdAt)).limit(1);
    if (!c) throw new Error("Aucune commune : lancez `pnpm db:seed`.");
    return {
      id: c.id,
      nom: c.nom,
      codePostal: c.codePostal,
      structureNom: c.structureNom,
      structureTelephone: c.structureTelephone,
      rgpd: RGPD_PAR_DEFAUT,
      grilleScore: completerGrille(c.parametres.grilleScore),
    };
  },
};
