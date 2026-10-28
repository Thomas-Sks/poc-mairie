/**
 * Cas d'usage : traitement d'une cible de campagne (RG-03, RG-04, RG-05 verrou, RG-06, E10-US5 à US7).
 * Utilisés par le tableau de bord CCAS et par l'interface bénévole.
 */
import type { Contexte } from "@/shared/application/contexte";
import { verrouActif, DUREE_VERROU_MS } from "@/shared/domain/campagne";
import { aujourdhui } from "@/shared/domain/dates";
import { AccesRefuse, peut } from "@/shared/domain/permissions";
import { BESOIN_LIBELLES, type Besoin, type StatutCible } from "@/shared/domain/vocabulaire";
import { deciderResultatAppel, RESULTAT_APPEL_LIBELLES, type DecisionAppel, type ResultatAppel } from "../domain/resultat-appel";
import type { CibleAppel, DepotCrise, FicheAppel, Membre } from "./ports";

export class VerrouPris extends Error {
  constructor(public readonly detenteur: Pick<Membre, "id" | "prenom" | "nom"> | null) {
    super(detenteur ? `En cours d'appel par ${detenteur.prenom} ${detenteur.nom}.` : "Cette personne est déjà en cours d'appel.");
    this.name = "VerrouPris";
  }
}

/** Agents et admin (campagnes.gerer) traitent toute cible ; un bénévole seulement celles qui lui sont assignées (RG-07). */
function verifierAcces(ctx: Contexte, cible: CibleAppel) {
  if (peut(ctx.utilisateur.role, "campagnes.gerer")) return;
  if (peut(ctx.utilisateur.role, "appel.benevole") && cible.assigneA === ctx.utilisateur.id) return;
  throw new AccesRefuse("appel.benevole");
}

async function chargerCible(depot: DepotCrise, ctx: Contexte, cibleId: string): Promise<CibleAppel> {
  const cible = await depot.obtenirCible(ctx.commune.id, cibleId);
  if (!cible) throw new Error("Cible introuvable.");
  verifierAcces(ctx, cible);
  return cible;
}

async function detenteur(depot: DepotCrise, communeId: string, id: string | null) {
  if (!id) return null;
  const membres = await depot.listerMembres(communeId);
  const m = membres.find((x) => x.id === id);
  return m ? { id: m.id, prenom: m.prenom, nom: m.nom } : null;
}

export type ResultatVerrou = { obtenu: boolean; detenteur: Pick<Membre, "id" | "prenom" | "nom"> | null };

/** RG-05 / E8-US7 : prend le verrou d'appel (« En cours d'appel par Julie »), auto-libéré après 10 min. */
export async function prendreVerrou(deps: { depot: DepotCrise }, ctx: Contexte, entree: { cibleId: string }): Promise<ResultatVerrou> {
  const cible = await chargerCible(deps.depot, ctx, entree.cibleId);
  if (cible.campagneStatut !== "active") throw new Error("La campagne est clôturée.");
  const r = await deps.depot.poserVerrou(cible.id, ctx.utilisateur.id, ctx.maintenant, new Date(ctx.maintenant.getTime() - DUREE_VERROU_MS));
  return { obtenu: r.obtenu, detenteur: await detenteur(deps.depot, ctx.commune.id, r.detenteur) };
}

/** Libère le verrou s'il est détenu par l'utilisateur courant (sans effet sinon). */
export async function libererVerrou(deps: { depot: DepotCrise }, ctx: Contexte, entree: { cibleId: string }): Promise<void> {
  const cible = await chargerCible(deps.depot, ctx, entree.cibleId);
  await deps.depot.leverVerrou(cible.id, ctx.utilisateur.id);
}

/** Ouvre la fiche d'appel : prend le verrou et renvoie les informations utiles (téléphones, cercle). */
export async function ouvrirFicheAppel(
  deps: { depot: DepotCrise },
  ctx: Contexte,
  entree: { cibleId: string },
): Promise<{ verrou: ResultatVerrou; fiche: FicheAppel; cible: CibleAppel }> {
  const verrou = await prendreVerrou(deps, ctx, entree);
  const cible = await chargerCible(deps.depot, ctx, entree.cibleId);
  const fiche = await deps.depot.obtenirFicheAppel(ctx.commune.id, cible.beneficiaireId);
  if (!fiche) throw new Error("Fiche introuvable.");
  return { verrou, fiche, cible };
}

export type EntreeResultatAppel = {
  cibleId: string;
  resultat: ResultatAppel;
  /** Besoins détectés (obligatoire en pratique pour « joint_besoin »). */
  besoins?: Besoin[];
  /** Réponses aux questions du script, par identifiant de question. */
  reponses?: Record<string, "oui" | "non">;
  /** Précision libre (ex. la situation de danger en 1 phrase, E10-US6). */
  note?: string | null;
  /** Contact du cercle appelé (« couvert_proche », « proche_ne_repond_pas »). */
  contactId?: string | null;
  /** Rang d'appel du contact du cercle appelé. */
  rangCercle?: number;
  dureeMinutes?: number | null;
};

export type ResultatEnregistrement = {
  cibleId: string;
  statut: StatutCible;
  decision: DecisionAppel;
  /** Messages des SMS simulés (E14-US2), à afficher en toast « SMS envoyé à… ». */
  smsSimules: string[];
};

/**
 * Enregistre le résultat d'un appel de campagne :
 * décision RG-04 (relances, escalade cercle, « non joint – à traiter »), mise à jour de la cible,
 * interaction liée à la campagne, notification admin + agents (danger, évacuation, escalade),
 * rappel pour un besoin (E10-US7). Libère le verrou sauf s'il faut appeler le cercle.
 */
export async function enregistrerResultatAppel(
  deps: { depot: DepotCrise },
  ctx: Contexte,
  entree: EntreeResultatAppel,
): Promise<ResultatEnregistrement> {
  const { depot } = deps;
  const cible = await chargerCible(depot, ctx, entree.cibleId);
  if (cible.campagneStatut !== "active") throw new Error("La campagne est clôturée.");
  if (cible.verrouPar && cible.verrouPar !== ctx.utilisateur.id && verrouActif(cible.verrouAt, ctx.maintenant)) {
    throw new VerrouPris(await detenteur(depot, ctx.commune.id, cible.verrouPar));
  }

  const besoins = entree.resultat === "joint_besoin" ? [...new Set(entree.besoins ?? [])] : [];
  const decision = deciderResultatAppel(
    { statut: cible.statut, nbTentatives: cible.nbTentatives, rangCercleEssaye: cible.rangCercleEssaye },
    { resultat: entree.resultat, besoins, rangCercle: entree.rangCercle, nbContactsCercle: cible.nbContactsCercle },
    ctx.maintenant,
    cible.relance,
  );

  const libelleResultat = RESULTAT_APPEL_LIBELLES[entree.resultat];
  const note = entree.note?.trim() || null;
  await depot.mettreAJourCible(cible.id, {
    statut: decision.statut,
    nbTentatives: decision.nbTentatives,
    prochaineTentativeAt: decision.prochaineTentativeAt,
    rangCercleEssaye: decision.rangCercleEssaye,
    couverture: decision.couverture,
    besoins: besoins.length ? besoins : cible.besoins,
    ...(entree.reponses ? { reponses: entree.reponses } : {}),
    note: note ?? libelleResultat,
    exclue: false,
    verrouPar: decision.appelerCercle ? ctx.utilisateur.id : null,
    verrouAt: decision.appelerCercle ? ctx.maintenant : null,
  });

  await depot.creerInteraction(ctx.commune.id, {
    beneficiaireId: cible.beneficiaireId,
    campagneId: cible.campagneId,
    type: "appel_sortant",
    survenueLe: ctx.maintenant,
    auteurId: ctx.utilisateur.id,
    interlocuteurContactId: entree.contactId ?? null,
    resultat: decision.statut,
    compteRendu: note ? `${libelleResultat}. ${note}` : libelleResultat,
    besoins,
    dureeMinutes: entree.dureeMinutes ?? null,
  });

  const smsSimules: string[] = [];
  if (decision.notification) {
    const equipeCcas = await depot.listerMembres(ctx.commune.id, ["admin", "agent"]);
    const titre =
      decision.statut === "danger"
        ? `Danger – urgence : ${cible.beneficiaireNom}`
        : decision.statut === "evacuation"
          ? `Besoin d'évacuation : ${cible.beneficiaireNom}`
          : `Non joint – à traiter : ${cible.beneficiaireNom}`;
    const message = `${cible.campagneNom} · signalé par ${ctx.utilisateur.prenom} ${ctx.utilisateur.nom}${note ? ` : ${note}` : ""}`;
    await depot.creerNotifications(
      ctx.commune.id,
      equipeCcas.map((m) => ({ destinataireId: m.id, type: decision.notification!, titre, message, lien: `/campagnes/${cible.campagneId}` })),
    );
    // E14-US2 : SMS simulé pour les événements critiques uniquement.
    if (decision.notification === "danger") {
      for (const m of equipeCcas) smsSimules.push(`SMS envoyé à ${m.prenom} ${m.nom}${m.telephone ? ` (${m.telephone})` : ""} : ${titre}`);
    }
  }

  if (decision.creerRappelBesoin) {
    await depot.creerRappel(ctx.commune.id, {
      beneficiaireId: cible.beneficiaireId,
      objet: `Besoin signalé (${besoins.map((b) => BESOIN_LIBELLES[b]).join(", ")}) : ${cible.beneficiaireNom} – ${cible.campagneNom}`,
      echeance: aujourdhui(ctx.maintenant),
      creePar: ctx.utilisateur.id,
      urgent: false,
    });
  }

  return { cibleId: cible.id, statut: decision.statut, decision, smsSimules };
}
