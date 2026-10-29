/**
 * Points d'extension du seed : chaque module peut ajouter ses propres données de démo
 * (listes sauvegardées, assignations…) sans toucher au seed principal.
 * Ajouter une fonction à EXTENSIONS_SEED ; elle est appelée après le seed principal.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as s from "../db/schema";
import { seedTaches } from "@/modules/taches/infrastructure/seed-taches";
import { seedRegistre } from "@/modules/registre/infrastructure/seed";
import { seedBenevoles } from "@/modules/benevole/infrastructure/seed-benevoles";

export type ContexteSeed = {
  communeId: string;
  jour: string;
  utilisateurs: (typeof s.utilisateurs.$inferSelect)[];
  beneficiaires: (typeof s.beneficiaires.$inferSelect)[];
  campagneCaniculeId: string;
};

export type ExtensionSeed = (db: PostgresJsDatabase<typeof s>, ctx: ContexteSeed) => Promise<void>;

export const EXTENSIONS_SEED: ExtensionSeed[] = [
  seedTaches,
  seedRegistre,
  seedBenevoles,
  // Module bénévole : campagne active de développement, désactivée par défaut (SEED_CAMPAGNE_TEST=1 pour l'activer).
  async (db, ctx) => {
    if (process.env.SEED_CAMPAGNE_TEST !== "1") return;
    const { seedCampagneTestBenevole } = await import("@/modules/benevole/infrastructure/seed-campagne-test");
    await seedCampagneTestBenevole(db, ctx);
  },
];
