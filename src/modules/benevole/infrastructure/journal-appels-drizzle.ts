import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import type { StatutCible } from "@/shared/domain/vocabulaire";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, campagnes, ciblesCampagne, historiqueModifications, journalAudit, liensCercle, rappels } from "@/shared/infrastructure/db/schema";
import { casDUsageCrise } from "@/modules/crise/infrastructure";
import { notifier } from "@/modules/notifications/infrastructure";
import type { CommandeDemande, CommandeProche, CommandeResultat, IssueEnregistrement, JournalAppels } from "../application/ports";
import { STATUTS_A_FAIRE } from "../domain/ma-liste";
import { precisionProche, resultatCampagne, resultatCampagneProche } from "../domain/resultats";

/**
 * Adaptateur du port `JournalAppels`. Le cycle de vie de la cible (verrou, résultat, relances RG-04,
 * escalade cercle, notifications, tâches) est celui du module Crise : on DÉLÈGUE à ses cas d'usage.
 * Ne restent ici que les besoins propres au bénévole : idempotence des renvois hors connexion,
 * tags issus du script, demandes de visite ou d'info, « rendre ma liste ».
 */

const ACTION_OPERATION = "benevole.operation";

const joindre = (...parties: (string | null | undefined)[]) => parties.filter((p) => p && p.trim()).join(" · ") || null;

const operation = (communeId: string, idOperation: string) =>
  and(eq(journalAudit.communeId, communeId), eq(journalAudit.action, ACTION_OPERATION), eq(journalAudit.cible, idOperation));

/**
 * Idempotence (E10-US8) : réserve l'opération dans `journal_audit` avant de l'appliquer.
 * Le verrou consultatif empêche deux renvois simultanés de la même opération de passer tous les deux.
 * Renvoie false si l'opération a déjà été enregistrée.
 */
async function reserver(ctx: Contexte, idOperation: string, details: Record<string, unknown>): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${ACTION_OPERATION}:${idOperation}`}))`);
    const [deja] = await tx.select({ id: journalAudit.id }).from(journalAudit).where(operation(ctx.commune.id, idOperation)).limit(1);
    if (deja) return false;
    await tx.insert(journalAudit).values({ communeId: ctx.commune.id, utilisateurId: ctx.utilisateur.id, action: ACTION_OPERATION, cible: idOperation, details });
    return true;
  });
}

/** Applique l'opération une seule fois ; en cas d'échec, la réservation est annulée pour que le renvoi puisse réessayer. */
async function uneSeuleFois(
  ctx: Contexte,
  cmd: { idOperation: string; cibleId: string },
  details: Record<string, unknown>,
  appliquer: () => Promise<IssueEnregistrement>,
): Promise<IssueEnregistrement> {
  if (!(await reserver(ctx, cmd.idOperation, { ...details, cibleId: cmd.cibleId }))) {
    return { statut: await statutActuel(cmd.cibleId), dejaEnregistre: true, alerte: null };
  }
  try {
    const issue = await appliquer();
    await db
      .update(journalAudit)
      .set({ details: { ...details, cibleId: cmd.cibleId, statut: issue.statut } })
      .where(operation(ctx.commune.id, cmd.idOperation));
    return issue;
  } catch (e) {
    await db.delete(journalAudit).where(operation(ctx.commune.id, cmd.idOperation));
    throw e;
  }
}

async function statutActuel(cibleId: string): Promise<StatutCible> {
  const [c] = await db.select({ statut: ciblesCampagne.statut }).from(ciblesCampagne).where(eq(ciblesCampagne.id, cibleId));
  return c?.statut ?? "a_appeler";
}

/** Cible de la commune → personne concernée. */
async function personneDeLaCible(communeId: string, cibleId: string) {
  const [p] = await db
    .select({ id: beneficiaires.id, civilite: beneficiaires.civilite, prenom: beneficiaires.prenom, nom: beneficiaires.nom, tags: beneficiaires.tags })
    .from(ciblesCampagne)
    .innerJoin(campagnes, eq(campagnes.id, ciblesCampagne.campagneId))
    .innerJoin(beneficiaires, eq(beneficiaires.id, ciblesCampagne.beneficiaireId))
    .where(and(eq(ciblesCampagne.id, cibleId), eq(campagnes.communeId, communeId)))
    .limit(1);
  if (!p) throw new Error("Personne introuvable.");
  return { ...p, libelle: `${p.civilite} ${p.prenom} ${p.nom}` };
}

/** Tag « isolement » (ou autre) déduit des réponses au script, ajouté à la fiche avec son historique. */
async function ajouterTags(ctx: Contexte, cibleId: string, tags: string[]) {
  if (tags.length === 0) return;
  const p = await personneDeLaCible(ctx.commune.id, cibleId);
  const nouveaux = tags.filter((t) => !p.tags.includes(t));
  if (nouveaux.length === 0) return;
  const tous = [...p.tags, ...nouveaux];
  await db.transaction(async (tx) => {
    await tx.update(beneficiaires).set({ tags: tous, updatedAt: ctx.maintenant }).where(eq(beneficiaires.id, p.id));
    await tx.insert(historiqueModifications).values({
      beneficiaireId: p.id,
      auteurId: ctx.utilisateur.id,
      champ: "tags",
      ancienneValeur: p.tags.join(", ") || null,
      nouvelleValeur: tous.join(", "),
      at: ctx.maintenant,
    });
  });
}

export const journalAppelsDrizzle: JournalAppels = {
  async prendreVerrou(ctx, cibleId) {
    return (await casDUsageCrise.prendreVerrou(ctx, { cibleId })).obtenu;
  },

  async libererVerrou(ctx, cibleId) {
    await casDUsageCrise.libererVerrou(ctx, { cibleId });
  },

  async enregistrerResultat(ctx, cmd: CommandeResultat) {
    return uneSeuleFois(ctx, cmd, { type: "resultat", resultat: cmd.resultat }, async () => {
      // Avant le résultat : un renvoi après échec ne rajoute pas un tag déjà posé.
      await ajouterTags(ctx, cmd.cibleId, cmd.tags);
      const r = await casDUsageCrise.enregistrerResultatAppel(ctx, {
        cibleId: cmd.cibleId,
        resultat: resultatCampagne(cmd.resultat),
        besoins: cmd.besoins,
        reponses: cmd.reponses,
        note: joindre(cmd.precision, cmd.note),
      });
      return { statut: r.statut, dejaEnregistre: false, alerte: r.decision.notification };
    });
  },

  async enregistrerResultatProche(ctx, cmd: CommandeProche) {
    return uneSeuleFois(ctx, cmd, { type: "proche", lienId: cmd.lienId, resultat: cmd.resultat }, async () => {
      const [lien] = await db
        .select({ contactId: liensCercle.contactId })
        .from(liensCercle)
        .innerJoin(ciblesCampagne, eq(ciblesCampagne.beneficiaireId, liensCercle.beneficiaireId))
        .where(and(eq(liensCercle.id, cmd.lienId), eq(ciblesCampagne.id, cmd.cibleId)))
        .limit(1);
      if (!lien) throw new Error("Proche inconnu pour cette personne.");
      const r = await casDUsageCrise.enregistrerResultatAppel(ctx, {
        cibleId: cmd.cibleId,
        resultat: resultatCampagneProche(cmd.resultat),
        contactId: lien.contactId,
        note: joindre(precisionProche(cmd.resultat), cmd.note),
      });
      return { statut: r.statut, dejaEnregistre: false, alerte: r.decision.notification };
    });
  },

  async creerDemande(ctx, cmd: CommandeDemande) {
    await uneSeuleFois(ctx, cmd, { type: "demande", nature: cmd.nature }, async () => {
      const p = await personneDeLaCible(ctx.commune.id, cmd.cibleId);
      const visite = cmd.nature === "visite";
      const objet = visite
        ? `Visite à domicile demandée pour ${p.libelle}${cmd.sujet ? ` (${cmd.sujet})` : ""}`
        : `Demande d'info sur les services seniors de ${p.libelle} : ${cmd.sujet}`;
      await db.insert(rappels).values({
        communeId: ctx.commune.id,
        beneficiaireId: p.id,
        type: visite ? "visite_urgente" : "suivi",
        objet,
        echeance: aujourdhui(ctx.maintenant),
        creePar: ctx.utilisateur.id,
        urgent: visite,
      });
      if (visite) {
        await notifier(ctx, {
          roles: ["admin", "agent"],
          type: "info",
          titre: objet,
          message: `Demandée par ${ctx.utilisateur.prenom} ${ctx.utilisateur.nom}`,
          lien: `/beneficiaires/${p.id}`,
        });
      }
      return { statut: await statutActuel(cmd.cibleId), dejaEnregistre: false, alerte: null };
    });
  },

  async rendreListe(ctx, jour) {
    const rendues = await db
      .update(ciblesCampagne)
      .set({ assigneA: null, verrouPar: null, verrouAt: null })
      .where(
        and(
          eq(ciblesCampagne.assigneA, ctx.utilisateur.id),
          eq(ciblesCampagne.vagueDate, jour),
          inArray(ciblesCampagne.statut, [...STATUTS_A_FAIRE]),
          inArray(
            ciblesCampagne.campagneId,
            db.select({ id: campagnes.id }).from(campagnes).where(and(eq(campagnes.communeId, ctx.commune.id), eq(campagnes.statut, "active"))),
          ),
        ),
      )
      .returning({ id: ciblesCampagne.id });
    const n = rendues.length;
    if (n > 0) {
      await notifier(ctx, {
        roles: ["admin"],
        exclureAuteur: true,
        type: "assignation",
        titre: `${ctx.utilisateur.prenom} ${ctx.utilisateur.nom} a rendu sa liste : ${n} personne${n > 1 ? "s" : ""} à réassigner`,
        lien: "/alertes",
      });
    }
    return n;
  },
};
