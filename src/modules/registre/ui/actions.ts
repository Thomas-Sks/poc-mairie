"use server";

/**
 * Server Actions du registre (adaptateur entrant) : validation Zod, contexte, cas d'usage, revalidation.
 * Chaque action renvoie un `Resultat` plutôt que de lever : l'interface affiche le message.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccesRefuse } from "@/shared/domain/permissions";
import { MOTIFS_ARCHIVAGE } from "@/shared/domain/vocabulaire";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { normaliserFiltre, schemaFiltre, type Filtre } from "../domain/filtre";
import { COLONNES, RESULTATS_APPEL_RAPIDE, STATUTS_GROUPES } from "../domain/tableau";
import { ErreurMetier } from "../application/actions-groupees";
import { ListeIntrouvable } from "../application/rechercher-beneficiaire-ids";
import { casDUsage } from "../infrastructure";

export type Resultat<T = undefined> = { ok: true; valeur: T } | { ok: false; erreur: string };

async function executer<T>(f: () => Promise<T>, chemins: string[] = []): Promise<Resultat<T>> {
  try {
    const valeur = await f();
    for (const c of chemins) revalidatePath(c);
    return { ok: true, valeur };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: "Vous n'avez pas les droits pour cette action." };
    if (e instanceof ErreurMetier || e instanceof ListeIntrouvable) return { ok: false, erreur: e.message };
    if (e instanceof z.ZodError) return { ok: false, erreur: "Informations invalides : vérifiez votre saisie." };
    throw e;
  }
}

const ids = z.array(z.uuid()).min(1).max(20_000);
const filtre = schemaFiltre.default({ version: 1 }).transform((f) => normaliserFiltre(f as Filtre));
const listeId = z.uuid().optional();

export async function actionToutSelectionner(entree: unknown) {
  return executer(async () => {
    const e = z.object({ filtre, listeId }).parse(entree);
    return casDUsage.toutSelectionner(await obtenirContexte(), e);
  });
}

export async function actionAssigner(entree: unknown) {
  return executer(
    async () => {
      const e = z
        .object({ ids, utilisateurIds: z.array(z.uuid()).min(1).max(50), repartirAutomatiquement: z.boolean(), remplacer: z.boolean() })
        .parse(entree);
      return casDUsage.assigner(await obtenirContexte(), e);
    },
    ["/beneficiaires"],
  );
}

export async function actionRetirerAssignations(entree: unknown) {
  return executer(async () => casDUsage.retirerAssignations(await obtenirContexte(), z.object({ ids }).parse(entree)), ["/beneficiaires"]);
}

export async function actionAjouterTag(entree: unknown) {
  return executer(
    async () => casDUsage.ajouterTag(await obtenirContexte(), z.object({ ids, tag: z.string().trim().min(1).max(60) }).parse(entree)),
    ["/beneficiaires"],
  );
}

export async function actionChangerStatut(entree: unknown) {
  return executer(
    async () => {
      const e = z
        .object({
          ids,
          statut: z.enum(STATUTS_GROUPES),
          motifArchivage: z.enum(MOTIFS_ARCHIVAGE).optional(),
          motif: z.string().trim().max(500).optional(),
        })
        .parse(entree);
      return casDUsage.changerStatut(await obtenirContexte(), e);
    },
    ["/beneficiaires"],
  );
}

export async function actionExporterCsv(entree: unknown) {
  return executer(async () => {
    const e = z
      .object({
        filtre,
        listeId,
        ids: z.array(z.uuid()).max(20_000).optional(),
        colonnes: z.array(z.enum(COLONNES)).min(1),
        confirmationSante: z.boolean(),
      })
      .parse(entree);
    return casDUsage.exporterCsv(await obtenirContexte(), e);
  });
}

export async function actionSaisirAppel(entree: unknown) {
  return executer(
    async () => {
      const e = z
        .object({ beneficiaireId: z.uuid(), resultat: z.enum(RESULTATS_APPEL_RAPIDE), commentaire: z.string().max(2000).optional() })
        .parse(entree);
      return casDUsage.saisirAppel(await obtenirContexte(), e);
    },
    ["/"],
  );
}

export async function actionCommenterAppel(entree: unknown) {
  return executer(async () => {
    const e = z.object({ interactionId: z.uuid(), commentaire: z.string().trim().min(1).max(2000) }).parse(entree);
    return casDUsage.commenterAppel(await obtenirContexte(), e);
  });
}

export async function actionCreerListe(entree: unknown) {
  return executer(
    async () => {
      const e = z
        .object({
          nom: z.string().trim().min(1).max(120),
          type: z.enum(["dynamique", "figee"]),
          filtre,
          listeId,
          ids: z.array(z.uuid()).max(20_000).optional(),
        })
        .parse(entree);
      return casDUsage.creerListe(await obtenirContexte(), e);
    },
    ["/listes"],
  );
}

export async function actionRenommerListe(entree: unknown) {
  return executer(
    async () => casDUsage.renommerListe(await obtenirContexte(), z.object({ id: z.uuid(), nom: z.string().trim().min(1).max(120) }).parse(entree)),
    ["/listes"],
  );
}

export async function actionSupprimerListe(entree: unknown) {
  return executer(async () => casDUsage.supprimerListe(await obtenirContexte(), z.object({ id: z.uuid() }).parse(entree).id), ["/listes"]);
}
