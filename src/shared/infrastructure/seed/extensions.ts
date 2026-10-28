/**
 * Points d'extension du seed : chaque module peut ajouter ses propres données de démo
 * (listes sauvegardées, dashboards prédéfinis…) sans toucher au seed principal.
 * Ajouter une fonction à EXTENSIONS_SEED ; elle est appelée après le seed principal.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as s from "../db/schema";
import { seedStatistiques } from "@/modules/statistiques/infrastructure/seed";

export type ContexteSeed = {
  communeId: string;
  jour: string;
  utilisateurs: (typeof s.utilisateurs.$inferSelect)[];
  beneficiaires: (typeof s.beneficiaires.$inferSelect)[];
  campagneCaniculeId: string;
};

export type ExtensionSeed = (db: PostgresJsDatabase<typeof s>, ctx: ContexteSeed) => Promise<void>;

export const EXTENSIONS_SEED: ExtensionSeed[] = [seedStatistiques];
