/**
 * Données de démo de l'écran « Bénévoles » (branchées dans EXTENSIONS_SEED) : personnes confiées à Marc et Lucie.
 * Au déclenchement d'une alerte, elles arrivent directement dans leur liste d'appels.
 * Pas d'import `server-only` : exécuté par le script de seed (tsx).
 */
import * as s from "@/shared/infrastructure/db/schema";
import type { ExtensionSeed } from "@/shared/infrastructure/seed/extensions";

export const seedBenevoles: ExtensionSeed = async (db, ctx) => {
  const marc = ctx.utilisateurs.find((u) => u.prenom === "Marc");
  const lucie = ctx.utilisateurs.find((u) => u.prenom === "Lucie");
  if (!marc || !lucie) return;
  // Personnes joignables par téléphone, les plus prioritaires d'abord.
  const joignables = ctx.beneficiaires
    .filter((b) => b.statut === "active" && !b.pasDeTelephone)
    .sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, "fr"));
  const confier = (benevoleId: string, ids: string[]) => ids.map((beneficiaireId) => ({ beneficiaireId, utilisateurId: benevoleId }));
  await db.insert(s.assignations).values([
    ...confier(marc.id, joignables.slice(0, 8).map((b) => b.id)),
    ...confier(lucie.id, joignables.slice(8, 14).map((b) => b.id)),
  ]);
};
