/**
 * Assemblage du module « bénéficiaires » : branche les adaptateurs Drizzle / BAN sur les cas d'usage.
 */
import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import type { DepsBeneficiaires } from "../application/ports";
import * as cercle from "../application/cercle";
import { consulterFiche, consulterReferentiels, rechercherAdresses } from "../application/consulter-fiche";
import { creerFiche } from "../application/creer-fiche";
import { archiverFiche, definirAssistantIa, forcerPriorite } from "../application/gerer-fiche";
import * as indisponibilites from "../application/indisponibilites";
import * as journal from "../application/journal";
import { modifierFiche } from "../application/modifier-fiche";
import * as prises from "../application/prises-en-charge";
import { cercleRepositoryDrizzle } from "./cercle-repository.drizzle";
import { ficheRepositoryDrizzle } from "./fiche-repository.drizzle";
import { geocodeurBan } from "./geocodeur-ban";
import { priseEnChargeRepositoryDrizzle } from "./prises-en-charge-repository.drizzle";
import { suiviRepositoryDrizzle } from "./suivi-repository.drizzle";

const deps: DepsBeneficiaires = {
  fiches: ficheRepositoryDrizzle,
  suivi: suiviRepositoryDrizzle,
  cercle: cercleRepositoryDrizzle,
  prises: priseEnChargeRepositoryDrizzle,
  geocodeur: geocodeurBan,
};

/** Lie un cas d'usage `(deps, ctx, entree)` aux dépendances réelles → `(ctx, entree)`. */
const lier =
  <E, R>(cas: (d: DepsBeneficiaires, ctx: Contexte, e: E) => Promise<R>) =>
  (ctx: Contexte, e: E) =>
    cas(deps, ctx, e);

export const casDUsage = {
  consulterFiche: lier(consulterFiche),
  consulterReferentiels: (ctx: Contexte) => consulterReferentiels(deps, ctx),
  rechercherAdresses: lier(rechercherAdresses),
  creerFiche: lier(creerFiche),
  modifierFiche: lier(modifierFiche),
  archiverFiche: lier(archiverFiche),
  forcerPriorite: lier(forcerPriorite),
  definirAssistantIa: lier(definirAssistantIa),
  // Journal & rappels
  enregistrerInteraction: lier(journal.enregistrerInteraction),
  creerRappel: lier(journal.creerRappel),
  marquerRappelFait: lier(journal.marquerRappelFait),
  consulterJournal: lier(journal.consulterJournal),
  consulterAppelIa: lier(journal.consulterAppelIa),
  // Indisponibilités
  listerIndisponibilites: lier(indisponibilites.listerIndisponibilites),
  declarerIndisponibilite: lier(indisponibilites.declarerIndisponibilite),
  signalerRetour: lier(indisponibilites.signalerRetour),
  // Cercle
  listerCercle: lier(cercle.listerCercle),
  chercherContacts: lier(cercle.chercherContacts),
  ajouterAuCercle: lier(cercle.ajouterAuCercle),
  modifierMembreCercle: lier(cercle.modifierMembreCercle),
  retirerDuCercle: lier(cercle.retirerDuCercle),
  // Prises en charge
  listerPrisesEnCharge: lier(prises.listerPrisesEnCharge),
  ajouterPriseEnCharge: lier(prises.ajouterPriseEnCharge),
  modifierPriseEnCharge: lier(prises.modifierPriseEnCharge),
  retirerPriseEnCharge: lier(prises.retirerPriseEnCharge),
  enregistrerCreneau: lier(prises.enregistrerCreneau),
  retirerCreneau: lier(prises.retirerCreneau),
};
