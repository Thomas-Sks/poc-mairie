import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import * as dash from "../application/dashboards";
import * as exp from "../application/explorer";
import { dashboardRepositoryDrizzle, requeteRepositoryDrizzle } from "./depots-drizzle";
import { moteurStatistiquesDrizzle } from "./moteur-drizzle";

const moteur = { moteur: moteurStatistiquesDrizzle };
const requetes = { requetes: requeteRepositoryDrizzle };
const deps = { moteur: moteurStatistiquesDrizzle, dashboards: dashboardRepositoryDrizzle };

type Entree<F extends (...args: never[]) => unknown> = Parameters<F>[2];

export const casDUsage = {
  executerRequete: (ctx: Contexte, e: Entree<typeof exp.executerRequete>) => exp.executerRequete(moteur, ctx, e),
  listerPersonnes: (ctx: Contexte, e: Entree<typeof exp.listerPersonnes>) => exp.listerPersonnes(moteur, ctx, e),
  obtenirReferentiels: (ctx: Contexte) => exp.obtenirReferentiels(moteur, ctx),
  obtenirQuartiers: (ctx: Contexte) => exp.obtenirQuartiers(moteur, ctx),
  listerRequetes: (ctx: Contexte) => exp.listerRequetes(requetes, ctx),
  obtenirRequete: (ctx: Contexte, id: string) => exp.obtenirRequete(requetes, ctx, id),
  enregistrerRequete: (ctx: Contexte, e: Entree<typeof exp.enregistrerRequete>) => exp.enregistrerRequete(requetes, ctx, e),
  supprimerRequete: (ctx: Contexte, id: string) => exp.supprimerRequete(requetes, ctx, id),
  listerDashboards: (ctx: Contexte) => dash.listerDashboards(deps, ctx),
  consulterDashboard: (ctx: Contexte, e: Entree<typeof dash.consulterDashboard>) => dash.consulterDashboard(deps, ctx, e),
  creerDashboard: (ctx: Contexte, nom: string) => dash.creerDashboard(deps, ctx, nom),
  modifierDashboard: (ctx: Contexte, e: Entree<typeof dash.modifierDashboard>) => dash.modifierDashboard(deps, ctx, e),
  enregistrerDisposition: (ctx: Contexte, e: Entree<typeof dash.enregistrerDisposition>) => dash.enregistrerDisposition(deps, ctx, e),
  ajouterWidget: (ctx: Contexte, e: Entree<typeof dash.ajouterWidget>) => dash.ajouterWidget(deps, ctx, e),
  retirerWidget: (ctx: Contexte, e: Entree<typeof dash.retirerWidget>) => dash.retirerWidget(deps, ctx, e),
  supprimerDashboard: (ctx: Contexte, id: string) => dash.supprimerDashboard(deps, ctx, id),
};
