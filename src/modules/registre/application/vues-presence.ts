/**
 * E8-US7 — présence sur une liste.
 */
import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import type { Membre, PresencesRepository } from "./ports";

/** Une présence est considérée active pendant 15 s (le client la renouvelle toutes les 2,5 s). */
export const DUREE_PRESENCE_MS = 15_000;

/** Signale la présence de l'utilisateur sur la ressource et renvoie les autres personnes présentes. */
export async function signalerPresence(deps: { presences: PresencesRepository }, ctx: Contexte, ressource: string): Promise<Membre[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  await deps.presences.signaler(ctx.utilisateur.id, ressource, ctx.maintenant);
  const presents = await deps.presences.presents(ctx.commune.id, ressource, new Date(ctx.maintenant.getTime() - DUREE_PRESENCE_MS));
  return presents.filter((m) => m.id !== ctx.utilisateur.id);
}
