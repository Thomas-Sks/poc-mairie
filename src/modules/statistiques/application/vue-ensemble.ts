import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { assemblerVueEnsemble, type VueEnsemble } from "../domain/vue-ensemble";
import type { IndicateursRepository } from "./ports";

/** Vue d'ensemble (page d'accueil des statistiques). Les noms des personnes ne sont donnés qu'avec le droit nominatif. */
export async function consulterVueEnsemble(deps: { indicateurs: IndicateursRepository }, ctx: Contexte): Promise<VueEnsemble> {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  const jour = aujourdhui(ctx.maintenant);
  const vue = assemblerVueEnsemble(await deps.indicateurs.charger(ctx.commune.id, jour), jour);
  return peut(ctx.utilisateur.role, "statistiques.nominatif") ? vue : { ...vue, p1SansContact: [] };
}
