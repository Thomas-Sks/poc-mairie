import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import { notifier } from "@/modules/notifications/infrastructure";
import * as cas from "../application";
import { depotCriseDrizzle } from "./depot-crise-drizzle";
import { selecteurRegistre } from "./selecteur-registre";

const depot = depotCriseDrizzle;
const deps = { depot, selecteur: selecteurRegistre, notifier };

type Entree<F extends (...args: never[]) => unknown> = Parameters<F>[2];

/** Cas d'usage du module Crise, câblés sur PostgreSQL. */
export const casDUsageCrise = {
  // Alertes
  declencherAlerte: (ctx: Contexte, e: Entree<typeof cas.declencherAlerte>) => cas.declencherAlerte({ depot }, ctx, e),
  listerAlertes: (ctx: Contexte) => cas.listerAlertes({ depot }, ctx),
  obtenirAlerte: (ctx: Contexte, id: string) => cas.obtenirAlerte({ depot }, ctx, id),
  cloturerAlerte: (ctx: Contexte, id: string) => cas.cloturerAlerte({ depot }, ctx, id),

  // Campagnes
  preparerCampagne: (ctx: Contexte, e: Entree<typeof cas.preparerCampagne>) => cas.preparerCampagne(deps, ctx, e),
  compterSelection: (ctx: Contexte, e: Entree<typeof cas.compterSelection>) => cas.compterSelection(deps, ctx, e),
  creerCampagne: (ctx: Contexte, e: Entree<typeof cas.creerCampagne>) => cas.creerCampagne(deps, ctx, e),
  assurerVagueDuJour: (ctx: Contexte, e: Entree<typeof cas.assurerVagueDuJour>) => cas.assurerVagueDuJour(deps, ctx, e),
  consulterTableauDeBord: (ctx: Contexte, e: Entree<typeof cas.consulterTableauDeBord>) => cas.consulterTableauDeBord(deps, ctx, e),
  reintegrerCible: (ctx: Contexte, e: Entree<typeof cas.reintegrerCible>) => cas.reintegrerCible(deps, ctx, e),
  repartirCibles: (ctx: Contexte, e: Entree<typeof cas.repartirCibles>) => cas.repartirCibles(deps, ctx, e),
  assignerCible: (ctx: Contexte, e: Entree<typeof cas.assignerCible>) => cas.assignerCible(deps, ctx, e),
  rapportCampagne: (ctx: Contexte, e: Entree<typeof cas.rapportCampagne>) => cas.rapportCampagne(deps, ctx, e),
  exporterListeCsv: (ctx: Contexte, e: Entree<typeof cas.exporterListeCsv>) => cas.exporterListeCsv(deps, ctx, e),
  consulterAppelIa: (ctx: Contexte, e: Entree<typeof cas.consulterAppelIa>) => cas.consulterAppelIa(deps, ctx, e),

  // Appels (aussi utilisés par l'interface bénévole)
  enregistrerResultatAppel: (ctx: Contexte, e: cas.EntreeResultatAppel) => cas.enregistrerResultatAppel({ depot, notifier }, ctx, e),
  prendreVerrou: (ctx: Contexte, e: { cibleId: string }) => cas.prendreVerrou({ depot }, ctx, e),
  libererVerrou: (ctx: Contexte, e: { cibleId: string }) => cas.libererVerrou({ depot }, ctx, e),
  ouvrirFicheAppel: (ctx: Contexte, e: { cibleId: string }) => cas.ouvrirFicheAppel({ depot }, ctx, e),
};
