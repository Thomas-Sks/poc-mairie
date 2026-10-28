import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import { obtenirTachesDuJour } from "../application/obtenir-taches-du-jour";
import { marquerRappelFait, reporterRappel } from "../application/gerer-rappel";
import { tachesRepositoryDrizzle } from "./taches-repository-drizzle";

const deps = { taches: tachesRepositoryDrizzle };

export const casDUsage = {
  obtenirTachesDuJour: (ctx: Contexte, e: Parameters<typeof obtenirTachesDuJour>[2]) => obtenirTachesDuJour(deps, ctx, e),
  marquerRappelFait: (ctx: Contexte, e: Parameters<typeof marquerRappelFait>[2]) => marquerRappelFait(deps, ctx, e),
  reporterRappel: (ctx: Contexte, e: Parameters<typeof reporterRappel>[2]) => reporterRappel(deps, ctx, e),
};
