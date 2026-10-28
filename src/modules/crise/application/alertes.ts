/**
 * Cas d'usage : alertes (E9-US1, E9-US7).
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui, type DateISO } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import type { NiveauAlerte, TypeAlerte } from "@/shared/domain/vocabulaire";
import type { DepotCrise } from "./ports";

export type EntreeAlerte = {
  type: TypeAlerte;
  niveau: NiveauAlerte;
  debut: DateISO;
  finPrevue: DateISO | null;
  perimetre: string;
  message: string | null;
};

/** E9-US1 : l'admin déclenche une alerte. Renvoie son identifiant. */
export async function declencherAlerte(deps: { depot: DepotCrise }, ctx: Contexte, entree: EntreeAlerte): Promise<string> {
  exiger(ctx.utilisateur.role, "alertes.declencher");
  if (entree.finPrevue && entree.finPrevue < entree.debut) throw new Error("La fin prévue doit suivre le début.");
  return deps.depot.creerAlerte(ctx.commune.id, entree, ctx.utilisateur.id);
}

/** Liste des alertes (en cours d'abord) et de leurs campagnes. */
export async function listerAlertes(deps: { depot: DepotCrise }, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const alertes = await deps.depot.listerAlertes(ctx.commune.id);
  return {
    peutDeclencher: peut(ctx.utilisateur.role, "alertes.declencher"),
    enCours: alertes.filter((a) => a.statut === "active"),
    passees: alertes.filter((a) => a.statut === "cloturee"),
  };
}

export async function obtenirAlerte(deps: { depot: DepotCrise }, ctx: Contexte, id: string) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  return deps.depot.obtenirAlerte(ctx.commune.id, id);
}

/**
 * E9-US7 : clôture de l'alerte. Ses campagnes se clôturent (fin au jour même au plus tard) et
 * les verrous d'appel sont libérés. Renvoie les campagnes clôturées (pour afficher le rapport).
 */
export async function cloturerAlerte(deps: { depot: DepotCrise }, ctx: Contexte, id: string): Promise<string[]> {
  exiger(ctx.utilisateur.role, "alertes.declencher");
  const alerte = await deps.depot.obtenirAlerte(ctx.commune.id, id);
  if (!alerte) throw new Error("Alerte introuvable.");
  if (alerte.statut === "cloturee") return [];
  return deps.depot.cloturerAlerte(ctx.commune.id, id, ctx.maintenant, aujourdhui(ctx.maintenant));
}
