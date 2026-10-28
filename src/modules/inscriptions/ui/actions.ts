"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { AccesRefuse } from "@/shared/domain/permissions";
import { casDUsage } from "../infrastructure";
import { InscriptionIntrouvable } from "../application/traiter-inscription";

export type ResultatAction = { ok: true } | { ok: false; message: string };

const id = z.uuid();

async function executer(action: () => Promise<void>): Promise<ResultatAction> {
  try {
    await action();
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, message: "Vous n'avez pas le droit de traiter les inscriptions." };
    if (e instanceof InscriptionIntrouvable) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath("/inscriptions", "layout");
  revalidatePath("/beneficiaires", "layout");
  revalidatePath("/");
  return { ok: true };
}

export async function validerInscriptionAction(entree: { id: string }): Promise<ResultatAction> {
  const e = z.object({ id }).parse(entree);
  const ctx = await obtenirContexte();
  return executer(() => casDUsage.validerInscription(ctx, e));
}

export async function rejeterInscriptionAction(entree: { id: string; motif: string }): Promise<ResultatAction> {
  const e = z.object({ id, motif: z.string().trim() }).safeParse(entree);
  if (!e.success) return { ok: false, message: "Données invalides." };
  if (e.data.motif.length < 3) return { ok: false, message: "Indiquez le motif du rejet." };
  const ctx = await obtenirContexte();
  return executer(() => casDUsage.rejeterInscription(ctx, e.data));
}

export async function fusionnerFicheAction(entree: { inscriptionId: string; ficheEnAttenteId: string; ficheExistanteId: string }): Promise<ResultatAction> {
  const e = z.object({ inscriptionId: id, ficheEnAttenteId: id, ficheExistanteId: id }).parse(entree);
  const ctx = await obtenirContexte();
  return executer(() => casDUsage.fusionnerFiche(ctx, e));
}
