"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { AccesRefuse } from "@/shared/domain/permissions";
import { ParametresInvalides } from "../domain/parametres";
import { casDUsage } from "../infrastructure";

export type ResultatAction = { ok: true; message: string } | { ok: false; message: string };

async function executer(action: () => Promise<string>, chemins: string[] = ["/parametres"]): Promise<ResultatAction> {
  try {
    const message = await action();
    for (const c of chemins) revalidatePath(c);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof ParametresInvalides) return { ok: false, message: e.erreurs.join(" ") };
    if (e instanceof AccesRefuse) return { ok: false, message: "Vous n'avez pas les droits pour modifier les paramètres." };
    if (e instanceof z.ZodError) return { ok: false, message: "Certaines valeurs sont invalides. Vérifiez le formulaire." };
    return { ok: false, message: "L'enregistrement a échoué. Réessayez." };
  }
}

const points = z.number().int().min(0).max(100);

const schemaGrille = z.object({
  vitSeul: points,
  age85: points,
  age75: points,
  deplacement: z.object({ seul: points, canne: points, deambulateur: points, fauteuil: points, immobilise: points }),
  protection: points,
  aucuneCle: points,
  troublesCognitifs: points,
  aucunProcheJoignable: points,
  logementChaud: points,
  aucunePriseEnCharge: points,
  retourHospitalisation: points,
  pasDeTelephone: points,
  seuilP1: points,
  seuilP2: points,
});

/** Enregistre la grille puis recalcule les scores de toutes les fiches actives. */
export async function enregistrerGrilleEtRecalculerAction(grille: unknown): Promise<ResultatAction> {
  return executer(
    async () => {
      const ctx = await obtenirContexte();
      await casDUsage.modifierGrilleScore(ctx, schemaGrille.parse(grille));
      const bilan = await casDUsage.recalculerScores(ctx);
      const niveaux =
        bilan.niveauxModifies === 0
          ? "aucun niveau de priorité ne change"
          : `${bilan.niveauxModifies} fiche${bilan.niveauxModifies > 1 ? "s changent" : " change"} de niveau`;
      return `Grille enregistrée. Scores recalculés pour ${bilan.fiches} fiches : ${niveaux}.`;
    },
    ["/parametres", "/", "/beneficiaires"],
  );
}

const heure = z.string().regex(/^\d{2}:\d{2}$/);

const schemaRelances = z.object({
  relance: z.object({
    nbTentatives: z.number().int().min(1).max(5),
    delaisMinutes: z.array(z.number().int().min(5).max(1440)).max(4),
    plageDebut: heure,
    plageFin: heure,
    escaladeCercle: z.boolean(),
  }),
  anniversaireJoursAvant: z.number().int().min(0).max(30),
  verificationMois: z.number().int().min(1).max(60),
});

export async function enregistrerRelancesAction(entree: unknown): Promise<ResultatAction> {
  return executer(
    async () => {
      await casDUsage.modifierRelancesEtRappels(await obtenirContexte(), schemaRelances.parse(entree));
      return "Paramètres de relance et de rappel enregistrés.";
    },
    ["/parametres", "/"],
  );
}

const texte = z.string().trim().min(1).max(2000);

export async function enregistrerRgpdAction(entree: unknown): Promise<ResultatAction> {
  return executer(async () => {
    const rgpd = z.object({ responsable: texte, conservation: texte, dpo: texte, droits: texte }).parse(entree);
    await casDUsage.modifierTextesRgpd(await obtenirContexte(), rgpd);
    return "Textes RGPD enregistrés.";
  });
}

export async function inviterBenevoleAction(entree: unknown): Promise<ResultatAction> {
  return executer(async () => {
    const e = z
      .object({
        prenom: z.string().trim().min(1).max(80),
        nom: z.string().trim().min(1).max(80),
        telephone: z.string().trim().max(30).nullable(),
        email: z.email(),
      })
      .parse(entree);
    const membre = await casDUsage.inviterBenevole(await obtenirContexte(), e);
    return `Invitation envoyée à ${membre.prenom} ${membre.nom} (${membre.email}). Envoi simulé dans la démonstration.`;
  });
}

export async function reinitialiserDemoAction(): Promise<ResultatAction> {
  const r = await executer(async () => {
    await casDUsage.reinitialiserDemo(await obtenirContexte());
    return "Démonstration réinitialisée.";
  });
  if (!r.ok) return r;
  revalidatePath("/", "layout");
  redirect("/");
}
