/**
 * Données de démo du registre (branchées dans EXTENSIONS_SEED) : listes enregistrées.
 * Pas d'import `server-only` : exécuté par le script de seed (tsx).
 */
import { and, eq, inArray } from "drizzle-orm";
import * as s from "@/shared/infrastructure/db/schema";
import type { ExtensionSeed } from "@/shared/infrastructure/seed/extensions";
import { numeroCorrespond, versJson, type Filtre } from "../domain/filtre";
import { comparerPriorite } from "../domain/tableau";

const MARAIS: Filtre = { version: 1, rues: [{ voie: "Rue du Marais", numeroMin: 1, numeroMax: 41, cote: "impair" }] };

export const seedRegistre: ExtensionSeed = async (db, ctx) => {
  const admin = ctx.utilisateurs.find((u) => u.role === "admin");
  const julie = ctx.utilisateurs.find((u) => u.prenom === "Julie");

  // Liste figée « Rue du Marais – impairs 1 à 41 » (scénario inondation §10.4-6)
  const foyers = await db
    .select({ id: s.foyers.id, numero: s.foyers.numero })
    .from(s.foyers)
    .where(and(eq(s.foyers.communeId, ctx.communeId), eq(s.foyers.voie, "Rue du Marais")));
  const foyerIds = foyers.filter((f) => numeroCorrespond(MARAIS.rues![0], f.numero)).map((f) => f.id);
  const personnes =
    foyerIds.length === 0
      ? []
      : await db
          .select({ id: s.beneficiaires.id, niveau: s.beneficiaires.niveauPriorite, force: s.beneficiaires.niveauForce, score: s.beneficiaires.score, nom: s.beneficiaires.nom, statut: s.beneficiaires.statut })
          .from(s.beneficiaires)
          .where(inArray(s.beneficiaires.foyerId, foyerIds));
  const ids = personnes
    .filter((p) => p.statut !== "archivee")
    .map((p) => ({ ...p, niveau: p.force ?? p.niveau }))
    .sort(comparerPriorite)
    .map((p) => p.id);

  await db.insert(s.listes).values([
    { communeId: ctx.communeId, nom: "Rue du Marais – impairs 1 à 41", type: "figee", filtre: versJson(MARAIS), beneficiaireIds: ids, creePar: admin?.id ?? null },
    {
      communeId: ctx.communeId,
      nom: "P1 vivant seuls",
      type: "dynamique",
      filtre: versJson({ version: 1, niveaux: ["P1"], vitSeul: true }),
      beneficiaireIds: [],
      creePar: julie?.id ?? admin?.id ?? null,
    },
  ]);
};
