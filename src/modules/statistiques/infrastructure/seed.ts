/**
 * Données de démo du module statistiques (E12-US4) : dashboards prédéfinis et requêtes enregistrées.
 * Branché dans EXTENSIONS_SEED (sans dépendance à `server-only` : exécuté par `pnpm db:seed`).
 */
import * as s from "@/shared/infrastructure/db/schema";
import type { ExtensionSeed } from "@/shared/infrastructure/seed/extensions";
import { dashboardsPredefinis, requetesPredefinies } from "../domain/dashboard";

export const seedStatistiques: ExtensionSeed = async (db, ctx) => {
  const admin = ctx.utilisateurs.find((u) => u.role === "admin");
  const julie = ctx.utilisateurs.find((u) => u.prenom === "Julie") ?? admin;

  await db.insert(s.dashboards).values(
    dashboardsPredefinis({ jour: ctx.jour, campagneCaniculeId: ctx.campagneCaniculeId }).map((d) => ({
      communeId: ctx.communeId,
      nom: d.nom,
      predefini: true,
      partage: true,
      widgets: d.widgets,
      creePar: admin?.id ?? null,
    })),
  );

  await db.insert(s.requetesStat).values(
    requetesPredefinies().map((r, i) => ({
      communeId: ctx.communeId,
      nom: r.nom,
      definition: r.definition,
      creePar: (i === 0 ? julie : admin)?.id ?? null,
    })),
  );
};
