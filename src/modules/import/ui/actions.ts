"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { AccesRefuse } from "@/shared/domain/permissions";
import { casDUsage } from "../infrastructure";
import { CHAMPS_IMPORT } from "../domain/champs";
import type { LigneAnalysee } from "../domain/analyse";
import type { MappingSauvegarde } from "../application/ports";

const cellule = z.string().max(2000);
const analyseSchema = z.object({
  entetes: z.array(cellule).max(200),
  lignes: z.array(z.array(cellule).max(200)).max(5000),
  premiereLigne: z.number().int().min(1),
  destinations: z.array(z.enum([...CHAMPS_IMPORT, "note", "ignorer"])).max(200),
  valeurs: z.partialRecord(z.enum(CHAMPS_IMPORT), z.record(z.string(), z.string())),
});

type Resultat<T> = { ok: true; donnees: T } | { ok: false; message: string };

async function executer<T>(f: () => Promise<T>): Promise<Resultat<T>> {
  try {
    return { ok: true, donnees: await f() };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, message: "Seul un administrateur peut importer des fiches." };
    throw e;
  }
}

export async function trouverMappingAction(entetes: string[]): Promise<Resultat<MappingSauvegarde | null>> {
  const e = z.array(cellule).max(200).parse(entetes);
  const ctx = await obtenirContexte();
  return executer(() => casDUsage.trouverMapping(ctx, e));
}

export async function previsualiserImportAction(entree: z.input<typeof analyseSchema>): Promise<Resultat<LigneAnalysee[]>> {
  const e = analyseSchema.safeParse(entree);
  if (!e.success) return { ok: false, message: "Le fichier transmis est invalide ou trop volumineux (5 000 lignes au maximum)." };
  const ctx = await obtenirContexte();
  return executer(() => casDUsage.previsualiserImport(ctx, e.data));
}

export async function importerFichesAction(
  entree: z.input<typeof analyseSchema> & { statut: "active" | "en_attente"; nomFichier: string },
): Promise<Resultat<{ foyers: number; fiches: number; rejets: LigneAnalysee[] }>> {
  const e = analyseSchema.extend({ statut: z.enum(["active", "en_attente"]), nomFichier: z.string().max(200) }).safeParse(entree);
  if (!e.success) return { ok: false, message: "Le fichier transmis est invalide ou trop volumineux (5 000 lignes au maximum)." };
  const ctx = await obtenirContexte();
  const r = await executer(() => casDUsage.importerFiches(ctx, e.data));
  if (r.ok) {
    revalidatePath("/beneficiaires", "layout");
    revalidatePath("/inscriptions");
    revalidatePath("/");
  }
  return r;
}
