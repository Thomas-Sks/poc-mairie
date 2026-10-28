import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { AccesRefuse, exiger, peut } from "@/shared/domain/permissions";
import { nouvelleEcheance, type Rappel, type Report } from "../domain/taches-du-jour";
import type { TachesRepository } from "./ports";

export class RappelIntrouvable extends Error {
  constructor() {
    super("Ce rappel n'existe plus.");
    this.name = "RappelIntrouvable";
  }
}

/** Un agent agit sur ses rappels (ou ceux non assignés) ; l'admin sur tous ceux de la commune. */
async function rappelModifiable(deps: { taches: TachesRepository }, ctx: Contexte, id: string): Promise<Rappel> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const rappel = await deps.taches.trouverRappel(ctx.commune.id, id);
  if (!rappel) throw new RappelIntrouvable();
  const estLeSien = rappel.assigneA === null || rappel.assigneA === ctx.utilisateur.id;
  if (!estLeSien && !peut(ctx.utilisateur.role, "utilisateurs.gerer")) throw new AccesRefuse("fiches.ecrire");
  return rappel;
}

export async function marquerRappelFait(deps: { taches: TachesRepository }, ctx: Contexte, entree: { id: string }) {
  await rappelModifiable(deps, ctx, entree.id);
  await deps.taches.marquerFait(ctx.commune.id, entree.id, ctx.maintenant);
}

export async function reporterRappel(deps: { taches: TachesRepository }, ctx: Contexte, entree: { id: string; report: Report }) {
  await rappelModifiable(deps, ctx, entree.id);
  const echeance = nouvelleEcheance(entree.report, aujourdhui(ctx.maintenant));
  await deps.taches.reporter(ctx.commune.id, entree.id, echeance);
  return { echeance };
}
