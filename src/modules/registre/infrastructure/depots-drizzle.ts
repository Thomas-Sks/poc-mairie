import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import {
  adresses,
  assignations,
  beneficiaires as b,
  foyers as f,
  historiqueModifications,
  interactions,
  journalAudit,
  listes,
  notifications,
  presences,
  quartiers,
  tags,
  utilisateurs,
  vuesSauvegardees,
} from "@/shared/infrastructure/db/schema";
import { calculerAge, type DateISO } from "@/shared/domain/dates";
import type { MotifArchivage } from "@/shared/domain/vocabulaire";
import { lireFiltre, versJson } from "../domain/filtre";
import { lireConfigVue, type LigneBeneficiaire } from "../domain/tableau";
import type {
  ActionsRepository,
  ListesRepository,
  Membre,
  PresencesRepository,
  ReferentielsRepository,
  RegistreRepository,
  VuesRepository,
} from "../application/ports";
import { apaEnCours, conditionsCommune, dernierContactTexte, indisponibleLe, niveauEffectif, ordrePriorite, ordreTri, SANS_ACCENTS, sansAccents } from "./sql-filtre";

const colonnesLigne = (jour: DateISO) => ({
  id: b.id,
  civilite: b.civilite,
  nom: b.nom,
  prenom: b.prenom,
  dateNaissance: b.dateNaissance,
  sexe: b.sexe,
  niveau: niveauEffectif,
  score: b.score,
  statut: b.statut,
  telephone: b.telephoneFixe,
  telephoneMobile: b.telephoneMobile,
  numero: f.numero,
  rep: f.rep,
  voie: f.voie,
  quartier: f.quartier,
  modeDeVie: b.modeDeVie,
  deplacement: b.deplacement,
  gir: b.gir,
  handicap: b.handicap,
  apa: apaEnCours(jour),
  tags: b.tags,
  dernierContact: dernierContactTexte,
  indisponible: indisponibleLe(jour),
  lat: f.lat,
  lon: f.lon,
});

type LigneBrute = Omit<LigneBeneficiaire, "age" | "assignes">;

async function completerLignes(brutes: LigneBrute[], jour: DateISO): Promise<LigneBeneficiaire[]> {
  const ids = brutes.map((l) => l.id);
  const assign =
    ids.length === 0
      ? []
      : await db
          .select({ beneficiaireId: assignations.beneficiaireId, utilisateurId: assignations.utilisateurId })
          .from(assignations)
          .where(inArray(assignations.beneficiaireId, ids))
          .orderBy(asc(assignations.assigneLe));
  const parBenef = new Map<string, string[]>();
  for (const a of assign) parBenef.set(a.beneficiaireId, [...(parBenef.get(a.beneficiaireId) ?? []), a.utilisateurId]);
  return brutes.map((l) => ({
    ...l,
    apa: Boolean(l.apa),
    indisponible: Boolean(l.indisponible),
    age: calculerAge(l.dateNaissance, jour),
    assignes: parBenef.get(l.id) ?? [],
  }));
}

export const registreDrizzle: RegistreRepository = {
  async rechercher(communeId, filtres, { tri, page, taillePage, jour }) {
    const rows = await db
      .select({ ...colonnesLigne(jour), total: sql<number>`count(*) over ()`.mapWith(Number) })
      .from(b)
      .innerJoin(f, eq(f.id, b.foyerId))
      .where(conditionsCommune(communeId, filtres, jour))
      .orderBy(...ordreTri(tri))
      .limit(taillePage)
      .offset(page * taillePage);
    let total = rows[0]?.total ?? 0;
    if (rows.length === 0 && page > 0) {
      const [c] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(b)
        .innerJoin(f, eq(f.id, b.foyerId))
        .where(conditionsCommune(communeId, filtres, jour));
      total = c?.n ?? 0;
    }
    const lignes = await completerLignes(
      rows.map(({ total: nb, ...l }) => (void nb, l)),
      jour,
    );
    return { lignes, total };
  },

  async rechercherIds(communeId, filtres, jour) {
    const rows = await db
      .select({ id: b.id })
      .from(b)
      .innerJoin(f, eq(f.id, b.foyerId))
      .where(conditionsCommune(communeId, filtres, jour))
      .orderBy(...ordrePriorite);
    return rows.map((r) => r.id);
  },

  async lignes(communeId, filtres, jour) {
    const rows = await db
      .select(colonnesLigne(jour))
      .from(b)
      .innerJoin(f, eq(f.id, b.foyerId))
      .where(conditionsCommune(communeId, filtres, jour))
      .orderBy(...ordrePriorite);
    return completerLignes(rows, jour);
  },

  async pointsCarte(communeId, filtres, jour) {
    const rows = await db
      .select({ id: b.id, civilite: b.civilite, nom: b.nom, prenom: b.prenom, lat: f.lat, lon: f.lon, niveau: niveauEffectif, numero: f.numero, voie: f.voie })
      .from(b)
      .innerJoin(f, eq(f.id, b.foyerId))
      .where(and(conditionsCommune(communeId, filtres, jour), isNotNull(f.lat), isNotNull(f.lon)))
      .orderBy(desc(niveauEffectif)); // P1 dessinés en dernier, donc au-dessus
    return rows.map((r) => ({
      id: r.id,
      nom: `${r.civilite} ${r.nom} ${r.prenom}`,
      lat: r.lat!,
      lon: r.lon!,
      niveau: r.niveau,
      adresse: [r.numero, r.voie].filter((x) => x !== null).join(" "),
    }));
  },

  async idsDeLaCommune(communeId, ids) {
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: b.id })
      .from(b)
      .where(and(eq(b.communeId, communeId), inArray(b.id, ids)));
    return rows.map((r) => r.id);
  },

  async ordonnerParPriorite(communeId, ids) {
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: b.id })
      .from(b)
      .where(and(eq(b.communeId, communeId), inArray(b.id, ids)))
      .orderBy(...ordrePriorite);
    return rows.map((r) => r.id);
  },
};

export const referentielsDrizzle: ReferentielsRepository = {
  async voies(communeId, recherche, limite) {
    if (!recherche) return [];
    const terme = sansAccents(recherche.toLowerCase()).replace(/[\\%_]/g, (c) => `\\${c}`);
    const voie = sql`${SANS_ACCENTS(adresses.voie)}`;
    // Priorité : un mot de la voie commence par la saisie, puis les voies où habitent des bénéficiaires.
    const rows = await db
      .select({ voie: adresses.voie })
      .from(adresses)
      .where(and(eq(adresses.communeId, communeId), sql`${voie} like ${`%${terme}%`}`))
      .groupBy(adresses.voie)
      .orderBy(
        sql`bool_or(${voie} like ${`${terme}%`} or ${voie} like ${`% ${terme}%`} or ${voie} like ${`%'${terme}%`}) desc`,
        sql`exists (select 1 from foyers fo where fo.commune_id = ${communeId} and fo.voie = ${adresses.voie}) desc`,
        asc(adresses.voie),
      )
      .limit(limite);
    return rows.map((r) => r.voie);
  },
  async quartiers(communeId) {
    const rows = await db.select({ nom: quartiers.nom }).from(quartiers).where(eq(quartiers.communeId, communeId)).orderBy(asc(quartiers.nom));
    return rows.map((r) => r.nom);
  },
  async tags(communeId) {
    const rows = await db.select({ libelle: tags.libelle }).from(tags).where(eq(tags.communeId, communeId)).orderBy(asc(tags.libelle));
    return rows.map((r) => r.libelle);
  },
  async equipe(communeId) {
    return db
      .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role })
      .from(utilisateurs)
      .where(and(eq(utilisateurs.communeId, communeId), eq(utilisateurs.actif, true), inArray(utilisateurs.role, ["admin", "agent", "benevole"])))
      .orderBy(asc(utilisateurs.createdAt), asc(utilisateurs.prenom));
  },
};

export const actionsDrizzle: ActionsRepository = {
  async assigner(_communeId, affectations, { remplacer, beneficiaireIds }) {
    await db.transaction(async (tx) => {
      if (remplacer && beneficiaireIds.length > 0) await tx.delete(assignations).where(inArray(assignations.beneficiaireId, beneficiaireIds));
      if (affectations.length > 0) await tx.insert(assignations).values(affectations).onConflictDoNothing();
    });
  },

  async retirerAssignations(beneficiaireIds) {
    if (beneficiaireIds.length === 0) return;
    await db.delete(assignations).where(inArray(assignations.beneficiaireId, beneficiaireIds));
  },

  async ajouterTag(communeId, ids, tag, auteurId) {
    if (ids.length === 0) return 0;
    return db.transaction(async (tx) => {
      const maj = await tx
        .update(b)
        .set({ tags: sql`array_append(${b.tags}, ${tag}::text)`, updatedAt: new Date() })
        .where(and(eq(b.communeId, communeId), inArray(b.id, ids), sql`not (${tag}::text = any(${b.tags}))`))
        .returning({ id: b.id });
      if (maj.length > 0) {
        await tx
          .insert(historiqueModifications)
          .values(maj.map((m) => ({ beneficiaireId: m.id, auteurId, champ: "tags", ancienneValeur: null, nouvelleValeur: `+ ${tag}` })));
      }
      const existe = await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.communeId, communeId), eq(tags.libelle, tag))).limit(1);
      if (existe.length === 0) await tx.insert(tags).values({ communeId, libelle: tag });
      return maj.length;
    });
  },

  async changerStatut(communeId, ids, statut, motif, auteurId) {
    if (ids.length === 0) return 0;
    return db.transaction(async (tx) => {
      const avant = await tx
        .select({ id: b.id, statut: b.statut })
        .from(b)
        .where(and(eq(b.communeId, communeId), inArray(b.id, ids)));
      const aChanger = avant.filter((a) => a.statut !== statut);
      if (aChanger.length === 0) return 0;
      await tx
        .update(b)
        .set({
          statut,
          motifArchivage: statut === "archivee" ? ((motif.motifArchivage as MotifArchivage | undefined) ?? null) : null,
          motifStatut: motif.motifStatut ?? null,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            b.id,
            aChanger.map((a) => a.id),
          ),
        );
      await tx
        .insert(historiqueModifications)
        .values(aChanger.map((a) => ({ beneficiaireId: a.id, auteurId, champ: "statut", ancienneValeur: a.statut, nouvelleValeur: statut })));
      return aChanger.length;
    });
  },

  async enregistrerAppel(communeId, e) {
    const [row] = await db
      .insert(interactions)
      .values({
        communeId,
        beneficiaireId: e.beneficiaireId,
        type: "appel_sortant",
        survenueLe: e.at,
        auteurId: e.auteurId,
        resultat: e.resultat,
        compteRendu: e.commentaire ?? null,
      })
      .returning({ id: interactions.id });
    return row.id;
  },

  async completerAppel(communeId, interactionId, auteurId, commentaire) {
    const rows = await db
      .update(interactions)
      .set({ compteRendu: commentaire })
      .where(and(eq(interactions.id, interactionId), eq(interactions.communeId, communeId), eq(interactions.auteurId, auteurId)))
      .returning({ id: interactions.id });
    return rows.length > 0;
  },

  async notifier(communeId, destinataireId, titre, message, lien) {
    await db.insert(notifications).values({ communeId, destinataireId, type: "assignation", titre, message, lien });
  },

  async journaliser(communeId, utilisateurId, action, cible, details) {
    await db.insert(journalAudit).values({ communeId, utilisateurId, action, cible, details });
  },
};

const versListe = (r: typeof listes.$inferSelect) => ({
  id: r.id,
  nom: r.nom,
  type: r.type,
  filtre: lireFiltre(r.filtre),
  beneficiaireIds: r.beneficiaireIds,
  creePar: r.creePar,
  createdAt: r.createdAt,
});

export const listesDrizzle: ListesRepository = {
  async lister(communeId) {
    const rows = await db.select().from(listes).where(eq(listes.communeId, communeId)).orderBy(desc(listes.createdAt));
    return rows.map(versListe);
  },
  async trouver(communeId, id) {
    const [row] = await db
      .select()
      .from(listes)
      .where(and(eq(listes.communeId, communeId), eq(listes.id, id)))
      .limit(1);
    return row ? versListe(row) : null;
  },
  async creer(communeId, l) {
    const [row] = await db
      .insert(listes)
      .values({ communeId, nom: l.nom, type: l.type, filtre: versJson(l.filtre), beneficiaireIds: l.beneficiaireIds, creePar: l.creePar })
      .returning({ id: listes.id });
    return row.id;
  },
  async renommer(communeId, id, nom) {
    await db
      .update(listes)
      .set({ nom })
      .where(and(eq(listes.communeId, communeId), eq(listes.id, id)));
  },
  async supprimer(communeId, id) {
    await db.delete(listes).where(and(eq(listes.communeId, communeId), eq(listes.id, id)));
  },
};

export const vuesDrizzle: VuesRepository = {
  async lister(utilisateurId) {
    const rows = await db.select().from(vuesSauvegardees).where(eq(vuesSauvegardees.utilisateurId, utilisateurId)).orderBy(asc(vuesSauvegardees.nom));
    return rows.flatMap((r) => {
      try {
        return [{ id: r.id, nom: r.nom, config: lireConfigVue(r.config) }];
      } catch {
        return []; // vue devenue invalide (colonne supprimée…) : ignorée
      }
    });
  },
  async creer(utilisateurId, nom, config) {
    const [row] = await db
      .insert(vuesSauvegardees)
      .values({ utilisateurId, nom, config: { ...config, filtre: versJson(config.filtre) } })
      .returning({ id: vuesSauvegardees.id });
    return row.id;
  },
  async supprimer(utilisateurId, id) {
    await db.delete(vuesSauvegardees).where(and(eq(vuesSauvegardees.utilisateurId, utilisateurId), eq(vuesSauvegardees.id, id)));
  },
};

export const presencesDrizzle: PresencesRepository = {
  async signaler(utilisateurId, ressource, at) {
    await db
      .insert(presences)
      .values({ utilisateurId, ressource, vuLe: at })
      .onConflictDoUpdate({ target: [presences.utilisateurId, presences.ressource], set: { vuLe: at } });
  },
  async presents(communeId, ressource, depuis): Promise<Membre[]> {
    return db
      .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role })
      .from(presences)
      .innerJoin(utilisateurs, eq(utilisateurs.id, presences.utilisateurId))
      .where(and(eq(utilisateurs.communeId, communeId), eq(presences.ressource, ressource), gte(presences.vuLe, depuis)))
      .orderBy(asc(utilisateurs.prenom));
  },
};

