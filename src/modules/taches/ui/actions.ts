"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { formaterDateLongue } from "@/shared/domain/dates";
import { AccesRefuse } from "@/shared/domain/permissions";
import { REPORTS } from "../domain/taches-du-jour";
import { RappelIntrouvable } from "../application/gerer-rappel";
import { casDUsage } from "../infrastructure";

export type ResultatAction = { ok: true; message: string } | { ok: false; message: string };

async function executer(action: () => Promise<string>): Promise<ResultatAction> {
  try {
    const message = await action();
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, message: "Vous n'avez pas les droits pour modifier ce rappel." };
    if (e instanceof RappelIntrouvable) return { ok: false, message: e.message };
    return { ok: false, message: "L'action n'a pas pu être enregistrée. Réessayez." };
  }
}

export async function marquerRappelFaitAction(id: string): Promise<ResultatAction> {
  const entree = z.object({ id: z.uuid() }).parse({ id });
  return executer(async () => {
    await casDUsage.marquerRappelFait(await obtenirContexte(), entree);
    return "Rappel marqué comme fait.";
  });
}

export async function reporterRappelAction(id: string, report: string): Promise<ResultatAction> {
  const entree = z.object({ id: z.uuid(), report: z.enum(REPORTS) }).parse({ id, report });
  return executer(async () => {
    const { echeance } = await casDUsage.reporterRappel(await obtenirContexte(), entree);
    return `Rappel reporté au ${formaterDateLongue(echeance)}.`;
  });
}
