/**
 * Catalogue de l'explorateur de statistiques (E12-US1) : ce que l'on peut compter, filtrer et découper.
 * Vocabulaire métier, sans jargon : chaque entrée porte le libellé affiché à l'agent.
 */
import {
  BESOINS,
  BESOIN_LIBELLES,
  CATEGORIES,
  CATEGORIE_LIBELLES,
  DEPLACEMENTS,
  DEPLACEMENT_LIBELLES,
  INTERACTION_LIBELLES,
  MODES_DE_VIE,
  MODE_DE_VIE_LIBELLES,
  NIVEAUX_PRIORITE,
  PRISE_EN_CHARGE_LIBELLES,
  SEXES,
  SEXE_LIBELLES,
  STATUTS_CIBLE,
  STATUT_CIBLE_LIBELLES,
  TYPES_INTERACTION,
  TYPES_PRISE_EN_CHARGE,
  TYPES_RAPPEL,
  type Deplacement,
  type StatutCible,
  type TypeRappel,
} from "@/shared/domain/vocabulaire";

// ─── Quoi compter ─────────────────────────────────────────────────────────────

export const SUJETS = ["beneficiaires", "interactions", "appels_campagne", "inscriptions", "rappels"] as const;
export type Sujet = (typeof SUJETS)[number];

export const SUJET_LIBELLES: Record<Sujet, string> = {
  beneficiaires: "Bénéficiaires suivis",
  interactions: "Interactions (appels, visites…)",
  appels_campagne: "Appels de campagne",
  inscriptions: "Inscriptions en ligne",
  rappels: "Rappels",
};

/** Unité affichée sous le grand nombre : [singulier, pluriel]. */
export const SUJET_UNITES: Record<Sujet, [string, string]> = {
  beneficiaires: ["personne", "personnes"],
  interactions: ["interaction", "interactions"],
  appels_campagne: ["appel", "appels"],
  inscriptions: ["inscription", "inscriptions"],
  rappels: ["rappel", "rappels"],
};

/** Date sur laquelle porte le filtre de période et le découpage par mois. */
export const SUJET_DATE_LIBELLES: Record<Sujet, string> = {
  beneficiaires: "date d'inscription au registre",
  interactions: "date de l'interaction",
  appels_campagne: "jour d'appel",
  inscriptions: "date de dépôt du formulaire",
  rappels: "date d'échéance",
};

/** Sujets dont chaque ligne est rattachée à une personne (filtres « personne » et liste nominative possibles). */
export const SUJETS_PERSONNE: readonly Sujet[] = ["beneficiaires", "interactions", "appels_campagne"];
export const estSujetPersonne = (s: Sujet) => SUJETS_PERSONNE.includes(s);

// ─── Regroupements métier ─────────────────────────────────────────────────────

/** « Forte difficulté de mobilité » = déambulateur, fauteuil ou immobilisé(e). */
export const GROUPES_MOBILITE = {
  forte_difficulte: ["deambulateur", "fauteuil", "immobilise"],
  difficulte: ["canne", "deambulateur", "fauteuil", "immobilise"],
} as const satisfies Record<string, readonly Deplacement[]>;

export const GROUPE_MOBILITE_LIBELLES: Record<keyof typeof GROUPES_MOBILITE, string> = {
  forte_difficulte: "Forte difficulté (déambulateur, fauteuil, immobilisé)",
  difficulte: "Toute difficulté (dès la canne)",
};

/** Statuts d'appel regroupés pour la lecture d'un bilan de campagne. */
export const GROUPES_STATUT_APPEL = {
  joint: ["joint_ras", "joint_besoin"],
  non_joint: ["non_joint", "messagerie", "numero_invalide", "non_joint_a_traiter"],
  couvert: ["couvert_proche", "couvert_passage"],
  absent: ["absent"],
  urgence: ["escalade_humain", "danger", "evacuation"],
  en_attente: ["a_appeler", "en_cours"],
} as const satisfies Record<string, readonly StatutCible[]>;
export type GroupeStatutAppel = keyof typeof GROUPES_STATUT_APPEL;

export const GROUPE_STATUT_APPEL_LIBELLES: Record<GroupeStatutAppel, string> = {
  joint: "Joint",
  non_joint: "Non joint",
  couvert: "Couvert (proche ou passage)",
  absent: "Absent du domicile",
  urgence: "Escaladé ou danger",
  en_attente: "Pas encore appelé",
};

export function groupeDuStatut(statut: string): GroupeStatutAppel | null {
  for (const [groupe, statuts] of Object.entries(GROUPES_STATUT_APPEL)) {
    if ((statuts as readonly string[]).includes(statut)) return groupe as GroupeStatutAppel;
  }
  return null;
}

export const ETATS_RAPPEL = ["fait", "en_retard", "a_venir"] as const;
export const ETAT_RAPPEL_LIBELLES: Record<(typeof ETATS_RAPPEL)[number], string> = {
  fait: "Traité",
  en_retard: "En retard",
  a_venir: "À venir",
};

export const TYPE_RAPPEL_LIBELLES: Record<TypeRappel, string> = {
  manuel: "Rappel manuel",
  anniversaire: "Anniversaire",
  retour_absence: "Retour d'absence",
  suivi: "Suivi",
  frequence: "Contact régulier",
  verification: "Vérification annuelle",
  besoin: "Besoin signalé",
  visite_urgente: "Visite urgente",
};

export const STATUTS_INSCRIPTION = ["en_attente", "validee", "rejetee"] as const;
export const STATUT_INSCRIPTION_LIBELLES: Record<(typeof STATUTS_INSCRIPTION)[number], string> = {
  en_attente: "En attente",
  validee: "Validée",
  rejetee: "Rejetée",
};

export const CANAL_APPEL_LIBELLES = { humain: "Humain", ia: "Agent vocal IA" } as const;

// ─── Filtres ──────────────────────────────────────────────────────────────────

export type Option = { valeur: string; libelle: string };
const options = <T extends string>(valeurs: readonly T[], libelles: Record<T, string>): Option[] =>
  valeurs.map((valeur) => ({ valeur, libelle: libelles[valeur] }));

export type TypeChamp = "choix" | "nombre" | "oui_non";

export const OPERATEURS = ["est", "n_est_pas", "sup_egal", "inf_egal", "egal"] as const;
export type Operateur = (typeof OPERATEURS)[number];
/** Libellé dans la liste déroulante, et symbole dans le résumé (« Âge ≥ 80 »). */
export const OPERATEUR_LIBELLES: Record<Operateur, { liste: string; symbole: string }> = {
  est: { liste: "est", symbole: "=" },
  n_est_pas: { liste: "n'est pas", symbole: "≠" },
  sup_egal: { liste: "au moins", symbole: "≥" },
  inf_egal: { liste: "au plus", symbole: "≤" },
  egal: { liste: "exactement", symbole: "=" },
};

export type DefinitionChamp = {
  libelle: string;
  type: TypeChamp;
  sujets: readonly Sujet[];
  operateurs: readonly Operateur[];
  /** Options fixes ; "quartiers" / "campagnes" = référentiel de la commune. */
  options?: Option[] | "quartiers" | "campagnes";
  unite?: string;
  /** Valeur proposée à l'ajout du filtre. */
  defaut?: string;
  min?: number;
  max?: number;
};

const PERSONNE: readonly Sujet[] = SUJETS_PERSONNE;
const CHOIX = ["est", "n_est_pas"] as const;

const CHAMPS_LITTERAUX = {
  sexe: { libelle: "Sexe", type: "choix", sujets: PERSONNE, operateurs: CHOIX, options: options(SEXES, SEXE_LIBELLES) },
  age: { libelle: "Âge", type: "nombre", sujets: PERSONNE, operateurs: ["sup_egal", "inf_egal", "egal"], unite: "ans", defaut: "80", min: 0, max: 120 },
  prise_en_charge: {
    libelle: "Prise en charge",
    type: "choix",
    sujets: PERSONNE,
    operateurs: CHOIX,
    options: options(TYPES_PRISE_EN_CHARGE, PRISE_EN_CHARGE_LIBELLES),
  },
  mobilite: {
    libelle: "Mobilité",
    type: "choix",
    sujets: PERSONNE,
    operateurs: CHOIX,
    options: [
      ...options(["forte_difficulte", "difficulte"] as const, GROUPE_MOBILITE_LIBELLES),
      ...options(DEPLACEMENTS, DEPLACEMENT_LIBELLES),
    ],
  },
  mode_de_vie: { libelle: "Mode de vie", type: "choix", sujets: PERSONNE, operateurs: CHOIX, options: options(MODES_DE_VIE, MODE_DE_VIE_LIBELLES) },
  quartier: { libelle: "Quartier", type: "choix", sujets: PERSONNE, operateurs: CHOIX, options: "quartiers" },
  gir: {
    libelle: "GIR",
    type: "choix",
    sujets: PERSONNE,
    operateurs: CHOIX,
    options: ["1", "2", "3", "4", "5", "6"].map((g) => ({ valeur: g, libelle: `GIR ${g}` })),
  },
  priorite: {
    libelle: "Niveau de priorité",
    type: "choix",
    sujets: PERSONNE,
    operateurs: CHOIX,
    options: NIVEAUX_PRIORITE.map((p) => ({ valeur: p, libelle: p })),
  },
  categorie: { libelle: "Public", type: "choix", sujets: PERSONNE, operateurs: CHOIX, options: options(CATEGORIES, CATEGORIE_LIBELLES) },
  troubles_cognitifs: { libelle: "Troubles cognitifs", type: "oui_non", sujets: PERSONNE, operateurs: ["est"] },
  sans_telephone: { libelle: "Sans téléphone", type: "oui_non", sujets: PERSONNE, operateurs: ["est"] },
  teleassistance: { libelle: "Téléalarme", type: "oui_non", sujets: PERSONNE, operateurs: ["est"] },
  adresse_a_verifier: { libelle: "Adresse à vérifier", type: "oui_non", sujets: PERSONNE, operateurs: ["est"] },
  mois_depuis_verification: {
    libelle: "Fiche non vérifiée depuis",
    type: "nombre",
    sujets: PERSONNE,
    operateurs: ["sup_egal", "inf_egal"],
    unite: "mois",
    defaut: "12",
    min: 0,
    max: 240,
  },
  mois_sans_contact: {
    libelle: "Sans contact depuis",
    type: "nombre",
    sujets: ["beneficiaires"],
    operateurs: ["sup_egal"],
    unite: "mois",
    defaut: "6",
    min: 1,
    max: 120,
  },
  type_interaction: {
    libelle: "Type d'interaction",
    type: "choix",
    sujets: ["interactions"],
    operateurs: CHOIX,
    options: options(TYPES_INTERACTION, INTERACTION_LIBELLES),
  },
  campagne: { libelle: "Campagne", type: "choix", sujets: ["appels_campagne"], operateurs: ["est"], options: "campagnes" },
  statut_appel: {
    libelle: "Résultat de l'appel",
    type: "choix",
    sujets: ["appels_campagne"],
    operateurs: CHOIX,
    options: [
      ...options(Object.keys(GROUPES_STATUT_APPEL) as GroupeStatutAppel[], GROUPE_STATUT_APPEL_LIBELLES),
      ...options(STATUTS_CIBLE, STATUT_CIBLE_LIBELLES),
    ],
  },
  canal: {
    libelle: "Appel passé par",
    type: "choix",
    sujets: ["appels_campagne"],
    operateurs: ["est"],
    options: options(["humain", "ia"] as const, CANAL_APPEL_LIBELLES),
  },
  besoin: { libelle: "Besoin détecté", type: "choix", sujets: ["appels_campagne"], operateurs: CHOIX, options: options(BESOINS, BESOIN_LIBELLES) },
  statut_inscription: {
    libelle: "Statut de l'inscription",
    type: "choix",
    sujets: ["inscriptions"],
    operateurs: CHOIX,
    options: options(STATUTS_INSCRIPTION, STATUT_INSCRIPTION_LIBELLES),
  },
  etat_rappel: { libelle: "État du rappel", type: "choix", sujets: ["rappels"], operateurs: CHOIX, options: options(ETATS_RAPPEL, ETAT_RAPPEL_LIBELLES) },
  type_rappel: { libelle: "Type de rappel", type: "choix", sujets: ["rappels"], operateurs: CHOIX, options: options(TYPES_RAPPEL, TYPE_RAPPEL_LIBELLES) },
} as const satisfies Record<string, DefinitionChamp>;

export type ChampId = keyof typeof CHAMPS_LITTERAUX;
export const CHAMPS: Record<ChampId, DefinitionChamp> = CHAMPS_LITTERAUX;
export const CHAMP_IDS = Object.keys(CHAMPS) as ChampId[];
export const champ = (id: ChampId): DefinitionChamp => CHAMPS[id];
export const champsPour = (sujet: Sujet): ChampId[] => CHAMP_IDS.filter((id) => CHAMPS[id].sujets.includes(sujet));

/** Développe une valeur de mobilité (éventuellement un regroupement) en modes de déplacement. */
export function developperMobilite(valeur: string): Deplacement[] {
  if (valeur in GROUPES_MOBILITE) return [...GROUPES_MOBILITE[valeur as keyof typeof GROUPES_MOBILITE]];
  return (DEPLACEMENTS as readonly string[]).includes(valeur) ? [valeur as Deplacement] : [];
}

/** Développe une valeur de résultat d'appel (éventuellement un regroupement) en statuts. */
export function developperStatutAppel(valeur: string): StatutCible[] {
  if (valeur in GROUPES_STATUT_APPEL) return [...GROUPES_STATUT_APPEL[valeur as GroupeStatutAppel]];
  return (STATUTS_CIBLE as readonly string[]).includes(valeur) ? [valeur as StatutCible] : [];
}

// ─── Découpages ───────────────────────────────────────────────────────────────

export type DefinitionDecoupage = {
  libelle: string;
  sujets: readonly Sujet[];
  /** Découpage dans le temps (courbe). */
  temporel?: boolean;
  /** Une même unité peut tomber dans plusieurs catégories (la somme dépasse le total). */
  multiValeur?: boolean;
  /** Ordre naturel des catégories (sinon : effectif décroissant). */
  ordonne?: boolean;
  /** Découpage géographique (carte possible). */
  geographique?: boolean;
};

const TOUS: readonly Sujet[] = SUJETS;

const DECOUPAGES_LITTERAUX = {
  tranche_age: { libelle: "Tranche d'âge", sujets: PERSONNE, ordonne: true },
  sexe: { libelle: "Sexe", sujets: PERSONNE },
  quartier: { libelle: "Quartier", sujets: PERSONNE, geographique: true },
  gir: { libelle: "GIR", sujets: PERSONNE, ordonne: true },
  priorite: { libelle: "Niveau de priorité", sujets: PERSONNE, ordonne: true },
  mode_de_vie: { libelle: "Mode de vie", sujets: PERSONNE },
  mobilite: { libelle: "Mobilité", sujets: PERSONNE, ordonne: true },
  prise_en_charge: { libelle: "Prise en charge", sujets: PERSONNE, multiValeur: true },
  mois: { libelle: "Mois", sujets: TOUS, temporel: true, ordonne: true },
  jour: { libelle: "Jour", sujets: ["appels_campagne"], temporel: true, ordonne: true },
  type_interaction: { libelle: "Type d'interaction", sujets: ["interactions"] },
  statut_appel: { libelle: "Résultat de l'appel", sujets: ["appels_campagne"], ordonne: true },
  canal: { libelle: "Humain ou IA", sujets: ["appels_campagne"] },
  besoin: { libelle: "Besoin détecté", sujets: ["appels_campagne"], multiValeur: true },
  campagne: { libelle: "Campagne", sujets: ["appels_campagne"] },
  statut_inscription: { libelle: "Statut de l'inscription", sujets: ["inscriptions"], ordonne: true },
  etat_rappel: { libelle: "État du rappel", sujets: ["rappels"], ordonne: true },
  type_rappel: { libelle: "Type de rappel", sujets: ["rappels"] },
} as const satisfies Record<string, DefinitionDecoupage>;

export type DecoupageId = keyof typeof DECOUPAGES_LITTERAUX;
export const DECOUPAGES: Record<DecoupageId, DefinitionDecoupage> = DECOUPAGES_LITTERAUX;
export const DECOUPAGE_IDS = Object.keys(DECOUPAGES) as DecoupageId[];
export const decoupage = (id: DecoupageId): DefinitionDecoupage => DECOUPAGES[id];
export const decoupagesPour = (sujet: Sujet): DecoupageId[] => DECOUPAGE_IDS.filter((id) => DECOUPAGES[id].sujets.includes(sujet));

export const TRANCHES_AGE = [
  { cle: "moins_60", libelle: "Moins de 60 ans", min: 0, max: 59 },
  { cle: "60_69", libelle: "60 à 69 ans", min: 60, max: 69 },
  { cle: "70_79", libelle: "70 à 79 ans", min: 70, max: 79 },
  { cle: "80_89", libelle: "80 à 89 ans", min: 80, max: 89 },
  { cle: "90_plus", libelle: "90 ans et plus", min: 90, max: Infinity },
] as const;

export function trancheAge(age: number) {
  return TRANCHES_AGE.find((t) => age >= t.min && age <= t.max) ?? TRANCHES_AGE[0];
}

// ─── Graphiques ───────────────────────────────────────────────────────────────

export const TYPES_GRAPHIQUE = ["barres", "camembert", "courbe", "carte"] as const;
export type TypeGraphique = (typeof TYPES_GRAPHIQUE)[number];
export const GRAPHIQUE_LIBELLES: Record<TypeGraphique, string> = {
  barres: "Barres",
  camembert: "Camembert",
  courbe: "Courbe",
  carte: "Carte",
};
/** Un camembert n'est lisible qu'avec 5 catégories au plus. */
export const MAX_PARTS_CAMEMBERT = 5;
