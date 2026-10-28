"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AccesRefuse } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { schemaDisposition, TYPES_WIDGET } from "../domain/dashboard";
import { schemaDefinition } from "../domain/requete";
import type { ResultatAffiche } from "../domain/secret";
import type { PersonneTrouvee } from "../application/ports";
import { casDUsage } from "../infrastructure";

type Reponse<T> = { ok: true; valeur: T } | { ok: false; erreur: string };

async function executer<T>(fn: () => Promise<T>): Promise<Reponse<T>> {
  try {
    return { ok: true, valeur: await fn() };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: "Vous n'avez pas le droit d'effectuer cette action." };
    if (e instanceof z.ZodError) return { ok: false, erreur: e.issues[0]?.message ?? "Requête invalide." };
    console.error(e);
    return { ok: false, erreur: e instanceof Error ? e.message : "Une erreur est survenue." };
  }
}

const uuid = z.uuid();
const nom = z.string().trim().min(1, "Donnez un nom.").max(120);

export async function executerRequeteAction(definition: unknown, masquerPetitsEffectifs: boolean): Promise<Reponse<ResultatAffiche>> {
  return executer(async () => {
    const d = schemaDefinition.parse(definition);
    return casDUsage.executerRequete(await obtenirContexte(), { definition: d, masquerPetitsEffectifs: z.boolean().parse(masquerPetitsEffectifs) });
  });
}

export async function listerPersonnesAction(definition: unknown): Promise<Reponse<{ total: number; personnes: PersonneTrouvee[] }>> {
  return executer(async () => casDUsage.listerPersonnes(await obtenirContexte(), schemaDefinition.parse(definition)));
}

export async function enregistrerRequeteAction(nomRequete: string, definition: unknown): Promise<Reponse<string>> {
  return executer(async () => {
    const id = await casDUsage.enregistrerRequete(await obtenirContexte(), { nom: nom.parse(nomRequete), definition: schemaDefinition.parse(definition) });
    revalidatePath("/statistiques/requetes");
    return id;
  });
}

export async function supprimerRequeteAction(id: string): Promise<Reponse<null>> {
  return executer(async () => {
    await casDUsage.supprimerRequete(await obtenirContexte(), uuid.parse(id));
    revalidatePath("/statistiques/requetes");
    return null;
  });
}

export async function creerDashboardAction(nomDashboard: string): Promise<Reponse<never>> {
  const r = await executer(async () => casDUsage.creerDashboard(await obtenirContexte(), nom.parse(nomDashboard)));
  if (!r.ok) return r;
  revalidatePath("/statistiques/tableaux-de-bord");
  redirect(`/statistiques/tableaux-de-bord/${r.valeur}?edition=1`);
}

export async function modifierDashboardAction(id: string, champs: { nom?: string; partage?: boolean }): Promise<Reponse<null>> {
  return executer(async () => {
    const entree = z.object({ id: uuid, nom: nom.optional(), partage: z.boolean().optional() }).parse({ id, ...champs });
    await casDUsage.modifierDashboard(await obtenirContexte(), entree);
    revalidatePath("/statistiques/tableaux-de-bord", "layout");
    return null;
  });
}

export async function enregistrerDispositionAction(id: string, dispositions: unknown): Promise<Reponse<null>> {
  return executer(async () => {
    await casDUsage.enregistrerDisposition(await obtenirContexte(), {
      id: uuid.parse(id),
      dispositions: z.record(z.string().max(64), schemaDisposition).parse(dispositions),
    });
    revalidatePath(`/statistiques/tableaux-de-bord/${id}`);
    return null;
  });
}

export async function ajouterWidgetAction(id: string, widget: unknown): Promise<Reponse<null>> {
  return executer(async () => {
    const w = z.object({ titre: nom, type: z.enum(TYPES_WIDGET), definition: schemaDefinition }).parse(widget);
    await casDUsage.ajouterWidget(await obtenirContexte(), { id: uuid.parse(id), ...w });
    revalidatePath(`/statistiques/tableaux-de-bord/${id}`);
    return null;
  });
}

export async function retirerWidgetAction(id: string, widgetId: string): Promise<Reponse<null>> {
  return executer(async () => {
    await casDUsage.retirerWidget(await obtenirContexte(), { id: uuid.parse(id), widgetId: z.string().max(64).parse(widgetId) });
    revalidatePath(`/statistiques/tableaux-de-bord/${id}`);
    return null;
  });
}

export async function supprimerDashboardAction(id: string): Promise<Reponse<never>> {
  const r = await executer(async () => casDUsage.supprimerDashboard(await obtenirContexte(), uuid.parse(id)));
  if (!r.ok) return r;
  revalidatePath("/statistiques/tableaux-de-bord");
  redirect("/statistiques/tableaux-de-bord");
}
