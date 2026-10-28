import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Contexte } from "@/shared/application/contexte";
import { db } from "@/shared/infrastructure/db/client";
import { utilisateurs } from "@/shared/infrastructure/db/schema";
import * as appel from "../application/appel";
import { consulterMaListe, trouverPersonneSuivante } from "../application/consulter-ma-liste";
import { accepterEngagement, rendreMaListe } from "../application/engagement-et-liste";
import type { Engagements } from "../application/ports";
import { journalAppelsDrizzle } from "./journal-appels-drizzle";
import { lectureBenevoleDrizzle } from "./lecture-drizzle";

const engagementsDrizzle: Engagements = {
  async accepter(communeId, benevoleId, at) {
    await db
      .update(utilisateurs)
      .set({ confidentialiteAccepteeAt: at })
      .where(and(eq(utilisateurs.id, benevoleId), eq(utilisateurs.communeId, communeId)));
  },
};

/**
 * Assemblage des cas d'usage. Pour brancher le module « crise » à la fusion, il suffit de remplacer
 * `journalAppelsDrizzle` par un adaptateur du port `JournalAppels` qui délègue à son cas d'usage.
 */
const deps = { lecture: lectureBenevoleDrizzle, journal: journalAppelsDrizzle, engagements: engagementsDrizzle };

export const casDUsageBenevole = {
  consulterMaListe: (ctx: Contexte) => consulterMaListe(deps, ctx),
  trouverPersonneSuivante: (ctx: Contexte) => trouverPersonneSuivante(deps, ctx),
  ouvrirAppel: (ctx: Contexte, cibleId: string) => appel.ouvrirAppel(deps, ctx, cibleId),
  prendreVerrou: (ctx: Contexte, cibleId: string) => appel.prendreVerrou(deps, ctx, cibleId),
  libererVerrou: (ctx: Contexte, cibleId: string) => appel.libererVerrou(deps, ctx, cibleId),
  enregistrerResultat: (ctx: Contexte, e: appel.EntreeResultat) => appel.enregistrerResultat(deps, ctx, e),
  enregistrerResultatProche: (ctx: Contexte, e: appel.EntreeProche) => appel.enregistrerResultatProche(deps, ctx, e),
  creerDemande: (ctx: Contexte, e: appel.EntreeDemande) => appel.creerDemande(deps, ctx, e),
  accepterEngagement: (ctx: Contexte) => accepterEngagement(deps, ctx),
  rendreMaListe: (ctx: Contexte) => rendreMaListe(deps, ctx),
};

/** Sélecteur d'utilisateur du POC (indispensable pour la démo), affiché dans l'en-tête bénévole. */
export async function utilisateursDuSelecteur(communeId: string) {
  return db
    .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role })
    .from(utilisateurs)
    .where(eq(utilisateurs.communeId, communeId))
    .orderBy(asc(utilisateurs.createdAt));
}
