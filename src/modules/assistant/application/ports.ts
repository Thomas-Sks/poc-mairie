import type { Referentiels } from "@/modules/statistiques/domain/requete";
import type { DateISO } from "@/shared/domain/dates";

export type SourceInterpretation = "ia" | "analyseur";

/** Interprétations figées : une question normalisée ↔ un appel d'outil. */
export interface InterpretationsRepository {
  trouver(communeId: string, cle: string): Promise<{ appel: unknown; source: SourceInterpretation } | null>;
  enregistrer(communeId: string, cle: string, appel: unknown, source: SourceInterpretation): Promise<void>;
}

/**
 * Traduit une question en appel d'outil (function calling). Ne reçoit que la question et le vocabulaire
 * de la commune (quartiers, campagnes) : aucune donnée nominative ne lui est transmise.
 * Renvoie la réponse brute de l'IA (validée ensuite par l'application), ou null si aucun outil n'a été choisi.
 */
export interface Interpreteur {
  interpreter(question: string, contexte: { referentiels: Referentiels; jour: DateISO }): Promise<unknown | null>;
}
