/**
 * Schéma PostgreSQL (Drizzle) — modèle de données §4 des specs.
 * Multi-tenant : chaque table métier porte `commune_id` (1 commune = 1 CCAS = 1 espace isolé).
 * Les valeurs énumérées sont stockées en texte et typées via `$type<>()` (cf. shared/domain/vocabulaire).
 */
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  Besoin,
  CaisseRetraite,
  Canal,
  Categorie,
  Civilite,
  Couverture,
  Deplacement,
  Frequence,
  ModeDeVie,
  MotifArchivage,
  NiveauAlerte,
  NiveauPriorite,
  NiveauRisque,
  OrigineInscription,
  PreferenceContact,
  Protection,
  Relation,
  Role,
  Sexe,
  StatutCible,
  StatutFiche,
  TypeAlerte,
  TypeCampagne,
  TypeIndisponibilite,
  TypeInteraction,
  TypeLogement,
  TypePriseEnCharge,
  TypeRappel,
  TypeStructure,
} from "@/shared/domain/vocabulaire";
import type { GrilleScore } from "@/shared/domain/priorite";
import type { ParametresRelance } from "@/shared/domain/campagne";

const id = () => uuid("id").primaryKey().defaultRandom();
const communeId = () => uuid("commune_id").notNull().references(() => communes.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ─── Tenant & utilisateurs ────────────────────────────────────────────────────

export type ParametresCommune = {
  grilleScore: GrilleScore;
};

export const communes = pgTable("communes", {
  id: id(),
  nom: text("nom").notNull(),
  codePostal: text("code_postal").notNull(),
  codeInsee: text("code_insee").notNull(),
  structureNom: text("structure_nom").notNull(),
  structureTelephone: text("structure_telephone").notNull(),
  centre: jsonb("centre").$type<{ lat: number; lon: number }>().notNull(),
  parametres: jsonb("parametres").$type<ParametresCommune>().notNull(),
  createdAt: createdAt(),
});

export const utilisateurs = pgTable("utilisateurs", {
  id: id(),
  communeId: uuid("commune_id").references(() => communes.id, { onDelete: "cascade" }),
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  email: text("email").notNull(),
  telephone: text("telephone"),
  role: text("role").$type<Role>().notNull(),
  actif: boolean("actif").notNull().default(true),
  /** E10-US2 : engagement de confidentialité horodaté (bénévoles). */
  confidentialiteAccepteeAt: timestamp("confidentialite_acceptee_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ─── Référentiels ─────────────────────────────────────────────────────────────

export const quartiers = pgTable("quartiers", {
  id: id(),
  communeId: communeId(),
  nom: text("nom").notNull(),
  /** Polygone [lon, lat][] (référentiel paramétrable, E8-US3). */
  contour: jsonb("contour").$type<[number, number][]>().notNull(),
});

export const tags = pgTable("tags", {
  id: id(),
  communeId: communeId(),
  libelle: text("libelle").notNull(),
});

export const structures = pgTable("structures", {
  id: id(),
  communeId: communeId(),
  nom: text("nom").notNull(),
  type: text("type").$type<TypeStructure>().notNull(),
  telephone: text("telephone"),
});

/** Voies et adresses BAN de la commune (autocomplétion locale et filtres rue/numéros). */
export const adresses = pgTable(
  "adresses",
  {
    id: text("id").primaryKey(), // identifiant BAN
    communeId: communeId(),
    numero: integer("numero").notNull(),
    rep: text("rep"),
    voie: text("voie").notNull(),
    lon: doublePrecision("lon").notNull(),
    lat: doublePrecision("lat").notNull(),
  },
  (t) => [index("adresses_voie_idx").on(t.communeId, t.voie)],
);

// ─── Foyer & bénéficiaire ─────────────────────────────────────────────────────

export const foyers = pgTable(
  "foyers",
  {
    id: id(),
    communeId: communeId(),
    banId: text("ban_id"),
    numero: integer("numero"),
    rep: text("rep"),
    voie: text("voie").notNull(),
    residence: text("residence"),
    batiment: text("batiment"),
    entree: text("entree"),
    appartement: text("appartement"),
    etage: integer("etage"),
    ascenseur: boolean("ascenseur"),
    codeAcces: text("code_acces"),
    codePostal: text("code_postal").notNull(),
    ville: text("ville").notNull(),
    lon: doublePrecision("lon"),
    lat: doublePrecision("lat"),
    quartier: text("quartier"),
    adresseAVerifier: boolean("adresse_a_verifier").notNull().default(false),
    typeLogement: text("type_logement").$type<TypeLogement>(),
    sousLesToits: boolean("sous_les_toits").notNull().default(false),
    pieceFraiche: boolean("piece_fraiche"),
    animaux: text("animaux"),
    createdAt: createdAt(),
  },
  (t) => [index("foyers_commune_voie_idx").on(t.communeId, t.voie)],
);

export const beneficiaires = pgTable(
  "beneficiaires",
  {
    id: id(),
    communeId: communeId(),
    foyerId: uuid("foyer_id").notNull().references(() => foyers.id),
    // Identité
    civilite: text("civilite").$type<Civilite>().notNull(),
    nom: text("nom").notNull(),
    nomNaissance: text("nom_naissance"),
    prenom: text("prenom").notNull(),
    sexe: text("sexe").$type<Sexe>().notNull(),
    dateNaissance: date("date_naissance").notNull(),
    // Coordonnées
    telephoneFixe: text("telephone_fixe"),
    telephoneMobile: text("telephone_mobile"),
    pasDeTelephone: boolean("pas_de_telephone").notNull().default(false),
    email: text("email"),
    langue: text("langue").notNull().default("Français"),
    preferenceContact: text("preference_contact").$type<PreferenceContact>(),
    creneauxAppel: text("creneaux_appel"),
    // Situation
    modeDeVie: text("mode_de_vie").$type<ModeDeVie>(),
    categorie: text("categorie").$type<Categorie>().notNull().default("senior"),
    protection: text("protection").$type<Protection>().notNull().default("non"),
    mandataireStructure: text("mandataire_structure"),
    mandataireTelephone: text("mandataire_telephone"),
    // Autonomie & santé (données sensibles)
    gir: integer("gir"),
    deplacement: text("deplacement").$type<Deplacement>(),
    troublesAuditifs: boolean("troubles_auditifs").notNull().default(false),
    troublesVisuels: boolean("troubles_visuels").notNull().default(false),
    troublesCognitifs: boolean("troubles_cognitifs").notNull().default(false),
    handicap: text("handicap"),
    appareillage: text("appareillage").array().notNull().default([]),
    teleassistance: boolean("teleassistance").notNull().default(false),
    teleassistanceFournisseur: text("teleassistance_fournisseur"),
    medecinTraitant: text("medecin_traitant"),
    // Aides et droits (décret n° 2026-590) — l'APA et la PCH sont des prises en charge
    caisseRetraite: text("caisse_retraite").$type<CaisseRetraite>(),
    aideCaisseRetraite: boolean("aide_caisse_retraite").notNull().default(false),
    origineInscription: text("origine_inscription").$type<OrigineInscription>().notNull().default("demande"),
    // Habitudes
    habitudes: text("habitudes"),
    centresInteret: text("centres_interet"),
    tags: text("tags").array().notNull().default([]),
    /** E5-US4 : bandeau d'informations prioritaires, visible aussi du bénévole. */
    infoPrioritaire: text("info_prioritaire"),
    // Dates clés
    dateInscription: date("date_inscription").notNull(),
    retourHospitalisationLe: date("retour_hospitalisation_le"),
    frequenceContactJours: integer("frequence_contact_jours"),
    // Consentements
    consentementRegistre: boolean("consentement_registre").notNull().default(true),
    personneInformee: boolean("personne_informee").notNull().default(true),
    consentementIa: boolean("consentement_ia").notNull().default(false),
    consentementPartage: boolean("consentement_partage").notNull().default(false),
    consentementDate: date("consentement_date"),
    consentementCanal: text("consentement_canal"),
    iaActivee: boolean("ia_activee").notNull().default(false),
    // Statut & priorité (RG-01)
    statut: text("statut").$type<StatutFiche>().notNull().default("active"),
    motifArchivage: text("motif_archivage").$type<MotifArchivage>(),
    motifStatut: text("motif_statut"),
    score: integer("score").notNull().default(0),
    niveauPriorite: text("niveau_priorite").$type<NiveauPriorite>().notNull().default("P3"),
    niveauForce: text("niveau_force").$type<NiveauPriorite>(),
    niveauForceJustification: text("niveau_force_justification"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("beneficiaires_commune_statut_idx").on(t.communeId, t.statut),
    index("beneficiaires_foyer_idx").on(t.foyerId),
  ],
);

/** E1-US3 : historique des modifications. */
export const historiqueModifications = pgTable("historique_modifications", {
  id: id(),
  beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
  auteurId: uuid("auteur_id").references(() => utilisateurs.id),
  champ: text("champ").notNull(),
  ancienneValeur: text("ancienne_valeur"),
  nouvelleValeur: text("nouvelle_valeur"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Cercle (E2) ──────────────────────────────────────────────────────────────

/** Contact partageable entre plusieurs bénéficiaires (E2-US2). */
export const contacts = pgTable("contacts", {
  id: id(),
  communeId: communeId(),
  prenom: text("prenom"),
  nom: text("nom").notNull(),
  structure: text("structure"),
  telephone: text("telephone"),
  telephone2: text("telephone_2"),
  email: text("email"),
  ville: text("ville"),
  disponibilites: text("disponibilites"),
  createdAt: createdAt(),
});

export const liensCercle = pgTable(
  "liens_cercle",
  {
    id: id(),
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    relation: text("relation").$type<Relation>().notNull(),
    rangAppel: integer("rang_appel").notNull(),
    possedeCles: boolean("possede_cles").notNull().default(false),
    estUrgence: boolean("est_urgence").notNull().default(false),
    estRepresentantLegal: boolean("est_representant_legal").notNull().default(false),
  },
  (t) => [index("liens_cercle_beneficiaire_idx").on(t.beneficiaireId)],
);

// ─── Prises en charge & passages (E6) ─────────────────────────────────────────

export const prisesEnCharge = pgTable(
  "prises_en_charge",
  {
    id: id(),
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    type: text("type").$type<TypePriseEnCharge>().notNull(),
    structureId: uuid("structure_id").references(() => structures.id),
    intervenantNom: text("intervenant_nom"),
    telephone: text("telephone"),
    possedeCles: boolean("possede_cles").notNull().default(false),
    dateDebut: date("date_debut"),
    dateFin: date("date_fin"),
    gir: integer("gir"),
    heuresParSemaine: doublePrecision("heures_par_semaine"),
    contactId: uuid("contact_id").references(() => contacts.id),
  },
  (t) => [index("pec_beneficiaire_idx").on(t.beneficiaireId)],
);

export const creneauxPassage = pgTable("creneaux_passage", {
  id: id(),
  priseEnChargeId: uuid("prise_en_charge_id").notNull().references(() => prisesEnCharge.id, { onDelete: "cascade" }),
  /** 1 = lundi … 7 = dimanche */
  joursSemaine: integer("jours_semaine").array().notNull(),
  heureDebut: text("heure_debut").notNull(), // "08:30"
  heureFin: text("heure_fin").notNull(),
  exceptions: date("exceptions").array().notNull().default([]),
});

// ─── Indisponibilités (E5) ────────────────────────────────────────────────────

export const indisponibilites = pgTable(
  "indisponibilites",
  {
    id: id(),
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    type: text("type").$type<TypeIndisponibilite>().notNull(),
    debut: date("debut").notNull(),
    fin: date("fin"), // null = jusqu'à nouvel ordre
    joignabilite: text("joignabilite"),
    source: text("source"),
    creePar: uuid("cree_par").references(() => utilisateurs.id),
    createdAt: createdAt(),
  },
  (t) => [index("indispo_beneficiaire_idx").on(t.beneficiaireId)],
);

// ─── Interactions (E3) & rappels (E4) ─────────────────────────────────────────

export type DetailIa = {
  transcription: { locuteur: "ia" | "personne"; texte: string }[];
  resume: string;
  reponses: Record<string, string>;
  risque: NiveauRisque;
  justification: string;
};

export const interactions = pgTable(
  "interactions",
  {
    id: id(),
    communeId: communeId(),
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    type: text("type").$type<TypeInteraction>().notNull(),
    survenueLe: timestamp("survenue_le", { withTimezone: true }).notNull().defaultNow(),
    dureeMinutes: integer("duree_minutes"),
    auteurId: uuid("auteur_id").references(() => utilisateurs.id),
    /** null = le bénéficiaire lui-même. */
    interlocuteurContactId: uuid("interlocuteur_contact_id").references(() => contacts.id),
    resultat: text("resultat").$type<StatutCible>(),
    compteRendu: text("compte_rendu"),
    besoins: text("besoins").array().$type<Besoin[]>().notNull().default([]),
    actionSuivi: text("action_suivi"),
    campagneId: uuid("campagne_id").references(() => campagnes.id, { onDelete: "set null" }),
    detailIa: jsonb("detail_ia").$type<DetailIa>(),
  },
  (t) => [index("interactions_beneficiaire_idx").on(t.beneficiaireId, t.survenueLe)],
);

export const rappels = pgTable(
  "rappels",
  {
    id: id(),
    communeId: communeId(),
    beneficiaireId: uuid("beneficiaire_id").references(() => beneficiaires.id, { onDelete: "cascade" }),
    type: text("type").$type<TypeRappel>().notNull(),
    objet: text("objet").notNull(),
    echeance: date("echeance").notNull(),
    assigneA: uuid("assigne_a").references(() => utilisateurs.id),
    creePar: uuid("cree_par").references(() => utilisateurs.id),
    urgent: boolean("urgent").notNull().default(false),
    faitLe: timestamp("fait_le", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("rappels_commune_echeance_idx").on(t.communeId, t.echeance)],
);

// ─── Inscriptions (E7) ────────────────────────────────────────────────────────

export const inscriptions = pgTable("inscriptions", {
  id: id(),
  communeId: communeId(),
  /** Réponses brutes du formulaire public (schéma Zod du module inscriptions). */
  reponses: jsonb("reponses").$type<Record<string, unknown>>().notNull(),
  soumisLe: timestamp("soumis_le", { withTimezone: true }).notNull().defaultNow(),
  statut: text("statut").$type<"en_attente" | "validee" | "rejetee">().notNull().default("en_attente"),
  motifRejet: text("motif_rejet"),
  beneficiaireIds: uuid("beneficiaire_ids").array().notNull().default([]),
  traiteePar: uuid("traitee_par").references(() => utilisateurs.id),
  traiteeLe: timestamp("traitee_le", { withTimezone: true }),
});

// ─── Listes (E8) ──────────────────────────────────────────────────────────────

export const listes = pgTable("listes", {
  id: id(),
  communeId: communeId(),
  nom: text("nom").notNull(),
  type: text("type").$type<"dynamique" | "figee">().notNull(),
  /** Filtre sérialisé (module registre). */
  filtre: jsonb("filtre").$type<Record<string, unknown>>().notNull(),
  beneficiaireIds: uuid("beneficiaire_ids").array().notNull().default([]),
  creePar: uuid("cree_par").references(() => utilisateurs.id),
  createdAt: createdAt(),
});

/** E8-US6 : assignation hors campagne (suivi courant). */
export const assignations = pgTable(
  "assignations",
  {
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    utilisateurId: uuid("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    assigneLe: timestamp("assigne_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.beneficiaireId, t.utilisateurId] })],
);

/** E8-US10 : vues sauvegardées par utilisateur. */
export const vuesSauvegardees = pgTable("vues_sauvegardees", {
  id: id(),
  utilisateurId: uuid("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
});

// ─── Alertes & campagnes (E9) ─────────────────────────────────────────────────

export const alertes = pgTable("alertes", {
  id: id(),
  communeId: communeId(),
  type: text("type").$type<TypeAlerte>().notNull(),
  niveau: text("niveau").$type<NiveauAlerte>().notNull(),
  debut: date("debut").notNull(),
  finPrevue: date("fin_prevue"),
  perimetre: text("perimetre").notNull().default("Toute la commune"),
  message: text("message"),
  statut: text("statut").$type<"active" | "cloturee">().notNull().default("active"),
  declencheePar: uuid("declenchee_par").references(() => utilisateurs.id),
  clotureeLe: timestamp("cloturee_le", { withTimezone: true }),
  createdAt: createdAt(),
});

export type QuestionScript = {
  id: string;
  texte: string;
  /** Réponse considérée comme préoccupante. */
  reponsePreoccupante: "oui" | "non";
  consigne?: string;
  besoin?: Besoin;
  tag?: string;
  statutPropose?: StatutCible;
  afficherEncart?: boolean;
};

export type ContenuScript = {
  introduction: string;
  questions: QuestionScript[];
  encart: { titre: string; items: string[] } | null;
  conclusion: string;
  boutonsSpecifiques: { libelle: string; consigne: string; statut: StatutCible }[];
  numerosUtiles: { libelle: string; numero: string }[];
};

export const scriptsAppel = pgTable("scripts_appel", {
  id: id(),
  communeId: communeId(),
  type: text("type").$type<TypeCampagne>().notNull(),
  nom: text("nom").notNull(),
  contenu: jsonb("contenu").$type<ContenuScript>().notNull(),
});

export const campagnes = pgTable("campagnes", {
  id: id(),
  communeId: communeId(),
  alerteId: uuid("alerte_id").references(() => alertes.id),
  nom: text("nom").notNull(),
  type: text("type").$type<TypeCampagne>().notNull(),
  /** Copie du script au lancement (éditable par campagne). */
  script: jsonb("script").$type<ContenuScript>().notNull(),
  frequence: text("frequence").$type<Frequence>().notNull().default("quotidienne"),
  frequenceJours: integer("frequence_jours"),
  canal: text("canal").$type<Canal>().notNull().default("humain"),
  relance: jsonb("relance").$type<ParametresRelance>().notNull(),
  source: jsonb("source").$type<{ type: "tous" | "liste" | "filtre"; listeId?: string; filtre?: Record<string, unknown> }>().notNull(),
  /** Snapshot figé des bénéficiaires (E9-US2). */
  beneficiaireIds: uuid("beneficiaire_ids").array().notNull().default([]),
  equipe: uuid("equipe").array().notNull().default([]),
  statut: text("statut").$type<"active" | "cloturee">().notNull().default("active"),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin"),
  createdAt: createdAt(),
});

/** Une ligne par bénéficiaire et par vague (jour) — E9-US4. */
export const ciblesCampagne = pgTable(
  "cibles_campagne",
  {
    id: id(),
    campagneId: uuid("campagne_id").notNull().references(() => campagnes.id, { onDelete: "cascade" }),
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    vagueDate: date("vague_date").notNull(),
    assigneA: uuid("assigne_a").references(() => utilisateurs.id),
    canal: text("canal").$type<"humain" | "ia">().notNull().default("humain"),
    statut: text("statut").$type<StatutCible>().notNull().default("a_appeler"),
    nbTentatives: integer("nb_tentatives").notNull().default(0),
    prochaineTentativeAt: timestamp("prochaine_tentative_at", { withTimezone: true }),
    verrouPar: uuid("verrou_par").references(() => utilisateurs.id),
    verrouAt: timestamp("verrou_at", { withTimezone: true }),
    couverture: text("couverture").$type<Couverture>(),
    /** RG-05 : exclusion automatique (motif visible), réintégrable en 1 clic. */
    exclue: boolean("exclue").notNull().default(false),
    motifExclusion: text("motif_exclusion"),
    niveauRisque: text("niveau_risque").$type<NiveauRisque>(),
    besoins: text("besoins").array().$type<Besoin[]>().notNull().default([]),
    reponses: jsonb("reponses").$type<Record<string, "oui" | "non">>(),
    note: text("note"),
    rangCercleEssaye: integer("rang_cercle_essaye").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cibles_campagne_vague_idx").on(t.campagneId, t.vagueDate),
    index("cibles_assigne_idx").on(t.assigneA, t.vagueDate),
  ],
);

// ─── Assistant ────────────────────────────────────────────────────────────────

/** Interprétation figée d'une question : la même question rejoue toujours le même appel d'outil. */
export const interpretationsAssistant = pgTable(
  "interpretations_assistant",
  {
    id: id(),
    communeId: communeId(),
    questionNormalisee: text("question_normalisee").notNull(),
    appel: jsonb("appel").$type<Record<string, unknown>>().notNull(),
    source: text("source").$type<"ia" | "analyseur">().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("interpretations_assistant_question_idx").on(t.communeId, t.questionNormalisee)],
);

// ─── Notifications (E14) & audit (E13) ────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    communeId: communeId(),
    destinataireId: uuid("destinataire_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    type: text("type").$type<"inscription" | "assignation" | "escalade" | "danger" | "rappel" | "info">().notNull(),
    titre: text("titre").notNull(),
    message: text("message"),
    lien: text("lien"),
    lue: boolean("lue").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_dest_idx").on(t.destinataireId, t.lue)],
);

export const journalAudit = pgTable("journal_audit", {
  id: id(),
  communeId: communeId(),
  utilisateurId: uuid("utilisateur_id").references(() => utilisateurs.id),
  action: text("action").notNull(),
  cible: text("cible"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/** E8-US7 : présence des utilisateurs sur une ressource (liste, campagne). */
export const presences = pgTable(
  "presences",
  {
    utilisateurId: uuid("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    ressource: text("ressource").notNull(),
    vuLe: timestamp("vu_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.utilisateurId, t.ressource] })],
);

// ─── Notes de fiche ───────────────────────────────────────────────────────────

/** E15-US3 : notes libres rattachées à une fiche (colonnes « fourre-tout » importées). */
export const notesFiche = pgTable(
  "notes_fiche",
  {
    id: id(),
    beneficiaireId: uuid("beneficiaire_id").notNull().references(() => beneficiaires.id, { onDelete: "cascade" }),
    texte: text("texte").notNull(),
    source: text("source").notNull().default("import"),
    auteurId: uuid("auteur_id").references(() => utilisateurs.id),
    createdAt: createdAt(),
  },
  (t) => [index("notes_fiche_beneficiaire_idx").on(t.beneficiaireId)],
);
