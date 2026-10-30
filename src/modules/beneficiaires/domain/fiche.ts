/**
 * E1-US1 / E1-US3 — Modèle d'une fiche bénéficiaire telle qu'on la saisit, règles de saisie
 * et calcul des différences pour l'historique des modifications.
 */
import type { DateISO } from "@/shared/domain/dates";
import type {
  CaisseRetraite,
  Categorie,
  Civilite,
  Deplacement,
  ModeDeVie,
  NiveauPriorite,
  OrigineInscription,
  PreferenceContact,
  Protection,
  Sexe,
  TypeLogement,
} from "@/shared/domain/vocabulaire";

export type SaisieBeneficiaire = {
  civilite: Civilite;
  nom: string;
  nomNaissance: string | null;
  prenom: string;
  sexe: Sexe;
  dateNaissance: DateISO;
  telephoneFixe: string | null;
  telephoneMobile: string | null;
  pasDeTelephone: boolean;
  email: string | null;
  langue: string;
  preferenceContact: PreferenceContact | null;
  creneauxAppel: string | null;
  modeDeVie: ModeDeVie | null;
  categorie: Categorie;
  protection: Protection;
  mandataireStructure: string | null;
  mandataireTelephone: string | null;
  caisseRetraite: CaisseRetraite | null;
  aideCaisseRetraite: boolean;
  origineInscription: OrigineInscription;
  habitudes: string | null;
  centresInteret: string | null;
  tags: string[];
  infoPrioritaire: string | null;
  consentementRegistre: boolean;
  personneInformee: boolean;
  consentementIa: boolean;
  consentementPartage: boolean;
  consentementDate: DateISO | null;
  consentementCanal: string | null;
};

/** Données de santé : accès restreint (permission `fiches.sante`). */
export type SaisieSante = {
  gir: number | null;
  deplacement: Deplacement | null;
  troublesAuditifs: boolean;
  troublesVisuels: boolean;
  troublesCognitifs: boolean;
  handicap: string | null;
  appareillage: string[];
  teleassistance: boolean;
  teleassistanceFournisseur: string | null;
  medecinTraitant: string | null;
};

export type SaisieFoyer = {
  banId: string | null;
  numero: number | null;
  rep: string | null;
  voie: string;
  lon: number | null;
  lat: number | null;
  residence: string | null;
  batiment: string | null;
  entree: string | null;
  appartement: string | null;
  etage: number | null;
  ascenseur: boolean | null;
  codeAcces: string | null;
  typeLogement: TypeLogement | null;
  sousLesToits: boolean;
  pieceFraiche: boolean | null;
  animaux: string | null;
};

export type SaisieFiche = {
  beneficiaire: SaisieBeneficiaire;
  /** null quand l'utilisateur n'a pas accès aux données de santé (elles ne sont alors pas modifiées). */
  sante: SaisieSante | null;
  foyer: SaisieFoyer;
};

export const SANTE_VIDE: SaisieSante = {
  gir: null,
  deplacement: null,
  troublesAuditifs: false,
  troublesVisuels: false,
  troublesCognitifs: false,
  handicap: null,
  appareillage: [],
  teleassistance: false,
  teleassistanceFournisseur: null,
  medecinTraitant: null,
};

// ─── Règles de saisie ────────────────────────────────────────────────────────

export type ErreursSaisie = Partial<Record<string, string>>;

/**
 * Champs obligatoires (E1-US1) : nom, prénom, date de naissance, adresse,
 * au moins un téléphone OU la mention « pas de téléphone ».
 */
export function verifierChampsObligatoires(saisie: SaisieFiche, aujourdhui: DateISO): ErreursSaisie {
  const erreurs: ErreursSaisie = {};
  const b = saisie.beneficiaire;
  if (!b.nom.trim()) erreurs.nom = "Indiquez le nom.";
  if (!b.prenom.trim()) erreurs.prenom = "Indiquez le prénom.";
  if (!b.dateNaissance) erreurs.dateNaissance = "Indiquez la date de naissance.";
  else if (b.dateNaissance > aujourdhui) erreurs.dateNaissance = "La date de naissance ne peut pas être dans le futur.";
  if (!saisie.foyer.voie.trim()) erreurs.adresse = "Indiquez l'adresse.";
  if (!b.pasDeTelephone && !b.telephoneFixe && !b.telephoneMobile) {
    erreurs.telephone = "Indiquez au moins un téléphone, ou cochez « Pas de téléphone ».";
  }
  if (b.protection !== "non" && !b.mandataireStructure?.trim()) {
    erreurs.mandataireStructure = "Indiquez la structure du mandataire.";
  }
  return erreurs;
}

/** Libellé postal court : « 12 bis rue du Marais ». */
export function libelleAdresse(foyer: Pick<SaisieFoyer, "numero" | "rep" | "voie">): string {
  const numero = foyer.numero !== null ? `${foyer.numero}${foyer.rep ? ` ${foyer.rep}` : ""} ` : "";
  return `${numero}${foyer.voie}`;
}

export function nomComplet(p: { civilite: Civilite; prenom: string; nom: string }): string {
  return `${p.civilite} ${p.prenom} ${p.nom.toUpperCase()}`;
}

/** Niveau de priorité retenu : le niveau forcé par un agent l'emporte sur le calcul (RG-01). */
export function niveauEffectif(calcule: NiveauPriorite, force: NiveauPriorite | null): NiveauPriorite {
  return force ?? calcule;
}

// ─── Historique des modifications (E1-US3) ───────────────────────────────────

export type Changement = { champ: string; ancienneValeur: string | null; nouvelleValeur: string | null };

export const LIBELLES_CHAMPS: Record<string, string> = {
  civilite: "Civilité",
  nom: "Nom",
  nomNaissance: "Nom de naissance",
  prenom: "Prénom",
  sexe: "Sexe",
  dateNaissance: "Date de naissance",
  telephoneFixe: "Téléphone fixe",
  telephoneMobile: "Téléphone mobile",
  pasDeTelephone: "Pas de téléphone",
  email: "Email",
  langue: "Langue parlée",
  preferenceContact: "Préférence de contact",
  creneauxAppel: "Créneaux d'appel préférés",
  modeDeVie: "Mode de vie",
  categorie: "Catégorie",
  protection: "Mesure de protection",
  mandataireStructure: "Structure du mandataire",
  mandataireTelephone: "Téléphone du mandataire",
  habitudes: "Habitudes",
  centresInteret: "Centres d'intérêt",
  tags: "Étiquettes",
  infoPrioritaire: "Informations prioritaires",
  consentementRegistre: "Consentement au registre",
  personneInformee: "Personne informée",
  consentementIa: "Consentement appel IA",
  consentementPartage: "Consentement partage intervenants",
  consentementDate: "Date du recueil du consentement",
  consentementCanal: "Canal du recueil",
  gir: "GIR",
  deplacement: "Déplacement dans le domicile",
  troublesAuditifs: "Troubles auditifs",
  troublesVisuels: "Troubles visuels",
  troublesCognitifs: "Troubles cognitifs",
  handicap: "Handicap",
  appareillage: "Appareillage",
  teleassistance: "Téléassistance",
  teleassistanceFournisseur: "Fournisseur de téléassistance",
  medecinTraitant: "Médecin traitant",
  banId: "Identifiant d'adresse",
  numero: "Numéro",
  rep: "Indice de répétition",
  voie: "Voie",
  lon: "Longitude",
  lat: "Latitude",
  residence: "Résidence",
  batiment: "Bâtiment",
  entree: "Entrée",
  appartement: "Appartement",
  etage: "Étage",
  ascenseur: "Ascenseur",
  codeAcces: "Code d'accès",
  typeLogement: "Type de logement",
  sousLesToits: "Logement sous les toits",
  pieceFraiche: "Pièce fraîche",
  animaux: "Animaux",
};

/** Champs techniques comparés mais non affichés dans l'historique. */
const CHAMPS_MASQUES = new Set(["banId", "lon", "lat"]);

export function formaterValeur(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur === "boolean") return valeur ? "Oui" : "Non";
  if (Array.isArray(valeur)) return valeur.length ? valeur.join(", ") : null;
  return String(valeur);
}

/** Liste des champs modifiés entre deux versions (libellés en français, valeurs formatées). */
export function comparer<T extends object>(avant: T, apres: T): Changement[] {
  const changements: Changement[] = [];
  for (const cle of Object.keys(apres) as (keyof T & string)[]) {
    if (CHAMPS_MASQUES.has(cle)) continue;
    const ancienne = formaterValeur(avant[cle]);
    const nouvelle = formaterValeur(apres[cle]);
    if (ancienne !== nouvelle) {
      changements.push({ champ: LIBELLES_CHAMPS[cle] ?? cle, ancienneValeur: ancienne, nouvelleValeur: nouvelle });
    }
  }
  return changements;
}

export function comparerFiches(avant: SaisieFiche, apres: SaisieFiche): Changement[] {
  return [
    ...comparer(avant.beneficiaire, apres.beneficiaire),
    ...(apres.sante && avant.sante ? comparer(avant.sante, apres.sante) : []),
    ...comparer(avant.foyer, apres.foyer),
  ];
}
