/**
 * E8-US10 — Vues sauvegardées par utilisateur ; E8-US7 — présence sur une liste.
 */
import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import type { ConfigVue } from "../domain/tableau";
import type { Membre, PresencesRepository, VueSauvegardee, VuesRepository } from "./ports";
import { ErreurMetier } from "./actions-groupees";

export async function listerVues(deps: { vues: VuesRepository }, ctx: Contexte): Promise<VueSauvegardee[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.vues.lister(ctx.utilisateur.id);
}

export async function enregistrerVue(deps: { vues: VuesRepository }, ctx: Contexte, entree: { nom: string; config: ConfigVue }) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  if (!entree.nom.trim()) throw new ErreurMetier("Donnez un nom à la vue.");
  return deps.vues.creer(ctx.utilisateur.id, entree.nom.trim(), entree.config);
}

export async function supprimerVue(deps: { vues: VuesRepository }, ctx: Contexte, id: string) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  await deps.vues.supprimer(ctx.utilisateur.id, id);
}

/** Une présence est considérée active pendant 15 s (le client la renouvelle toutes les 2,5 s). */
export const DUREE_PRESENCE_MS = 15_000;

/** Signale la présence de l'utilisateur sur la ressource et renvoie les autres personnes présentes. */
export async function signalerPresence(deps: { presences: PresencesRepository }, ctx: Contexte, ressource: string): Promise<Membre[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  await deps.presences.signaler(ctx.utilisateur.id, ressource, ctx.maintenant);
  const presents = await deps.presences.presents(ctx.commune.id, ressource, new Date(ctx.maintenant.getTime() - DUREE_PRESENCE_MS));
  return presents.filter((m) => m.id !== ctx.utilisateur.id);
}
