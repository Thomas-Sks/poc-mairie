/**
 * Vocabulaire métier partagé (valeurs stables stockées en base + libellés affichés).
 * Source : docs/SPECS.md (§1 rôles, E1, E2, E3, E5, E6, E9, RG-03).
 */

export const ROLES = ["super_admin", "admin", "agent", "benevole"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LIBELLES: Record<Role, string> = {
  super_admin: "Super-admin",
  admin: "Admin CCAS",
  agent: "Agent CCAS",
  benevole: "Bénévole",
};

export const STATUTS_FICHE = ["en_attente", "active", "suspendue", "archivee"] as const;
export type StatutFiche = (typeof STATUTS_FICHE)[number];
export const STATUT_FICHE_LIBELLES: Record<StatutFiche, string> = {
  en_attente: "En attente de validation",
  active: "Active",
  suspendue: "Suspendue",
  archivee: "Archivée",
};

export const MOTIFS_ARCHIVAGE = ["deces", "demenagement", "ehpad", "desinscription", "autre"] as const;
export type MotifArchivage = (typeof MOTIFS_ARCHIVAGE)[number];
export const MOTIF_ARCHIVAGE_LIBELLES: Record<MotifArchivage, string> = {
  deces: "Décès",
  demenagement: "Déménagement",
  ehpad: "Entrée en EHPAD",
  desinscription: "Désinscription volontaire",
  autre: "Autre",
};

export const CIVILITES = ["Mme", "M."] as const;
export type Civilite = (typeof CIVILITES)[number];

export const SEXES = ["F", "M"] as const;
export type Sexe = (typeof SEXES)[number];
export const SEXE_LIBELLES: Record<Sexe, string> = { F: "Femme", M: "Homme" };

export const MODES_DE_VIE = ["seul", "couple", "tiers"] as const;
export type ModeDeVie = (typeof MODES_DE_VIE)[number];
export const MODE_DE_VIE_LIBELLES: Record<ModeDeVie, string> = {
  seul: "Vit seul(e)",
  couple: "En couple",
  tiers: "Avec un tiers",
};

export const CATEGORIES = ["senior", "handicap"] as const;
export type Categorie = (typeof CATEGORIES)[number];
export const CATEGORIE_LIBELLES: Record<Categorie, string> = {
  senior: "60 ans et +",
  handicap: "Handicap, moins de 60 ans",
};

export const PROTECTIONS = ["non", "tutelle", "curatelle", "sauvegarde"] as const;
export type Protection = (typeof PROTECTIONS)[number];
export const PROTECTION_LIBELLES: Record<Protection, string> = {
  non: "Aucune",
  tutelle: "Tutelle",
  curatelle: "Curatelle",
  sauvegarde: "Sauvegarde de justice",
};

export const DEPLACEMENTS = ["seul", "canne", "deambulateur", "fauteuil", "immobilise"] as const;
export type Deplacement = (typeof DEPLACEMENTS)[number];
export const DEPLACEMENT_LIBELLES: Record<Deplacement, string> = {
  seul: "Seul(e)",
  canne: "Canne",
  deambulateur: "Déambulateur",
  fauteuil: "Fauteuil roulant",
  immobilise: "Immobilisé(e)",
};

export const TYPES_LOGEMENT = ["maison", "appartement"] as const;
export type TypeLogement = (typeof TYPES_LOGEMENT)[number];
export const TYPE_LOGEMENT_LIBELLES: Record<TypeLogement, string> = {
  maison: "Maison",
  appartement: "Appartement",
};

export const PREFERENCES_CONTACT = ["fixe", "mobile", "visite"] as const;
export type PreferenceContact = (typeof PREFERENCES_CONTACT)[number];
export const PREFERENCE_CONTACT_LIBELLES: Record<PreferenceContact, string> = {
  fixe: "Téléphone fixe",
  mobile: "Téléphone mobile",
  visite: "Visite",
};

/** E2-US1 : relations du cercle. */
export const RELATIONS = [
  "enfant",
  "conjoint",
  "famille",
  "voisin",
  "ami",
  "gardien",
  "infirmiere",
  "aide_domicile",
  "medecin",
  "tuteur",
  "autre",
] as const;
export type Relation = (typeof RELATIONS)[number];
export const RELATION_LIBELLES: Record<Relation, string> = {
  enfant: "Enfant",
  conjoint: "Conjoint(e)",
  famille: "Autre famille",
  voisin: "Voisin(e)",
  ami: "Ami(e)",
  gardien: "Gardien(ne)",
  infirmiere: "Infirmier(e)",
  aide_domicile: "Aide à domicile",
  medecin: "Médecin",
  tuteur: "Tuteur / curateur",
  autre: "Autre",
};

/** E2-US3 : famille de couleur du graphe. */
export const GROUPES_RELATION = ["famille", "voisinage", "sante", "aide", "institution"] as const;
export type GroupeRelation = (typeof GROUPES_RELATION)[number];
export const GROUPE_DE_RELATION: Record<Relation, GroupeRelation> = {
  enfant: "famille",
  conjoint: "famille",
  famille: "famille",
  voisin: "voisinage",
  ami: "voisinage",
  gardien: "voisinage",
  infirmiere: "sante",
  medecin: "sante",
  aide_domicile: "aide",
  tuteur: "institution",
  autre: "institution",
};

/** E6-US1 : types de prise en charge. */
export const TYPES_PRISE_EN_CHARGE = [
  "aide_domicile",
  "portage_repas",
  "soins_infirmiers",
  "teleassistance",
  "kine",
  "medecin_traitant",
  "apa",
  "pch",
  "ssiad",
  "accueil_jour",
  "autre",
] as const;
export type TypePriseEnCharge = (typeof TYPES_PRISE_EN_CHARGE)[number];
export const PRISE_EN_CHARGE_LIBELLES: Record<TypePriseEnCharge, string> = {
  aide_domicile: "Aide à domicile",
  portage_repas: "Portage de repas",
  soins_infirmiers: "Soins infirmiers",
  teleassistance: "Téléalarme",
  kine: "Kiné",
  medecin_traitant: "Médecin traitant",
  apa: "APA",
  pch: "PCH",
  ssiad: "SSIAD",
  accueil_jour: "Accueil de jour",
  autre: "Autre",
};

export const TYPES_STRUCTURE = ["saad", "ssiad", "cabinet_infirmier", "portage", "teleassistance", "autre"] as const;
export type TypeStructure = (typeof TYPES_STRUCTURE)[number];

/** E5-US1 */
export const TYPES_INDISPONIBILITE = ["vacances", "hospitalisation", "sejour_proche", "etablissement", "autre"] as const;
export type TypeIndisponibilite = (typeof TYPES_INDISPONIBILITE)[number];
export const INDISPONIBILITE_LIBELLES: Record<TypeIndisponibilite, string> = {
  vacances: "Vacances",
  hospitalisation: "Hospitalisation",
  sejour_proche: "Séjour chez un proche",
  etablissement: "Séjour en établissement temporaire",
  autre: "Autre",
};

/** E3-US1 */
export const TYPES_INTERACTION = [
  "appel_sortant",
  "appel_entrant",
  "visite",
  "sms",
  "email",
  "courrier",
  "appel_ia",
  "passage_intervenant",
] as const;
export type TypeInteraction = (typeof TYPES_INTERACTION)[number];
export const INTERACTION_LIBELLES: Record<TypeInteraction, string> = {
  appel_sortant: "Appel sortant",
  appel_entrant: "Appel entrant",
  visite: "Visite à domicile",
  sms: "SMS",
  email: "Email",
  courrier: "Courrier",
  appel_ia: "Appel IA",
  passage_intervenant: "Passage intervenant",
};

export const BESOINS = ["eau", "courses", "medicaments", "isolement", "chaleur", "chauffage", "chute", "visite", "logement", "autre"] as const;
export type Besoin = (typeof BESOINS)[number];
export const BESOIN_LIBELLES: Record<Besoin, string> = {
  eau: "Eau",
  courses: "Courses",
  medicaments: "Médicaments",
  isolement: "Isolement",
  chaleur: "Chaleur dans le logement",
  chauffage: "Chauffage",
  chute: "Chute",
  visite: "Visite",
  logement: "Logement",
  autre: "Autre",
};

/** E4 */
export const TYPES_RAPPEL = ["manuel", "anniversaire", "retour_absence", "suivi", "frequence", "verification", "besoin", "visite_urgente"] as const;
export type TypeRappel = (typeof TYPES_RAPPEL)[number];

/** E9-US1 */
export const TYPES_ALERTE = ["canicule", "grand_froid", "inondation", "tempete", "pollution", "epidemie", "autre"] as const;
export type TypeAlerte = (typeof TYPES_ALERTE)[number];
export const ALERTE_LIBELLES: Record<TypeAlerte, string> = {
  canicule: "Canicule",
  grand_froid: "Grand froid",
  inondation: "Inondation",
  tempete: "Tempête",
  pollution: "Pollution",
  epidemie: "Épidémie",
  autre: "Autre",
};
export const NIVEAUX_ALERTE = ["jaune", "orange", "rouge"] as const;
export type NiveauAlerte = (typeof NIVEAUX_ALERTE)[number];

export const TYPES_CAMPAGNE = [...TYPES_ALERTE, "verification", "convivialite"] as const;
export type TypeCampagne = (typeof TYPES_CAMPAGNE)[number];

export const CANAUX = ["humain", "ia", "mixte"] as const;
export type Canal = (typeof CANAUX)[number];

export const FREQUENCES = ["unique", "quotidienne", "tous_n_jours"] as const;
export type Frequence = (typeof FREQUENCES)[number];

/** RG-03 : statuts d'une cible de campagne. */
export const STATUTS_CIBLE = [
  "a_appeler",
  "en_cours",
  "joint_ras",
  "joint_besoin",
  "non_joint",
  "messagerie",
  "numero_invalide",
  "absent",
  "couvert_proche",
  "couvert_passage",
  "escalade_humain",
  "non_joint_a_traiter",
  "danger",
  "evacuation",
] as const;
export type StatutCible = (typeof STATUTS_CIBLE)[number];
export const STATUT_CIBLE_LIBELLES: Record<StatutCible, string> = {
  a_appeler: "À appeler",
  en_cours: "En cours",
  joint_ras: "Joint – RAS",
  joint_besoin: "Joint – besoin signalé",
  non_joint: "Non joint",
  messagerie: "Messagerie",
  numero_invalide: "Numéro invalide",
  absent: "Absent du domicile",
  couvert_proche: "Couvert par un proche",
  couvert_passage: "Couvert par passage intervenant",
  escalade_humain: "Escaladé – à rappeler par un humain",
  non_joint_a_traiter: "Non joint – à traiter",
  danger: "Danger – urgence",
  evacuation: "Besoin d'évacuation / de relogement",
};

export const COUVERTURES = ["passage", "absence", "appel", "proche"] as const;
export type Couverture = (typeof COUVERTURES)[number];

export const NIVEAUX_PRIORITE = ["P1", "P2", "P3"] as const;
export type NiveauPriorite = (typeof NIVEAUX_PRIORITE)[number];

export const NIVEAUX_RISQUE = ["vert", "orange", "rouge"] as const;
export type NiveauRisque = (typeof NIVEAUX_RISQUE)[number];

/** Ton visuel d'un statut : pilote la couleur des pastilles (DA : 1 accent + 3 états). */
export type Ton = "neutre" | "accent" | "ok" | "warn" | "err";
