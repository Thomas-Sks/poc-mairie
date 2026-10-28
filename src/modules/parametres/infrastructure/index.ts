import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import { db } from "@/shared/infrastructure/db/client";
import { reinitialiserDemo as rechargerJeuDeDemo } from "@/shared/infrastructure/seed/demo";
import { lireParametres, modifierGrilleScore, modifierRelancesEtRappels, modifierTextesRgpd } from "../application/parametres";
import { recalculerScores } from "../application/recalculer-scores";
import { inviterBenevole, reinitialiserDemo } from "../application/equipe-et-demo";
import type { DemoPort } from "../application/ports";
import { parametresRepositoryDrizzle } from "./parametres-repository-drizzle";

const deps = { parametres: parametresRepositoryDrizzle };
const demo: DemoPort = {
  async reinitialiser() {
    await rechargerJeuDeDemo(db);
  },
};

export const casDUsage = {
  lireParametres: (ctx: Contexte) => lireParametres(deps, ctx),
  modifierGrilleScore: (ctx: Contexte, e: Parameters<typeof modifierGrilleScore>[2]) => modifierGrilleScore(deps, ctx, e),
  recalculerScores: (ctx: Contexte) => recalculerScores(deps, ctx),
  modifierRelancesEtRappels: (ctx: Contexte, e: Parameters<typeof modifierRelancesEtRappels>[2]) => modifierRelancesEtRappels(deps, ctx, e),
  modifierTextesRgpd: (ctx: Contexte, e: Parameters<typeof modifierTextesRgpd>[2]) => modifierTextesRgpd(deps, ctx, e),
  inviterBenevole: (ctx: Contexte, e: Parameters<typeof inviterBenevole>[2]) => inviterBenevole(deps, ctx, e),
  reinitialiserDemo: (ctx: Contexte) => reinitialiserDemo({ demo }, ctx),
};
