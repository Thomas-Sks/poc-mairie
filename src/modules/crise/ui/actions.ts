"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { AccesRefuse } from "@/shared/domain/permissions";
import { BESOINS, CANAUX, FREQUENCES, NIVEAUX_ALERTE, STATUTS_CIBLE, TYPES_ALERTE, TYPES_CAMPAGNE } from "@/shared/domain/vocabulaire";
import { casDUsageCrise } from "../infrastructure";
import { RESULTATS_APPEL, VerrouPris } from "../application";
import { filtreGeographiqueSchema } from "../domain/filtre-geographique";

export type Reponse<T = object> = ({ ok: true } & T) | { ok: false; erreur: string };

async function executer<T extends object>(f: () => Promise<T>): Promise<Reponse<T>> {
  try {
    return { ok: true, ...(await f()) };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: "Vous n'avez pas les droits pour cette action." };
    if (e instanceof z.ZodError) return { ok: false, erreur: "Certaines informations sont invalides." };
    if (e instanceof VerrouPris || e instanceof Error) return { ok: false, erreur: e.message };
    return { ok: false, erreur: "Une erreur est survenue." };
  }
}

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.uuid();

// ─── Alertes ──────────────────────────────────────────────────────────────────

const alerteSchema = z.object({
  type: z.enum(TYPES_ALERTE),
  niveau: z.enum(NIVEAUX_ALERTE),
  debut: dateIso,
  finPrevue: dateIso.nullable(),
  perimetre: z.string().trim().min(1).max(200),
  message: z.string().trim().max(2000).nullable(),
});

export async function declencherAlerteAction(entree: z.input<typeof alerteSchema>): Promise<Reponse<{ alerteId: string }>> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    const alerteId = await casDUsageCrise.declencherAlerte(ctx, alerteSchema.parse(entree));
    revalidatePath("/alertes");
    return { alerteId };
  });
}

export async function cloturerAlerteAction(alerteId: string): Promise<Reponse<{ campagneIds: string[] }>> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    const campagneIds = await casDUsageCrise.cloturerAlerte(ctx, id.parse(alerteId));
    revalidatePath("/alertes");
    for (const c of campagneIds) revalidatePath(`/campagnes/${c}`);
    return { campagneIds };
  });
}

// ─── Campagnes ────────────────────────────────────────────────────────────────

const sourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tous") }),
  z.object({ type: z.literal("liste"), listeId: id }),
  z.object({ type: z.literal("filtre"), filtre: filtreGeographiqueSchema }),
]);

export async function compterSelectionAction(source: z.input<typeof sourceSchema>): Promise<Reponse<{ nb: number }>> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    return { nb: await casDUsageCrise.compterSelection(ctx, sourceSchema.parse(source)) };
  });
}

const questionSchema = z.object({
  id: z.string(),
  texte: z.string().trim().min(1),
  reponsePreoccupante: z.enum(["oui", "non"]),
  consigne: z.string().optional(),
  besoin: z.enum(BESOINS).optional(),
  tag: z.string().optional(),
  statutPropose: z.enum(STATUTS_CIBLE).optional(),
  afficherEncart: z.boolean().optional(),
});

const scriptSchema = z.object({
  introduction: z.string().trim().min(1),
  questions: z.array(questionSchema).min(1),
  encart: z.object({ titre: z.string(), items: z.array(z.string()) }).nullable(),
  conclusion: z.string().trim(),
  boutonsSpecifiques: z.array(z.object({ libelle: z.string(), consigne: z.string(), statut: z.enum(STATUTS_CIBLE) })),
  numerosUtiles: z.array(z.object({ libelle: z.string(), numero: z.string() })),
});

const campagneSchema = z.object({
  alerteId: id,
  nom: z.string().trim().min(1).max(120),
  type: z.enum(TYPES_CAMPAGNE),
  script: scriptSchema,
  frequence: z.enum(FREQUENCES),
  frequenceJours: z.number().int().min(2).max(30).nullable(),
  canal: z.enum(CANAUX),
  relance: z.object({
    nbTentatives: z.number().int().min(1).max(6),
    delaisMinutes: z.array(z.number().int().min(5).max(24 * 60)),
    plageDebut: z.string().regex(/^\d{2}:\d{2}$/),
    plageFin: z.string().regex(/^\d{2}:\d{2}$/),
    escaladeCercle: z.boolean(),
  }),
  source: sourceSchema,
  equipe: z.array(id),
  repartirAutomatiquement: z.boolean(),
});

export async function creerCampagneAction(entree: z.input<typeof campagneSchema>): Promise<Reponse<{ campagneId: string; smsSimules: string[] }>> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    const r = await casDUsageCrise.creerCampagne(ctx, campagneSchema.parse(entree));
    revalidatePath("/alertes");
    return r;
  });
}

export async function repartirAction(campagneId: string, utilisateurIds: string[]): Promise<Reponse<{ nbCibles: number; smsSimules: string[] }>> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    const r = await casDUsageCrise.repartirCibles(ctx, { campagneId: id.parse(campagneId), utilisateurIds: z.array(id).parse(utilisateurIds) });
    revalidatePath(`/campagnes/${campagneId}`);
    return r;
  });
}

export async function assignerAction(campagneId: string, cibleId: string, utilisateurId: string | null): Promise<Reponse> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    await casDUsageCrise.assignerCible(ctx, { campagneId: id.parse(campagneId), cibleId: id.parse(cibleId), utilisateurId: id.nullable().parse(utilisateurId) });
    return {};
  });
}

export async function reintegrerAction(cibleId: string): Promise<Reponse> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    await casDUsageCrise.reintegrerCible(ctx, { cibleId: id.parse(cibleId) });
    return {};
  });
}

// ─── Appels ───────────────────────────────────────────────────────────────────

export async function ouvrirAppelAction(cibleId: string) {
  return executer(async () => {
    const ctx = await obtenirContexte();
    const r = await casDUsageCrise.ouvrirFicheAppel(ctx, { cibleId: id.parse(cibleId) });
    return { verrou: r.verrou, fiche: r.fiche };
  });
}

export async function libererVerrouAction(cibleId: string): Promise<Reponse> {
  return executer(async () => {
    const ctx = await obtenirContexte();
    await casDUsageCrise.libererVerrou(ctx, { cibleId: id.parse(cibleId) });
    return {};
  });
}

const resultatSchema = z.object({
  cibleId: id,
  resultat: z.enum(RESULTATS_APPEL),
  besoins: z.array(z.enum(BESOINS)).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  contactId: id.nullable().optional(),
  rangCercle: z.number().int().min(1).optional(),
});

export async function enregistrerResultatAction(entree: z.input<typeof resultatSchema>) {
  return executer(async () => {
    const ctx = await obtenirContexte();
    const r = await casDUsageCrise.enregistrerResultatAppel(ctx, resultatSchema.parse(entree));
    return {
      statut: r.statut,
      appelerCercle: r.decision.appelerCercle,
      prochaineTentativeAt: r.decision.prochaineTentativeAt?.toISOString() ?? null,
      smsSimules: r.smsSimules,
    };
  });
}
