"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { casDUsage } from "../infrastructure";
import type { ResultatSoumission } from "../application/soumettre-inscription";

const entreeSchema = z.object({ reponses: z.record(z.string(), z.unknown()), potDeMiel: z.string().max(500) });

/** Formulaire public (sans authentification) : les réponses sont validées par le schéma Zod du formulaire. */
export async function soumettreInscriptionAction(entree: { reponses: unknown; potDeMiel: string }): Promise<ResultatSoumission> {
  const e = entreeSchema.safeParse(entree);
  if (!e.success) return { ok: false, erreurs: { formulaire: "Le formulaire envoyé est incomplet. Rechargez la page et réessayez." } };
  const resultat = await casDUsage.soumettreInscription(e.data);
  if (resultat.ok) revalidatePath("/inscriptions");
  return resultat;
}
