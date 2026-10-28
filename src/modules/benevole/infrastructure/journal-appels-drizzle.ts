import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { DUREE_VERROU_MS, RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import { aujourdhui } from "@/shared/domain/dates";
import { RELATION_LIBELLES, type StatutCible } from "@/shared/domain/vocabulaire";
import { db } from "@/shared/infrastructure/db/client";
import {
  beneficiaires,
  campagnes,
  ciblesCampagne,
  contacts,
  historiqueModifications,
  interactions,
  journalAudit,
  liensCercle,
  notifications,
  rappels,
  utilisateurs,
} from "@/shared/infrastructure/db/schema";
import type { Appelant, CommandeDemande, CommandeProche, CommandeResultat, IssueEnregistrement, JournalAppels } from "../application/ports";
import { objetTacheBesoin } from "../domain/besoins";
import { issueAppel, issueProche, RESULTAT_PROCHE_LIBELLES } from "../domain/issue-appel";
import { STATUTS_A_FAIRE } from "../domain/ma-liste";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ACTION_OPERATION = "benevole.operation";

/** Idempotence : une opération rejouée depuis la file hors connexion n'est appliquée qu'une fois. */
async function dejaFaite(tx: Tx, communeId: string, idOperation: string): Promise<boolean> {
  const [ligne] = await tx
    .select({ id: journalAudit.id })
    .from(journalAudit)
    .where(and(eq(journalAudit.communeId, communeId), eq(journalAudit.action, ACTION_OPERATION), eq(journalAudit.cible, idOperation)))
    .limit(1);
  return Boolean(ligne);
}

async function tracer(tx: Tx, communeId: string, appelant: Appelant, idOperation: string, details: Record<string, unknown>) {
  await tx.insert(journalAudit).values({ communeId, utilisateurId: appelant.id, action: ACTION_OPERATION, cible: idOperation, details });
}

/** Cible + campagne + personne, dans la commune. */
async function chargerCible(tx: Tx, communeId: string, cibleId: string) {
  const [c] = await tx
    .select({
      id: ciblesCampagne.id,
      campagneId: ciblesCampagne.campagneId,
      beneficiaireId: ciblesCampagne.beneficiaireId,
      statut: ciblesCampagne.statut,
      nbTentatives: ciblesCampagne.nbTentatives,
      rangCercleEssaye: ciblesCampagne.rangCercleEssaye,
      note: ciblesCampagne.note,
      relance: campagnes.relance,
      civilite: beneficiaires.civilite,
      prenom: beneficiaires.prenom,
      nom: beneficiaires.nom,
      tags: beneficiaires.tags,
    })
    .from(ciblesCampagne)
    .innerJoin(campagnes, eq(campagnes.id, ciblesCampagne.campagneId))
    .innerJoin(beneficiaires, eq(beneficiaires.id, ciblesCampagne.beneficiaireId))
    .where(and(eq(ciblesCampagne.id, cibleId), eq(campagnes.communeId, communeId)))
    .limit(1);
  if (!c) throw new Error("Personne introuvable.");
  return { ...c, relance: c.relance ?? RELANCE_PAR_DEFAUT, personne: `${c.civilite} ${c.prenom} ${c.nom}` };
}

/** E10-US6 / RG-06 : notification instantanée à l'admin et aux agents (le SMS d'astreinte est simulé côté interface). */
async function prevenirEquipe(
  tx: Tx,
  communeId: string,
  type: "danger" | "escalade" | "info",
  titre: string,
  message: string | null,
  beneficiaireId: string,
) {
  const equipe = await tx
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.communeId, communeId), eq(utilisateurs.actif, true), inArray(utilisateurs.role, ["admin", "agent"])));
  if (equipe.length === 0) return;
  await tx.insert(notifications).values(
    equipe.map((u) => ({ communeId, destinataireId: u.id, type, titre, message, lien: `/beneficiaires/${beneficiaireId}` })),
  );
}

const joindre = (...parties: (string | null | undefined)[]) => parties.filter((p) => p && p.trim()).join(" · ") || null;

async function etatActuel(tx: Tx, cibleId: string): Promise<StatutCible> {
  const [c] = await tx.select({ statut: ciblesCampagne.statut }).from(ciblesCampagne).where(eq(ciblesCampagne.id, cibleId));
  return c?.statut ?? "a_appeler";
}

export const journalAppelsDrizzle: JournalAppels = {
  async prendreVerrou(communeId, cibleId, appelantId, maintenant) {
    const expire = new Date(maintenant.getTime() - DUREE_VERROU_MS);
    const pris = await db
      .update(ciblesCampagne)
      .set({ verrouPar: appelantId, verrouAt: maintenant })
      .where(
        and(
          eq(ciblesCampagne.id, cibleId),
          inArray(ciblesCampagne.campagneId, db.select({ id: campagnes.id }).from(campagnes).where(eq(campagnes.communeId, communeId))),
          // verrouActif() côté SQL : libre, déjà à moi, ou expiré (10 min).
          or(isNull(ciblesCampagne.verrouPar), eq(ciblesCampagne.verrouPar, appelantId), isNull(ciblesCampagne.verrouAt), lt(ciblesCampagne.verrouAt, expire)),
        ),
      )
      .returning({ id: ciblesCampagne.id });
    return pris.length > 0;
  },

  async libererVerrou(communeId, cibleId, appelantId) {
    await db
      .update(ciblesCampagne)
      .set({ verrouPar: null, verrouAt: null })
      .where(
        and(
          eq(ciblesCampagne.id, cibleId),
          eq(ciblesCampagne.verrouPar, appelantId),
          inArray(ciblesCampagne.campagneId, db.select({ id: campagnes.id }).from(campagnes).where(eq(campagnes.communeId, communeId))),
        ),
      );
  },

  async enregistrerResultat(cmd: CommandeResultat): Promise<IssueEnregistrement> {
    return db.transaction(async (tx) => {
      if (await dejaFaite(tx, cmd.communeId, cmd.idOperation)) {
        return { statut: await etatActuel(tx, cmd.cibleId), dejaEnregistre: true, alerte: null };
      }
      const c = await chargerCible(tx, cmd.communeId, cmd.cibleId);
      const [{ joignables }] = await tx
        .select({ joignables: sql<number>`count(*)::int` })
        .from(liensCercle)
        .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
        .where(and(eq(liensCercle.beneficiaireId, c.beneficiaireId), isNotNull(contacts.telephone)));

      const maj = issueAppel(cmd.resultat, { ...c, cercleJoignable: joignables > 0 }, cmd.maintenant, c.relance);
      const compteRendu = joindre(cmd.precision, cmd.note);

      await tx
        .update(ciblesCampagne)
        .set({
          statut: maj.statut,
          nbTentatives: maj.nbTentatives,
          prochaineTentativeAt: maj.prochaineTentativeAt,
          couverture: maj.couverture,
          reponses: Object.keys(cmd.reponses).length ? cmd.reponses : undefined,
          besoins: cmd.besoins,
          note: compteRendu ?? c.note,
          verrouPar: null,
          verrouAt: null,
          updatedAt: cmd.maintenant,
        })
        .where(eq(ciblesCampagne.id, c.id));

      await tx.insert(interactions).values({
        communeId: cmd.communeId,
        beneficiaireId: c.beneficiaireId,
        type: "appel_sortant",
        survenueLe: cmd.maintenant,
        auteurId: cmd.appelant.id,
        resultat: maj.statut,
        compteRendu,
        besoins: cmd.besoins,
        campagneId: c.campagneId,
      });

      // Tag « isolement » (ou autre) ajouté à la personne.
      const nouveaux = cmd.tags.filter((t) => !c.tags.includes(t));
      if (nouveaux.length) {
        await tx.update(beneficiaires).set({ tags: [...c.tags, ...nouveaux], updatedAt: cmd.maintenant }).where(eq(beneficiaires.id, c.beneficiaireId));
        await tx.insert(historiqueModifications).values({
          beneficiaireId: c.beneficiaireId,
          auteurId: cmd.appelant.id,
          champ: "tags",
          ancienneValeur: c.tags.join(", ") || null,
          nouvelleValeur: [...c.tags, ...nouveaux].join(", "),
          at: cmd.maintenant,
        });
      }

      const jour = aujourdhui(cmd.maintenant);
      const tache = (type: "besoin" | "verification", objet: string, urgent: boolean) =>
        tx.insert(rappels).values({
          communeId: cmd.communeId,
          beneficiaireId: c.beneficiaireId,
          type,
          objet,
          echeance: jour,
          creePar: cmd.appelant.id,
          urgent,
        });
      // E10-US7 : le besoin devient une tâche urgente pour le CCAS.
      if (cmd.resultat === "besoin") await tache("besoin", objetTacheBesoin(c.personne, cmd.besoins, cmd.precision), true);
      if (cmd.resultat === "mauvais_numero") await tache("verification", `Numéro de téléphone à vérifier pour ${c.personne}`, false);

      if (maj.alerterCcas === "danger") {
        const titre = maj.statut === "evacuation" ? `Relogement demandé : ${c.personne}` : `Urgence signalée : ${c.personne}`;
        await prevenirEquipe(tx, cmd.communeId, "danger", titre, joindre(`Signalé par ${cmd.appelant.prenom} ${cmd.appelant.nom}`, cmd.precision), c.beneficiaireId);
      } else if (maj.alerterCcas === "escalade") {
        await prevenirEquipe(tx, cmd.communeId, "escalade", `Non joint après toutes les tentatives : ${c.personne}`, "À traiter : visite, police municipale ou pompiers.", c.beneficiaireId);
      }

      await tracer(tx, cmd.communeId, cmd.appelant, cmd.idOperation, { type: "resultat", cibleId: c.id, resultat: cmd.resultat, statut: maj.statut });
      return { statut: maj.statut, dejaEnregistre: false, alerte: maj.alerterCcas };
    });
  },

  async enregistrerResultatProche(cmd: CommandeProche): Promise<IssueEnregistrement> {
    return db.transaction(async (tx) => {
      if (await dejaFaite(tx, cmd.communeId, cmd.idOperation)) {
        return { statut: await etatActuel(tx, cmd.cibleId), dejaEnregistre: true, alerte: null };
      }
      const c = await chargerCible(tx, cmd.communeId, cmd.cibleId);
      const [lien] = await tx
        .select({ rang: liensCercle.rangAppel, relation: liensCercle.relation, contactId: liensCercle.contactId, prenom: contacts.prenom, nom: contacts.nom })
        .from(liensCercle)
        .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
        .where(and(eq(liensCercle.id, cmd.lienId), eq(liensCercle.beneficiaireId, c.beneficiaireId)))
        .limit(1);
      if (!lien) throw new Error("Proche inconnu pour cette personne.");

      const [{ suivants }] = await tx
        .select({ suivants: sql<number>`count(*)::int` })
        .from(liensCercle)
        .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
        .where(and(eq(liensCercle.beneficiaireId, c.beneficiaireId), gt(liensCercle.rangAppel, lien.rang), isNotNull(contacts.telephone)));

      const maj = issueProche(cmd.resultat, { nbTentatives: c.nbTentatives, cercleEpuise: suivants === 0 }, c.relance);
      const qui = `${RELATION_LIBELLES[lien.relation]}, ${lien.prenom ?? lien.nom}`;
      const compteRendu = joindre(`${RESULTAT_PROCHE_LIBELLES[cmd.resultat]} (${qui})`, cmd.note);

      await tx
        .update(ciblesCampagne)
        .set({
          rangCercleEssaye: Math.max(c.rangCercleEssaye, lien.rang),
          ...(maj && { statut: maj.statut, couverture: maj.couverture, prochaineTentativeAt: maj.prochaineTentativeAt, note: compteRendu }),
          verrouPar: null,
          verrouAt: null,
          updatedAt: cmd.maintenant,
        })
        .where(eq(ciblesCampagne.id, c.id));

      await tx.insert(interactions).values({
        communeId: cmd.communeId,
        beneficiaireId: c.beneficiaireId,
        type: "appel_sortant",
        survenueLe: cmd.maintenant,
        auteurId: cmd.appelant.id,
        interlocuteurContactId: lien.contactId,
        resultat: maj?.statut ?? c.statut,
        compteRendu,
        campagneId: c.campagneId,
      });

      if (maj?.alerterCcas === "escalade") {
        await prevenirEquipe(tx, cmd.communeId, "escalade", `Personne injoignable, cercle compris : ${c.personne}`, "À traiter : visite, police municipale ou pompiers.", c.beneficiaireId);
      }
      await tracer(tx, cmd.communeId, cmd.appelant, cmd.idOperation, { type: "proche", cibleId: c.id, lienId: cmd.lienId, resultat: cmd.resultat });
      return { statut: maj?.statut ?? c.statut, dejaEnregistre: false, alerte: maj?.alerterCcas ?? null };
    });
  },

  async creerDemande(cmd: CommandeDemande) {
    await db.transaction(async (tx) => {
      if (await dejaFaite(tx, cmd.communeId, cmd.idOperation)) return;
      const c = await chargerCible(tx, cmd.communeId, cmd.cibleId);
      const visite = cmd.nature === "visite";
      const objet = visite
        ? `Visite à domicile demandée pour ${c.personne}${cmd.sujet ? ` (${cmd.sujet})` : ""}`
        : `Demande d'info sur les services seniors de ${c.personne} : ${cmd.sujet}`;
      await tx.insert(rappels).values({
        communeId: cmd.communeId,
        beneficiaireId: c.beneficiaireId,
        type: visite ? "visite_urgente" : "suivi",
        objet,
        echeance: aujourdhui(cmd.maintenant),
        creePar: cmd.appelant.id,
        urgent: visite,
      });
      if (visite) await prevenirEquipe(tx, cmd.communeId, "info", objet, `Demandée par ${cmd.appelant.prenom} ${cmd.appelant.nom}`, c.beneficiaireId);
      await tracer(tx, cmd.communeId, cmd.appelant, cmd.idOperation, { type: "demande", cibleId: c.id, nature: cmd.nature });
    });
  },

  async rendreListe(communeId, benevoleId, jour) {
    return db.transaction(async (tx) => {
      const rendues = await tx
        .update(ciblesCampagne)
        .set({ assigneA: null, verrouPar: null, verrouAt: null })
        .where(
          and(
            eq(ciblesCampagne.assigneA, benevoleId),
            eq(ciblesCampagne.vagueDate, jour),
            inArray(ciblesCampagne.statut, [...STATUTS_A_FAIRE]),
            inArray(
              ciblesCampagne.campagneId,
              tx.select({ id: campagnes.id }).from(campagnes).where(and(eq(campagnes.communeId, communeId), eq(campagnes.statut, "active"))),
            ),
          ),
        )
        .returning({ id: ciblesCampagne.id });
      if (rendues.length > 0) {
        const [moi] = await tx.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, benevoleId));
        const admins = await tx
          .select({ id: utilisateurs.id })
          .from(utilisateurs)
          .where(and(eq(utilisateurs.communeId, communeId), eq(utilisateurs.role, "admin"), ne(utilisateurs.id, benevoleId)));
        const n = rendues.length;
        if (admins.length) {
          await tx.insert(notifications).values(
            admins.map((a) => ({
              communeId,
              destinataireId: a.id,
              type: "assignation" as const,
              titre: `${moi?.prenom ?? "Un bénévole"} ${moi?.nom ?? ""} a rendu sa liste : ${n} personne${n > 1 ? "s" : ""} à réassigner`.replace("  ", " "),
              lien: "/alertes",
            })),
          );
        }
      }
      return rendues.length;
    });
  },
};
