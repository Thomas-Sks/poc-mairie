/**
 * E10-US7 : choix rapide du besoin quand la personne a besoin de quelque chose.
 */
import type { Besoin } from "@/shared/domain/vocabulaire";

export const BESOINS_RAPIDES = ["eau", "courses", "medicaments", "visite", "autre"] as const satisfies readonly Besoin[];

/** Pré-sélection à partir des besoins déduits des réponses (seuls les choix rapides sont proposés). */
export function besoinsPreselectionnes(deduits: Besoin[]): Besoin[] {
  return deduits.filter((b) => (BESOINS_RAPIDES as readonly Besoin[]).includes(b));
}
