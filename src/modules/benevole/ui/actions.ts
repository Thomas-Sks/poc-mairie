"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AccesRefuse } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { EngagementRequis, PersonneInaccessible } from "../application/acces";
import { casDUsageBenevole as cas } from "../infrastructure";
import { schemaOperation, type ReponseOperation } from "./operations";

/** Erreurs « métier » : inutile de réessayer l'envoi plus tard. */
const estDefinitive = (e: unknown) =>
  e instanceof AccesRefuse || e instanceof PersonneInaccessible || e instanceof EngagementRequis || e instanceof z.ZodError;

/**
 * Point d'entrée unique des résultats d'appel (direct ou rejoué depuis la file hors connexion).
 * Une panne transitoire (base indisponible…) lève une erreur : le navigateur garde l'opération en file.
 */
export async function envoyerOperation(brut: unknown): Promise<ReponseOperation> {
  try {
    const op = schemaOperation.parse(brut);
    const ctx = await obtenirContexte();
    switch (op.type) {
      case "resultat": {
        const r = await cas.enregistrerResultat(ctx, op);
        return { ok: true, statut: r.statut, alerte: r.alerte };
      }
      case "proche": {
        const r = await cas.enregistrerResultatProche(ctx, op);
        return { ok: true, statut: r.statut, alerte: r.alerte };
      }
      case "demande":
        await cas.creerDemande(ctx, op);
        return { ok: true, statut: "", alerte: null };
    }
  } catch (e) {
    if (estDefinitive(e)) return { ok: false, message: e instanceof z.ZodError ? "Saisie invalide." : (e as Error).message };
    throw e;
  }
}

const idCible = z.uuid();

/** Verrou d'appel : pris à l'ouverture de l'écran « Appel », rendu à la sortie. */
export async function prendreVerrouAction(cibleId: string): Promise<boolean> {
  return cas.prendreVerrou(await obtenirContexte(), idCible.parse(cibleId));
}

export async function libererVerrouAction(cibleId: string): Promise<void> {
  await cas.libererVerrou(await obtenirContexte(), idCible.parse(cibleId));
}

export async function accepterEngagementAction(): Promise<void> {
  await cas.accepterEngagement(await obtenirContexte());
  redirect("/benevole");
}

export async function rendreMaListeAction(): Promise<void> {
  const n = await cas.rendreMaListe(await obtenirContexte());
  redirect(`/benevole?rendues=${n}`);
}
