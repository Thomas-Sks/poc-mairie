import "server-only";
import { aliasedTable, and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import * as s from "@/shared/infrastructure/db/schema";
import { comparerOrdreAppel } from "@/shared/domain/campagne";
import type { DateISO } from "@/shared/domain/dates";
import { INDISPONIBILITE_LIBELLES, PRISE_EN_CHARGE_LIBELLES, RELATION_LIBELLES, type NiveauPriorite, type StatutCible } from "@/shared/domain/vocabulaire";
import { appelantInitial, appelantsHabituels, STATUTS_NON_JOINT, type BeneficiaireVague } from "../domain/vague";
import type { Alerte, Campagne, CampagneResume, CibleTableau, DepotCrise, Membre } from "../application/ports";
import { notesDeLAlerte } from "./notes-alerte";

async function notesDeLAlerteDeLaCampagne(communeId: string, beneficiaireId: string, campagneId: string) {
  const [c] = await db.select({ alerteId: s.campagnes.alerteId }).from(s.campagnes).where(and(eq(s.campagnes.communeId, communeId), eq(s.campagnes.id, campagneId)));
  return c ? notesDeLAlerte(communeId, beneficiaireId, c.alerteId, campagneId) : [];
}

const niveauEffectif = sql<NiveauPriorite>`coalesce(${s.beneficiaires.niveauForce}, ${s.beneficiaires.niveauPriorite})`;

const adresseFoyer = (f: { numero: number | null; rep: string | null; voie: string; appartement?: string | null }) =>
  `${f.numero ?? ""}${f.rep ? ` ${f.rep}` : ""} ${f.voie}${f.appartement ? `, appt ${f.appartement}` : ""}`.trim();

const versAlerte = (a: typeof s.alertes.$inferSelect): Alerte => ({
  id: a.id,
  type: a.type,
  niveau: a.niveau,
  debut: a.debut,
  finPrevue: a.finPrevue,
  perimetre: a.perimetre,
  message: a.message,
  statut: a.statut,
  clotureeLe: a.clotureeLe,
});

const versResume = (c: typeof s.campagnes.$inferSelect): CampagneResume => ({
  id: c.id,
  alerteId: c.alerteId,
  nom: c.nom,
  type: c.type,
  canal: c.canal,
  frequence: c.frequence,
  statut: c.statut,
  dateDebut: c.dateDebut,
  dateFin: c.dateFin,
  nbPersonnes: c.beneficiaireIds.length,
});

/** Lecture des cibles (avec fiche et adresse), triées dans l'ordre d'appel RG-02. */
async function selectionnerCibles(where: SQL, veilleNonJoints: Set<string> = new Set()) {
  const lignes = await db
    .select({
      cible: s.ciblesCampagne,
      civilite: s.beneficiaires.civilite,
      nom: s.beneficiaires.nom,
      prenom: s.beneficiaires.prenom,
      telephoneFixe: s.beneficiaires.telephoneFixe,
      telephoneMobile: s.beneficiaires.telephoneMobile,
      niveau: niveauEffectif,
      score: s.beneficiaires.score,
      foyer: { numero: s.foyers.numero, rep: s.foyers.rep, voie: s.foyers.voie, appartement: s.foyers.appartement, lat: s.foyers.lat, lon: s.foyers.lon },
    })
    .from(s.ciblesCampagne)
    .innerJoin(s.beneficiaires, eq(s.beneficiaires.id, s.ciblesCampagne.beneficiaireId))
    .innerJoin(s.foyers, eq(s.foyers.id, s.beneficiaires.foyerId))
    .where(where);

  const appelsIa = lignes.length
    ? await db
        .select({ id: s.interactions.id, beneficiaireId: s.interactions.beneficiaireId, campagneId: s.interactions.campagneId, jour: sql<string>`to_char(${s.interactions.survenueLe} at time zone 'Europe/Paris', 'YYYY-MM-DD')` })
        .from(s.interactions)
        .where(and(inArray(s.interactions.campagneId, [...new Set(lignes.map((l) => l.cible.campagneId))]), eq(s.interactions.type, "appel_ia"), isNotNull(s.interactions.detailIa)))
        .orderBy(desc(s.interactions.survenueLe))
    : [];
  const iaPar = new Map<string, string>();
  for (const a of appelsIa) {
    const cle = `${a.beneficiaireId}|${a.jour}`;
    if (!iaPar.has(cle)) iaPar.set(cle, a.id);
  }

  const cles = lignes.map((l) => ({ l, niveau: l.niveau, score: l.score, nonJointVeille: veilleNonJoints.has(l.cible.beneficiaireId) }));
  cles.sort((a, b) => a.l.cible.vagueDate.localeCompare(b.l.cible.vagueDate) || comparerOrdreAppel(a, b) || a.l.nom.localeCompare(b.l.nom));
  const rangs = new Map<string, number>();
  return cles.map(({ l }) => {
    const c = l.cible;
    const rang = (rangs.get(c.vagueDate) ?? 0) + 1;
    rangs.set(c.vagueDate, rang);
    const ligne: CibleTableau & { vagueDate: DateISO } = {
      id: c.id,
      vagueDate: c.vagueDate,
      beneficiaireId: c.beneficiaireId,
      rang,
      civilite: l.civilite,
      nom: l.nom,
      prenom: l.prenom,
      telephone: l.telephoneFixe ?? l.telephoneMobile,
      niveau: l.niveau,
      score: l.score,
      adresse: adresseFoyer(l.foyer),
      lat: l.foyer.lat,
      lon: l.foyer.lon,
      canal: c.canal,
      statut: c.statut,
      exclue: c.exclue,
      motifExclusion: c.motifExclusion,
      couverture: c.couverture,
      assigneA: c.assigneA,
      nbTentatives: c.nbTentatives,
      prochaineTentativeAt: c.prochaineTentativeAt,
      verrouPar: c.verrouPar,
      verrouAt: c.verrouAt,
      niveauRisque: c.niveauRisque,
      besoins: c.besoins,
      note: c.note,
      rangCercleEssaye: c.rangCercleEssaye,
      appelIaId: c.canal === "ia" ? (iaPar.get(`${c.beneficiaireId}|${c.vagueDate}`) ?? null) : null,
    };
    return ligne;
  });
}

async function vagueVeille(campagneId: string, jour: DateISO): Promise<Set<string>> {
  const [prec] = await db
    .select({ v: sql<string | null>`max(${s.ciblesCampagne.vagueDate})` })
    .from(s.ciblesCampagne)
    .where(and(eq(s.ciblesCampagne.campagneId, campagneId), lt(s.ciblesCampagne.vagueDate, jour)));
  if (!prec?.v) return new Set();
  const lignes = await db
    .select({ id: s.ciblesCampagne.beneficiaireId })
    .from(s.ciblesCampagne)
    .where(and(eq(s.ciblesCampagne.campagneId, campagneId), eq(s.ciblesCampagne.vagueDate, prec.v), inArray(s.ciblesCampagne.statut, [...STATUTS_NON_JOINT]), eq(s.ciblesCampagne.exclue, false)));
  return new Set(lignes.map((l) => l.id));
}

export const depotCriseDrizzle: DepotCrise = {
  // ─── Alertes ───────────────────────────────────────────────────────────────
  async creerAlerte(communeId, a, declencheePar) {
    const [ligne] = await db
      .insert(s.alertes)
      .values({ communeId, type: a.type, niveau: a.niveau, debut: a.debut, finPrevue: a.finPrevue, perimetre: a.perimetre, message: a.message, declencheePar })
      .returning({ id: s.alertes.id });
    return ligne.id;
  },

  async obtenirAlerte(communeId, id) {
    const [a] = await db.select().from(s.alertes).where(and(eq(s.alertes.communeId, communeId), eq(s.alertes.id, id)));
    return a ? versAlerte(a) : null;
  },

  async listerAlertes(communeId) {
    const alertes = await db.select().from(s.alertes).where(eq(s.alertes.communeId, communeId)).orderBy(desc(s.alertes.debut), desc(s.alertes.createdAt));
    const campagnes = await db.select().from(s.campagnes).where(eq(s.campagnes.communeId, communeId)).orderBy(desc(s.campagnes.createdAt));
    return alertes.map((a) => ({ ...versAlerte(a), campagnes: campagnes.filter((c) => c.alerteId === a.id).map(versResume) }));
  },

  async cloturerAlerte(communeId, id, at, jour) {
    return db.transaction(async (tx) => {
      await tx.update(s.alertes).set({ statut: "cloturee", clotureeLe: at }).where(and(eq(s.alertes.communeId, communeId), eq(s.alertes.id, id)));
      const fermees = await tx
        .update(s.campagnes)
        .set({ statut: "cloturee", dateFin: sql`least(coalesce(${s.campagnes.dateFin}, ${jour}::date), ${jour}::date)` })
        .where(and(eq(s.campagnes.communeId, communeId), eq(s.campagnes.alerteId, id), eq(s.campagnes.statut, "active")))
        .returning({ id: s.campagnes.id });
      if (fermees.length) {
        await tx
          .update(s.ciblesCampagne)
          .set({ verrouPar: null, verrouAt: null })
          .where(inArray(s.ciblesCampagne.campagneId, fermees.map((f) => f.id)));
      }
      return fermees.map((f) => f.id);
    });
  },

  // ─── Préparation ───────────────────────────────────────────────────────────
  async scriptParType(communeId, type) {
    const [script] = await db.select().from(s.scriptsAppel).where(and(eq(s.scriptsAppel.communeId, communeId), eq(s.scriptsAppel.type, type))).limit(1);
    return script?.contenu ?? null;
  },

  async listerListes(communeId) {
    const listes = await db.select().from(s.listes).where(eq(s.listes.communeId, communeId)).orderBy(asc(s.listes.nom));
    return listes.map((l) => ({ id: l.id, nom: l.nom, type: l.type, nb: l.type === "figee" ? l.beneficiaireIds.length : null }));
  },

  async obtenirListe(communeId, id) {
    const [l] = await db.select().from(s.listes).where(and(eq(s.listes.communeId, communeId), eq(s.listes.id, id)));
    return l ? { type: l.type, filtre: l.filtre, beneficiaireIds: l.beneficiaireIds } : null;
  },

  async idsBeneficiairesActifs(communeId, parmi) {
    if (parmi && parmi.length === 0) return [];
    const lignes = await db
      .select({ id: s.beneficiaires.id })
      .from(s.beneficiaires)
      .where(and(eq(s.beneficiaires.communeId, communeId), eq(s.beneficiaires.statut, "active"), parmi ? inArray(s.beneficiaires.id, parmi) : undefined));
    return lignes.map((l) => l.id);
  },

  async listerVoies(communeId) {
    const lignes = await db.selectDistinct({ voie: s.foyers.voie }).from(s.foyers).where(eq(s.foyers.communeId, communeId)).orderBy(asc(s.foyers.voie));
    return lignes.map((l) => l.voie);
  },

  async listerQuartiers(communeId) {
    const lignes = await db.select({ nom: s.quartiers.nom }).from(s.quartiers).where(eq(s.quartiers.communeId, communeId)).orderBy(asc(s.quartiers.nom));
    return lignes.map((l) => l.nom);
  },

  async listerMembres(communeId, roles) {
    const lignes = await db
      .select({ id: s.utilisateurs.id, prenom: s.utilisateurs.prenom, nom: s.utilisateurs.nom, role: s.utilisateurs.role, telephone: s.utilisateurs.telephone })
      .from(s.utilisateurs)
      .where(and(eq(s.utilisateurs.communeId, communeId), eq(s.utilisateurs.actif, true), roles ? inArray(s.utilisateurs.role, roles) : undefined))
      .orderBy(asc(s.utilisateurs.createdAt));
    return lignes satisfies Membre[];
  },

  // ─── Campagnes ─────────────────────────────────────────────────────────────
  async creerCampagne(communeId, c) {
    const [ligne] = await db.insert(s.campagnes).values({ communeId, ...c }).returning({ id: s.campagnes.id });
    return ligne.id;
  },

  async obtenirCampagne(communeId, id) {
    const [c] = await db.select().from(s.campagnes).where(and(eq(s.campagnes.communeId, communeId), eq(s.campagnes.id, id)));
    if (!c) return null;
    const [a] = c.alerteId ? await db.select().from(s.alertes).where(eq(s.alertes.id, c.alerteId)) : [];
    const campagne: Campagne = {
      ...versResume(c),
      communeId: c.communeId,
      script: c.script,
      frequenceJours: c.frequenceJours,
      relance: c.relance,
      source: c.source,
      beneficiaireIds: c.beneficiaireIds,
      equipe: c.equipe,
      alerte: a ? versAlerte(a) : null,
    };
    return campagne;
  },

  async listerVagues(campagneId) {
    const lignes = await db
      .selectDistinct({ v: s.ciblesCampagne.vagueDate })
      .from(s.ciblesCampagne)
      .where(eq(s.ciblesCampagne.campagneId, campagneId))
      .orderBy(asc(s.ciblesCampagne.vagueDate));
    return lignes.map((l) => l.v);
  },

  async genererVagueSiAbsente(campagne, jour, construire) {
    return db.transaction(async (tx) => {
      // Une seule génération par campagne et par jour, même si plusieurs écrans consultent en même temps.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vague:${campagne.id}:${jour}`}))`);
      const existe = await tx
        .select({ id: s.ciblesCampagne.id })
        .from(s.ciblesCampagne)
        .where(and(eq(s.ciblesCampagne.campagneId, campagne.id), eq(s.ciblesCampagne.vagueDate, jour)))
        .limit(1);
      if (existe.length || campagne.beneficiaireIds.length === 0) return [];

      const benefs = await tx
        .select({ id: s.beneficiaires.id, niveau: niveauEffectif, score: s.beneficiaires.score, consentementIa: s.beneficiaires.consentementIa, iaActivee: s.beneficiaires.iaActivee })
        .from(s.beneficiaires)
        .where(and(eq(s.beneficiaires.communeId, campagne.communeId), eq(s.beneficiaires.statut, "active"), inArray(s.beneficiaires.id, campagne.beneficiaireIds)));
      const ids = benefs.map((b) => b.id);
      if (ids.length === 0) return [];

      const [passages, indispos, dejaJoints, veille, confiees] = await Promise.all([
        tx
          .select({
            beneficiaireId: s.prisesEnCharge.beneficiaireId,
            type: s.prisesEnCharge.type,
            intervenant: s.prisesEnCharge.intervenantNom,
            dateDebut: s.prisesEnCharge.dateDebut,
            dateFin: s.prisesEnCharge.dateFin,
            joursSemaine: s.creneauxPassage.joursSemaine,
            heureDebut: s.creneauxPassage.heureDebut,
            exceptions: s.creneauxPassage.exceptions,
          })
          .from(s.creneauxPassage)
          .innerJoin(s.prisesEnCharge, eq(s.prisesEnCharge.id, s.creneauxPassage.priseEnChargeId))
          .where(inArray(s.prisesEnCharge.beneficiaireId, ids)),
        tx
          .select({ beneficiaireId: s.indisponibilites.beneficiaireId, type: s.indisponibilites.type, debut: s.indisponibilites.debut, fin: s.indisponibilites.fin })
          .from(s.indisponibilites)
          .where(inArray(s.indisponibilites.beneficiaireId, ids)),
        tx
          .select({ beneficiaireId: s.ciblesCampagne.beneficiaireId, statut: s.ciblesCampagne.statut })
          .from(s.ciblesCampagne)
          .innerJoin(s.campagnes, eq(s.campagnes.id, s.ciblesCampagne.campagneId))
          .where(
            and(
              eq(s.campagnes.communeId, campagne.communeId),
              ne(s.ciblesCampagne.campagneId, campagne.id),
              eq(s.ciblesCampagne.vagueDate, jour),
              inArray(s.ciblesCampagne.statut, ["joint_ras", "couvert_proche"]),
              // Les résultats IA sont fictifs (maquette E11) : ils ne couvrent personne.
              eq(s.ciblesCampagne.canal, "humain"),
              inArray(s.ciblesCampagne.beneficiaireId, ids),
            ),
          ),
        vagueVeille(campagne.id, jour),
        tx
          .select({ beneficiaireId: s.assignations.beneficiaireId, benevoleId: s.assignations.utilisateurId, confieeLe: s.assignations.assigneLe })
          .from(s.assignations)
          .innerJoin(s.utilisateurs, eq(s.utilisateurs.id, s.assignations.utilisateurId))
          .where(and(inArray(s.assignations.beneficiaireId, ids), eq(s.utilisateurs.role, "benevole"), eq(s.utilisateurs.actif, true))),
      ]);
      const habituels = appelantsHabituels(confiees);

      const faits: BeneficiaireVague[] = benefs.map((b) => ({
        id: b.id,
        niveau: b.niveau,
        score: b.score,
        consentementIa: b.consentementIa,
        iaActivee: b.iaActivee,
        nonJointVeille: veille.has(b.id),
        faits: {
          passages: passages
            .filter((p) => p.beneficiaireId === b.id)
            .map((p) => ({
              libelle: p.intervenant ?? PRISE_EN_CHARGE_LIBELLES[p.type],
              joursSemaine: p.joursSemaine,
              heureDebut: p.heureDebut,
              exceptions: p.exceptions,
              dateDebut: p.dateDebut,
              dateFin: p.dateFin,
            })),
          indisponibilites: indispos.filter((i) => i.beneficiaireId === b.id).map((i) => ({ libelle: INDISPONIBILITE_LIBELLES[i.type], debut: i.debut, fin: i.fin })),
          statutDuJour: (dejaJoints.find((d) => d.beneficiaireId === b.id)?.statut as StatutCible | undefined) ?? null,
        },
      }));

      const generees = construire(faits);
      if (generees.length === 0) return [];
      const inserees = await tx
        .insert(s.ciblesCampagne)
        .values(
          generees.map((g) => ({
            campagneId: campagne.id,
            beneficiaireId: g.beneficiaireId,
            vagueDate: jour,
            assigneA: appelantInitial(g, habituels),
            canal: g.canal,
            statut: g.statut,
            exclue: g.exclue,
            motifExclusion: g.motifExclusion,
            couverture: g.couverture,
            nbTentatives: g.maquetteIa?.nbTentatives ?? 0,
            niveauRisque: g.maquetteIa?.risque ?? null,
            besoins: g.maquetteIa?.besoins ?? [],
            note: g.maquetteIa?.note ?? null,
          })),
        )
        .returning({ id: s.ciblesCampagne.id, beneficiaireId: s.ciblesCampagne.beneficiaireId });
      return inserees.map((i) => ({ id: i.id, generee: generees.find((g) => g.beneficiaireId === i.beneficiaireId)! }));
    });
  },

  async listerCibles(communeId, campagneId, vague) {
    const [campagne] = await db.select({ id: s.campagnes.id }).from(s.campagnes).where(and(eq(s.campagnes.communeId, communeId), eq(s.campagnes.id, campagneId)));
    if (!campagne) return [];
    const veille = await vagueVeille(campagneId, vague);
    return selectionnerCibles(and(eq(s.ciblesCampagne.campagneId, campagneId), eq(s.ciblesCampagne.vagueDate, vague))!, veille);
  },

  async assigner(communeId, campagneId, affectations) {
    const [campagne] = await db.select({ id: s.campagnes.id }).from(s.campagnes).where(and(eq(s.campagnes.communeId, communeId), eq(s.campagnes.id, campagneId)));
    if (!campagne) throw new Error("Campagne introuvable.");
    const parUtilisateur = new Map<string | null, string[]>();
    for (const a of affectations) parUtilisateur.set(a.utilisateurId, [...(parUtilisateur.get(a.utilisateurId) ?? []), a.cibleId]);
    await db.transaction(async (tx) => {
      for (const [utilisateurId, cibleIds] of parUtilisateur) {
        await tx
          .update(s.ciblesCampagne)
          .set({ assigneA: utilisateurId, updatedAt: new Date() })
          .where(and(eq(s.ciblesCampagne.campagneId, campagneId), inArray(s.ciblesCampagne.id, cibleIds)));
      }
    });
  },

  // ─── Cibles et appels ──────────────────────────────────────────────────────
  async obtenirCible(communeId, cibleId) {
    const [l] = await db
      .select({ cible: s.ciblesCampagne, campagne: s.campagnes, b: { civilite: s.beneficiaires.civilite, prenom: s.beneficiaires.prenom, nom: s.beneficiaires.nom } })
      .from(s.ciblesCampagne)
      .innerJoin(s.campagnes, eq(s.campagnes.id, s.ciblesCampagne.campagneId))
      .innerJoin(s.beneficiaires, eq(s.beneficiaires.id, s.ciblesCampagne.beneficiaireId))
      .where(and(eq(s.campagnes.communeId, communeId), eq(s.ciblesCampagne.id, cibleId)));
    if (!l) return null;
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.liensCercle)
      .innerJoin(s.contacts, eq(s.contacts.id, s.liensCercle.contactId))
      .where(and(eq(s.liensCercle.beneficiaireId, l.cible.beneficiaireId), or(isNotNull(s.contacts.telephone), isNotNull(s.contacts.telephone2))));
    return {
      id: l.cible.id,
      campagneId: l.campagne.id,
      communeId: l.campagne.communeId,
      campagneStatut: l.campagne.statut,
      campagneNom: l.campagne.nom,
      relance: l.campagne.relance,
      beneficiaireId: l.cible.beneficiaireId,
      beneficiaireNom: `${l.b.civilite} ${l.b.prenom} ${l.b.nom}`,
      vagueDate: l.cible.vagueDate,
      statut: l.cible.statut,
      nbTentatives: l.cible.nbTentatives,
      prochaineTentativeAt: l.cible.prochaineTentativeAt,
      rangCercleEssaye: l.cible.rangCercleEssaye,
      assigneA: l.cible.assigneA,
      verrouPar: l.cible.verrouPar,
      verrouAt: l.cible.verrouAt,
      besoins: l.cible.besoins,
      nbContactsCercle: n,
    };
  },

  notesAlerte: notesDeLAlerteDeLaCampagne,

  async obtenirFicheAppel(communeId, beneficiaireId) {
    const [l] = await db
      .select({ b: s.beneficiaires, f: s.foyers })
      .from(s.beneficiaires)
      .innerJoin(s.foyers, eq(s.foyers.id, s.beneficiaires.foyerId))
      .where(and(eq(s.beneficiaires.communeId, communeId), eq(s.beneficiaires.id, beneficiaireId)));
    if (!l) return null;
    const cercle = await db
      .select({ lien: s.liensCercle, contact: s.contacts })
      .from(s.liensCercle)
      .innerJoin(s.contacts, eq(s.contacts.id, s.liensCercle.contactId))
      .where(eq(s.liensCercle.beneficiaireId, beneficiaireId))
      .orderBy(asc(s.liensCercle.rangAppel));
    return {
      beneficiaireId,
      civilite: l.b.civilite,
      nom: l.b.nom,
      prenom: l.b.prenom,
      telephoneFixe: l.b.telephoneFixe,
      telephoneMobile: l.b.telephoneMobile,
      adresse: `${adresseFoyer(l.f)}, ${l.f.codePostal} ${l.f.ville}`,
      infoPrioritaire: l.b.infoPrioritaire,
      cercle: cercle
        .filter((c) => c.contact.telephone || c.contact.telephone2)
        .map((c, i) => ({
          id: c.contact.id,
          rang: i + 1,
          relation: RELATION_LIBELLES[c.lien.relation],
          nom: [c.contact.prenom, c.contact.nom].filter(Boolean).join(" "),
          telephone: c.contact.telephone ?? c.contact.telephone2,
          possedeCles: c.lien.possedeCles,
        })),
    };
  },

  async mettreAJourCible(cibleId, maj) {
    await db.update(s.ciblesCampagne).set({ ...maj, updatedAt: new Date() }).where(eq(s.ciblesCampagne.id, cibleId));
  },

  async poserVerrou(cibleId, utilisateurId, maintenant, expireAvant) {
    const pris = await db
      .update(s.ciblesCampagne)
      .set({ verrouPar: utilisateurId, verrouAt: maintenant })
      .where(
        and(
          eq(s.ciblesCampagne.id, cibleId),
          or(isNull(s.ciblesCampagne.verrouPar), eq(s.ciblesCampagne.verrouPar, utilisateurId), lt(s.ciblesCampagne.verrouAt, expireAvant)),
        ),
      )
      .returning({ id: s.ciblesCampagne.id });
    if (pris.length) return { obtenu: true, detenteur: utilisateurId };
    const [c] = await db.select({ verrouPar: s.ciblesCampagne.verrouPar }).from(s.ciblesCampagne).where(eq(s.ciblesCampagne.id, cibleId));
    return { obtenu: false, detenteur: c?.verrouPar ?? null };
  },

  async leverVerrou(cibleId, utilisateurId) {
    await db
      .update(s.ciblesCampagne)
      .set({ verrouPar: null, verrouAt: null })
      .where(and(eq(s.ciblesCampagne.id, cibleId), eq(s.ciblesCampagne.verrouPar, utilisateurId)));
  },

  async creerInteraction(communeId, i) {
    const [ligne] = await db.insert(s.interactions).values({ communeId, ...i }).returning({ id: s.interactions.id });
    return ligne.id;
  },

  async creerRappel(communeId, r) {
    await db.insert(s.rappels).values({ communeId, ...r });
  },

  // ─── Rapport et maquettes IA ───────────────────────────────────────────────
  async donneesRapport(communeId, campagneId) {
    const campagne = await this.obtenirCampagne(communeId, campagneId);
    if (!campagne) return null;
    const cibles = await selectionnerCibles(eq(s.ciblesCampagne.campagneId, campagneId));
    const auteurs = aliasedTable(s.utilisateurs, "auteur");
    const interactions = await db
      .select({
        id: s.interactions.id,
        beneficiaireId: s.interactions.beneficiaireId,
        survenueLe: s.interactions.survenueLe,
        type: s.interactions.type,
        resultat: s.interactions.resultat,
        compteRendu: s.interactions.compteRendu,
        auteurPrenom: auteurs.prenom,
        auteurNom: auteurs.nom,
      })
      .from(s.interactions)
      .leftJoin(auteurs, eq(auteurs.id, s.interactions.auteurId))
      .where(and(eq(s.interactions.communeId, communeId), eq(s.interactions.campagneId, campagneId)))
      .orderBy(asc(s.interactions.survenueLe));
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.rappels)
      .where(and(eq(s.rappels.communeId, communeId), eq(s.rappels.type, "besoin"), sql`${s.rappels.objet} like ${`%– ${campagne.nom}`}`));
    return {
      campagne,
      cibles,
      interactions: interactions.map((i) => ({
        id: i.id,
        beneficiaireId: i.beneficiaireId,
        survenueLe: i.survenueLe,
        type: i.type,
        resultat: i.resultat,
        compteRendu: i.compteRendu,
        auteur: i.type === "appel_ia" ? "IA (démonstration)" : i.auteurPrenom ? `${i.auteurPrenom} ${i.auteurNom}` : null,
      })),
      rappelsCrees: n,
    };
  },

  async obtenirAppelIa(communeId, interactionId) {
    const [l] = await db
      .select({ i: s.interactions, b: s.beneficiaires, c: { id: s.campagnes.id, nom: s.campagnes.nom } })
      .from(s.interactions)
      .innerJoin(s.beneficiaires, eq(s.beneficiaires.id, s.interactions.beneficiaireId))
      .innerJoin(s.campagnes, eq(s.campagnes.id, s.interactions.campagneId))
      .where(and(eq(s.interactions.communeId, communeId), eq(s.interactions.id, interactionId)));
    if (!l?.i.detailIa) return null;
    return {
      interactionId: l.i.id,
      campagneId: l.c.id,
      campagneNom: l.c.nom,
      beneficiaireId: l.b.id,
      beneficiaire: `${l.b.civilite} ${l.b.prenom} ${l.b.nom}`,
      telephone: l.b.telephoneFixe ?? l.b.telephoneMobile,
      survenueLe: l.i.survenueLe,
      dureeMinutes: l.i.dureeMinutes,
      resultat: l.i.resultat,
      detail: l.i.detailIa,
    };
  },
};
