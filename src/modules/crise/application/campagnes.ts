/**
 * Cas d'usage : campagnes d'appel (E9-US2 à US5, E9-US7, E6-US3, E6-US4, NF-07, maquettes E11).
 */
import type { Contexte } from "@/shared/application/contexte";
import { RELANCE_PAR_DEFAUT, repartir, verrouActif, type ParametresRelance } from "@/shared/domain/campagne";
import { aujourdhui, formaterHeure, type DateISO } from "@/shared/domain/dates";
import { AccesRefuse, exiger, peut } from "@/shared/domain/permissions";
import {
  ALERTE_LIBELLES,
  BESOIN_LIBELLES,
  STATUT_CIBLE_LIBELLES,
  type Canal,
  type Frequence,
  type TypeCampagne,
} from "@/shared/domain/vocabulaire";
import type { ContenuScript } from "@/shared/infrastructure/db/schema";
import { SCRIPTS_PAR_DEFAUT } from "../domain/scripts-par-defaut";
import { genererVague, vagueDueLe } from "../domain/vague";
import {
  compterCouverture,
  compterParStatut,
  estTraitee,
  progressionParAppelant,
  situationsPrioritaires,
} from "../domain/tableau-de-bord";
import { calculerStatistiques, STATUTS_SIGNALES } from "../domain/rapport";
import { versCsv } from "../domain/export-csv";
import { decrireFiltre, filtreGeographiqueSchema } from "../domain/filtre-geographique";
import type { Campagne, CibleTableau, DepotCrise, Notifieur, SelecteurBeneficiaires, SourceCampagne } from "./ports";

type Deps = { depot: DepotCrise; selecteur: SelecteurBeneficiaires; notifier: Notifieur };

const nomComplet = (c: { civilite: string; prenom: string; nom: string }) => `${c.civilite} ${c.prenom} ${c.nom}`;

/** Données du formulaire de création de campagne pour une alerte. */
export async function preparerCampagne(deps: Deps, ctx: Contexte, entree: { alerteId: string }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const alerte = await deps.depot.obtenirAlerte(ctx.commune.id, entree.alerteId);
  if (!alerte) return null;
  const script =
    (await deps.depot.scriptParType(ctx.commune.id, alerte.type)) ??
    SCRIPTS_PAR_DEFAUT.find((s) => s.type === alerte.type)?.contenu ??
    SCRIPTS_PAR_DEFAUT[0].contenu;
  const [listes, voies, quartiers, membres, nbActifs] = await Promise.all([
    deps.depot.listerListes(ctx.commune.id),
    deps.depot.listerVoies(ctx.commune.id),
    deps.depot.listerQuartiers(ctx.commune.id),
    deps.depot.listerMembres(ctx.commune.id),
    deps.depot.idsBeneficiairesActifs(ctx.commune.id).then((ids) => ids.length),
  ]);
  return {
    alerte,
    nomParDefaut: `${ALERTE_LIBELLES[alerte.type]} ${alerte.perimetre === "Toute la commune" ? "" : `${alerte.perimetre} `}– ${alerte.debut.split("-").reverse().join("/")}`.replace(/\s+/g, " "),
    script,
    relance: RELANCE_PAR_DEFAUT,
    listes,
    voies,
    quartiers,
    membres,
    nbActifs,
  };
}

/** Résout la source (tous / liste / filtre) en identifiants de fiches actives. */
async function resoudreSource(deps: Deps, ctx: Contexte, source: SourceCampagne): Promise<string[]> {
  switch (source.type) {
    case "tous":
      return deps.depot.idsBeneficiairesActifs(ctx.commune.id);
    case "liste": {
      const liste = source.listeId ? await deps.depot.obtenirListe(ctx.commune.id, source.listeId) : null;
      if (!liste) throw new Error("Liste introuvable.");
      return liste.type === "figee"
        ? deps.depot.idsBeneficiairesActifs(ctx.commune.id, liste.beneficiaireIds)
        : deps.selecteur.rechercherBeneficiaireIds(ctx, liste.filtre);
    }
    case "filtre":
      return deps.selecteur.rechercherBeneficiaireIds(ctx, source.filtre ?? {});
  }
}

/** Aperçu du nombre de personnes concernées avant de lancer la campagne. */
export async function compterSelection(deps: Deps, ctx: Contexte, source: SourceCampagne): Promise<number> {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  return (await resoudreSource(deps, ctx, source)).length;
}

export type EntreeCampagne = {
  alerteId: string;
  nom: string;
  type: TypeCampagne;
  script: ContenuScript;
  frequence: Frequence;
  frequenceJours: number | null;
  canal: Canal;
  relance: ParametresRelance;
  source: SourceCampagne;
  equipe: string[];
  repartirAutomatiquement: boolean;
};

/**
 * E9-US2 / E9-US3 : crée la campagne (snapshot des bénéficiaires), génère la vague du jour
 * (exclusions RG-05, tri RG-02) et répartit les appels entre l'équipe si demandé.
 */
export async function creerCampagne(deps: Deps, ctx: Contexte, entree: EntreeCampagne): Promise<{ campagneId: string; smsSimules: string[] }> {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const alerte = await deps.depot.obtenirAlerte(ctx.commune.id, entree.alerteId);
  if (!alerte || alerte.statut !== "active") throw new Error("L'alerte n'est plus active.");
  if (entree.source.type === "filtre") entree.source.filtre = filtreGeographiqueSchema.parse(entree.source.filtre ?? {});

  const ids = await resoudreSource(deps, ctx, entree.source);
  if (ids.length === 0) throw new Error("Aucune personne ne correspond à cette sélection.");
  const jour = aujourdhui(ctx.maintenant);
  const campagneId = await deps.depot.creerCampagne(ctx.commune.id, {
    alerteId: alerte.id,
    nom: entree.nom,
    type: entree.type,
    script: entree.script,
    frequence: entree.frequence,
    frequenceJours: entree.frequence === "tous_n_jours" ? entree.frequenceJours : null,
    canal: entree.canal,
    relance: entree.relance,
    source: entree.source,
    beneficiaireIds: ids,
    equipe: entree.equipe,
    dateDebut: alerte.debut > jour ? alerte.debut : jour,
    dateFin: alerte.finPrevue && alerte.finPrevue >= jour ? alerte.finPrevue : entree.frequence === "unique" ? jour : null,
  });

  const campagne = (await deps.depot.obtenirCampagne(ctx.commune.id, campagneId))!;
  await assurerVague(deps, ctx, campagne, jour);

  let smsSimules: string[] = [];
  if (entree.repartirAutomatiquement) {
    const membres = await deps.depot.listerMembres(ctx.commune.id);
    const appelants = membres.filter((m) => entree.equipe.includes(m.id) && m.role !== "admin").map((m) => m.id);
    if (appelants.length) smsSimules = (await repartirCibles(deps, ctx, { campagneId, utilisateurIds: appelants })).smsSimules;
  }
  return { campagneId, smsSimules };
}

/** E9-US4 : génère la vague du jour (une seule fois) puis enregistre les appels IA fictifs (maquette E11). */
async function assurerVague(deps: Deps, ctx: Contexte, campagne: Campagne, jour: DateISO) {
  if (!vagueDueLe(campagne, jour)) return;
  const creees = await deps.depot.genererVagueSiAbsente(campagne, jour, (beneficiaires) => genererVague(beneficiaires, jour, campagne.canal));
  const ia = creees.filter((c) => c.generee.maquetteIa?.detail);
  for (const c of ia) {
    const m = c.generee.maquetteIa!;
    await deps.depot.creerInteraction(ctx.commune.id, {
      beneficiaireId: c.generee.beneficiaireId,
      campagneId: campagne.id,
      type: "appel_ia",
      survenueLe: ctx.maintenant,
      auteurId: null,
      interlocuteurContactId: null,
      resultat: m.statut,
      compteRendu: m.detail!.resume,
      besoins: m.besoins,
      dureeMinutes: 4,
      detailIa: m.detail,
    });
  }
  // RG-06 : toute escalade crée une notification.
  const escalades = ia.filter((c) => c.generee.statut === "escalade_humain");
  if (escalades.length) {
    await deps.notifier(ctx, {
      roles: ["admin", "agent"],
      type: "escalade",
      titre: `Escaladé par l'IA (démonstration) : ${campagne.nom}`,
      message: "La personne dit avoir des vertiges : à rappeler par un humain.",
      lien: `/campagnes/${campagne.id}`,
    });
  }
}

function exigerLecture(ctx: Contexte) {
  if (!peut(ctx.utilisateur.role, "campagnes.gerer") && !peut(ctx.utilisateur.role, "appel.benevole")) throw new AccesRefuse("campagnes.gerer");
}

/**
 * Vague du jour d'une campagne active : générée à la première consultation du jour (E9-US4).
 * Utilisable aussi par l'interface bénévole avant d'afficher la liste d'appels.
 */
export async function assurerVagueDuJour(deps: Deps, ctx: Contexte, entree: { campagneId: string }): Promise<void> {
  exigerLecture(ctx);
  const campagne = await deps.depot.obtenirCampagne(ctx.commune.id, entree.campagneId);
  if (campagne) await assurerVague(deps, ctx, campagne, aujourdhui(ctx.maintenant));
}

/** Vague affichée : celle demandée, sinon celle du jour, sinon la plus récente passée. */
function choisirVague(vagues: DateISO[], jour: DateISO, demandee?: string | null): DateISO | null {
  if (demandee && vagues.includes(demandee)) return demandee;
  if (vagues.includes(jour)) return jour;
  return [...vagues].reverse().find((v) => v <= jour) ?? vagues[0] ?? null;
}

/** E9-US5 / E6-US4 : tableau de bord temps réel d'une campagne. */
export async function consulterTableauDeBord(deps: Deps, ctx: Contexte, entree: { campagneId: string; vague?: string | null }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const campagne = await deps.depot.obtenirCampagne(ctx.commune.id, entree.campagneId);
  if (!campagne) return null;
  const jour = aujourdhui(ctx.maintenant);
  await assurerVague(deps, ctx, campagne, jour);
  const vagues = await deps.depot.listerVagues(campagne.id);
  const vague = choisirVague(vagues, jour, entree.vague);
  const [cibles, membres] = await Promise.all([
    vague ? deps.depot.listerCibles(ctx.commune.id, campagne.id, vague) : Promise.resolve([]),
    deps.depot.listerMembres(ctx.commune.id),
  ]);
  const enCours = cibles.filter((c) => c.verrouPar && verrouActif(c.verrouAt, ctx.maintenant) && !estTraitee(c.statut));
  return {
    campagne: { ...campagne, beneficiaireIds: [] as string[] },
    vagues,
    vague,
    estVagueDuJour: vague === jour,
    maintenant: ctx.maintenant.toISOString(),
    peutCloturer: peut(ctx.utilisateur.role, "alertes.declencher"),
    utilisateurId: ctx.utilisateur.id,
    membres,
    cibles: cibles.map((c) => ({ ...c, verrouActif: Boolean(c.verrouPar && verrouActif(c.verrouAt, ctx.maintenant)) })),
    indicateurs: {
      couverture: compterCouverture(cibles),
      statuts: compterParStatut(cibles),
      enCours: enCours.length,
      prioritaires: situationsPrioritaires(cibles).map((c) => c.id),
      progression: progressionParAppelant(cibles),
      ia: cibles.filter((c) => c.canal === "ia").length,
    },
  };
}
export type TableauDeBord = NonNullable<Awaited<ReturnType<typeof consulterTableauDeBord>>>;

/** E6-US3 : réintégration en 1 clic d'une personne exclue automatiquement (le motif reste visible). */
export async function reintegrerCible(deps: Deps, ctx: Contexte, entree: { cibleId: string }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const cible = await deps.depot.obtenirCible(ctx.commune.id, entree.cibleId);
  if (!cible) throw new Error("Cible introuvable.");
  await deps.depot.mettreAJourCible(cible.id, { exclue: false, statut: "a_appeler", couverture: null });
}

/** E8-US6 : répartition automatique (tourniquet dans l'ordre RG-02) des appels restants de la vague. */
export async function repartirCibles(
  deps: Deps,
  ctx: Contexte,
  entree: { campagneId: string; utilisateurIds: string[] },
): Promise<{ nbCibles: number; smsSimules: string[] }> {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  if (entree.utilisateurIds.length === 0) throw new Error("Choisissez au moins une personne.");
  const campagne = await deps.depot.obtenirCampagne(ctx.commune.id, entree.campagneId);
  if (!campagne) throw new Error("Campagne introuvable.");
  const vagues = await deps.depot.listerVagues(campagne.id);
  const vague = choisirVague(vagues, aujourdhui(ctx.maintenant));
  if (!vague) return { nbCibles: 0, smsSimules: [] };
  const cibles = (await deps.depot.listerCibles(ctx.commune.id, campagne.id, vague))
    .filter((c) => !c.exclue && c.canal === "humain" && !estTraitee(c.statut))
    .sort((a, b) => a.rang - b.rang);
  const lots = repartir(cibles, entree.utilisateurIds.length);
  await deps.depot.assigner(
    ctx.commune.id,
    campagne.id,
    lots.flatMap((lot, i) => lot.map((c) => ({ cibleId: c.id, utilisateurId: entree.utilisateurIds[i] }))),
  );
  const membres = await deps.depot.listerMembres(ctx.commune.id);
  const smsSimules = entree.utilisateurIds
    .map((id, i) => ({ m: membres.find((x) => x.id === id), n: lots[i].length }))
    .filter(({ m, n }) => m?.role === "benevole" && n > 0)
    .map(({ m, n }) => `SMS envoyé à ${m!.prenom} ${m!.nom}${m!.telephone ? ` (${m!.telephone})` : ""} : « Campagne lancée, votre liste de ${n} appels est prête. »`);
  return { nbCibles: cibles.length, smsSimules };
}

/** Assignation manuelle d'une cible à un appelant (ou retour au pot commun). */
export async function assignerCible(deps: Deps, ctx: Contexte, entree: { campagneId: string; cibleId: string; utilisateurId: string | null }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  await deps.depot.assigner(ctx.commune.id, entree.campagneId, [{ cibleId: entree.cibleId, utilisateurId: entree.utilisateurId }]);
}

/** E9-US7 : rapport de campagne (statistiques, situations signalées, actions menées). */
export async function rapportCampagne(deps: Deps, ctx: Contexte, entree: { campagneId: string }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const donnees = await deps.depot.donneesRapport(ctx.commune.id, entree.campagneId);
  if (!donnees) return null;
  const stats = calculerStatistiques(donnees.cibles);
  const signalees = donnees.cibles
    .filter((c) => STATUTS_SIGNALES.has(c.statut))
    .sort((a, b) => a.vagueDate.localeCompare(b.vagueDate) || a.rang - b.rang)
    .map((c) => {
      const actions = donnees.interactions
        .filter((i) => i.beneficiaireId === c.beneficiaireId && aujourdhui(i.survenueLe) === c.vagueDate)
        .map((i) => `${formaterHeure(i.survenueLe)} · ${i.compteRendu ?? STATUT_CIBLE_LIBELLES[i.resultat ?? "joint_ras"]}${i.auteur ? ` (${i.auteur})` : ""}`);
      return {
        id: c.id,
        vagueDate: c.vagueDate,
        personne: nomComplet(c),
        adresse: c.adresse,
        statut: c.statut,
        besoins: c.besoins.map((b) => BESOIN_LIBELLES[b]),
        note: c.note,
        actions,
      };
    });
  return { campagne: donnees.campagne, commune: ctx.commune, genereLe: ctx.maintenant, stats, signalees, rappelsCrees: donnees.rappelsCrees };
}

/** NF-07 : export de secours (CSV) de la liste d'appel de la vague. */
export async function exporterListeCsv(deps: Deps, ctx: Contexte, entree: { campagneId: string; vague?: string | null }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  const campagne = await deps.depot.obtenirCampagne(ctx.commune.id, entree.campagneId);
  if (!campagne) return null;
  const vagues = await deps.depot.listerVagues(campagne.id);
  const vague = choisirVague(vagues, aujourdhui(ctx.maintenant), entree.vague);
  const [cibles, membres] = await Promise.all([
    vague ? deps.depot.listerCibles(ctx.commune.id, campagne.id, vague) : Promise.resolve([] as CibleTableau[]),
    deps.depot.listerMembres(ctx.commune.id),
  ]);
  const nomMembre = (id: string | null) => {
    const m = membres.find((x) => x.id === id);
    return m ? `${m.prenom} ${m.nom}` : "";
  };
  const colonnes = ["Ordre", "Priorité", "Civilité", "Nom", "Prénom", "Téléphone", "Adresse", "Statut", "Motif d'exclusion", "Appelant", "Canal", "Tentatives", "Besoins", "Note", "Résultat (papier)"];
  const csv = versCsv(
    colonnes,
    cibles.map((c) => ({
      Ordre: c.rang,
      Priorité: `${c.niveau} (${c.score})`,
      Civilité: c.civilite,
      Nom: c.nom,
      Prénom: c.prenom,
      Téléphone: c.telephone,
      Adresse: c.adresse,
      Statut: STATUT_CIBLE_LIBELLES[c.statut],
      "Motif d'exclusion": c.exclue ? c.motifExclusion : "",
      Appelant: nomMembre(c.assigneA),
      Canal: c.canal === "ia" ? "IA (démonstration)" : "Humain",
      Tentatives: `${c.nbTentatives}/${campagne.relance.nbTentatives}`,
      Besoins: c.besoins.map((b) => BESOIN_LIBELLES[b]).join(", "),
      Note: c.note,
      "Résultat (papier)": "",
    })),
  );
  const slug = campagne.nom.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return { nomFichier: `campagne-${slug}-${vague ?? "vide"}.csv`, csv };
}

/** Maquette E11 : détail d'un appel IA fictif (transcription, résumé, risque). */
export async function consulterAppelIa(deps: Deps, ctx: Contexte, entree: { interactionId: string }) {
  exiger(ctx.utilisateur.role, "campagnes.gerer");
  return deps.depot.obtenirAppelIa(ctx.commune.id, entree.interactionId);
}

/** Description lisible de la source d'une campagne. */
export function decrireSource(source: SourceCampagne, listes: { id: string; nom: string }[] = []): string {
  if (source.type === "tous") return "Tous les bénéficiaires actifs";
  if (source.type === "liste") return `Liste « ${listes.find((l) => l.id === source.listeId)?.nom ?? "sauvegardée"} »`;
  return decrireFiltre(filtreGeographiqueSchema.parse(source.filtre ?? {}));
}
