"use server";

/** Server Actions de l'écran « Bénévoles » (côté CCAS) : validation Zod, contexte, cas d'usage, revalidation. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccesRefuse } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { BenevoleIntrouvable, BenevoleInvalide } from "../../application/gestion";
import type { PersonneTrouvee } from "../../application/ports";
import { casDUsageGestionBenevoles } from "../../infrastructure";

export type Resultat<T = undefined> = { ok: true; valeur: T } | { ok: false; erreur: string };

async function executer<T>(f: () => Promise<T>, chemins: string[] = []): Promise<Resultat<T>> {
  try {
    const valeur = await f();
    for (const c of chemins) revalidatePath(c);
    return { ok: true, valeur };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: "Vous n'avez pas les droits pour cette action." };
    if (e instanceof BenevoleInvalide || e instanceof BenevoleIntrouvable) return { ok: false, erreur: e.message };
    if (e instanceof z.ZodError) return { ok: false, erreur: "Certaines informations sont incomplètes. Vérifiez le formulaire." };
    throw e;
  }
}

const schemaBenevole = z.object({
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
  telephone: z.string().trim().max(30).nullable(),
  email: z.email(),
});

export async function ajouterBenevoleAction(entree: unknown): Promise<Resultat<string>> {
  return executer(async () => casDUsageGestionBenevoles.ajouterBenevole(await obtenirContexte(), schemaBenevole.parse(entree)), ["/benevoles"]);
}

export async function rechercherPersonnesAction(entree: unknown): Promise<Resultat<PersonneTrouvee[]>> {
  return executer(async () => {
    const e = z.object({ benevoleId: z.uuid(), texte: z.string().max(100) }).parse(entree);
    return casDUsageGestionBenevoles.rechercherPersonnes(await obtenirContexte(), e);
  });
}

export async function confierPersonnesAction(entree: unknown): Promise<Resultat<number>> {
  const e = z.object({ benevoleId: z.uuid(), beneficiaireIds: z.array(z.uuid()).min(1).max(500) }).safeParse(entree);
  if (!e.success) return { ok: false, erreur: "Choisissez au moins une personne." };
  return executer(async () => casDUsageGestionBenevoles.confierPersonnes(await obtenirContexte(), e.data), ["/benevoles", `/benevoles/${e.data.benevoleId}`]);
}

export async function retirerPersonneAction(entree: unknown): Promise<Resultat> {
  const e = z.object({ benevoleId: z.uuid(), beneficiaireId: z.uuid() }).parse(entree);
  return executer(async () => {
    await casDUsageGestionBenevoles.retirerPersonne(await obtenirContexte(), e);
    return undefined;
  }, ["/benevoles", `/benevoles/${e.benevoleId}`]);
}
