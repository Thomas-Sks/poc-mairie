import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import * as exp from "../application/explorer";
import { moteurStatistiquesDrizzle } from "./moteur-drizzle";

const moteur = { moteur: moteurStatistiquesDrizzle };

type Entree<F extends (...args: never[]) => unknown> = Parameters<F>[2];

export const casDUsage = {
  executerRequete: (ctx: Contexte, e: Entree<typeof exp.executerRequete>) => exp.executerRequete(moteur, ctx, e),
  listerPersonnes: (ctx: Contexte, e: Entree<typeof exp.listerPersonnes>) => exp.listerPersonnes(moteur, ctx, e),
  obtenirReferentiels: (ctx: Contexte) => exp.obtenirReferentiels(moteur, ctx),
  obtenirQuartiers: (ctx: Contexte) => exp.obtenirQuartiers(moteur, ctx),
};
