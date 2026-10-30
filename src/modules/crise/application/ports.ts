/**
 * Ports du module Crise (alertes, campagnes, tableau de bord). Implémentés dans `infrastructure/`.
 */
import type { Contexte } from "@/shared/application/contexte";
import type { ParametresRelance } from "@/shared/domain/campagne";
import type { DateISO } from "@/shared/domain/dates";
import type {
  Besoin,
  Canal,
  Couverture,
  Frequence,
  NiveauAlerte,
  NiveauPriorite,
  NiveauRisque,
  Role,
  StatutCible,
  TypeAlerte,
  TypeCampagne,
  TypeInteraction,
} from "@/shared/domain/vocabulaire";
import type { ContenuScript, DetailIa } from "@/shared/infrastructure/db/schema";
import type { BeneficiaireVague, CibleGeneree } from "../domain/vague";

/**
 * Sélection de bénéficiaires par filtre (fourni par le module Registre à la fusion :
 * `rechercherBeneficiaireIds(ctx, filtre)`). Le filtre est celui stocké dans `listes.filtre`
 * ou construit à la volée (clés connues de l'adaptateur provisoire : voie, numeroMin, numeroMax,
 * parite "pair" | "impair" | "tous", quartier). Ne renvoie que des fiches actives de la commune du contexte.
 */
export interface SelecteurBeneficiaires {
  rechercherBeneficiaireIds(ctx: Contexte, filtre: Record<string, unknown>): Promise<string[]>;
}

export type SourceCampagne = { type: "tous" | "liste" | "filtre"; listeId?: string; filtre?: Record<string, unknown> };

export type Alerte = {
  id: string;
  type: TypeAlerte;
  niveau: NiveauAlerte;
  debut: DateISO;
  finPrevue: DateISO | null;
  perimetre: string;
  message: string | null;
  statut: "active" | "cloturee";
  clotureeLe: Date | null;
};

export type CampagneResume = {
  id: string;
  alerteId: string | null;
  nom: string;
  type: TypeCampagne;
  canal: Canal;
  frequence: Frequence;
  statut: "active" | "cloturee";
  dateDebut: DateISO;
  dateFin: DateISO | null;
  nbPersonnes: number;
};

export type Campagne = CampagneResume & {
  communeId: string;
  script: ContenuScript;
  frequenceJours: number | null;
  relance: ParametresRelance;
  source: SourceCampagne;
  beneficiaireIds: string[];
  equipe: string[];
  alerte: Alerte | null;
};

export type NouvelleCampagne = {
  alerteId: string | null;
  nom: string;
  type: TypeCampagne;
  script: ContenuScript;
  frequence: Frequence;
  frequenceJours: number | null;
  canal: Canal;
  relance: ParametresRelance;
  source: SourceCampagne;
  beneficiaireIds: string[];
  equipe: string[];
  dateDebut: DateISO;
  dateFin: DateISO | null;
};

export type Membre = { id: string; prenom: string; nom: string; role: Role; telephone: string | null };

export type CibleTableau = {
  id: string;
  beneficiaireId: string;
  rang: number;
  civilite: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  niveau: NiveauPriorite;
  score: number;
  adresse: string;
  lat: number | null;
  lon: number | null;
  canal: "humain" | "ia";
  statut: StatutCible;
  exclue: boolean;
  motifExclusion: string | null;
  couverture: Couverture | null;
  assigneA: string | null;
  nbTentatives: number;
  prochaineTentativeAt: Date | null;
  verrouPar: string | null;
  verrouAt: Date | null;
  niveauRisque: NiveauRisque | null;
  besoins: Besoin[];
  note: string | null;
  rangCercleEssaye: number;
  /** Dernier appel IA (maquette) de la cible pour cette vague. */
  appelIaId: string | null;
};

export type CibleAppel = {
  id: string;
  campagneId: string;
  communeId: string;
  campagneStatut: "active" | "cloturee";
  campagneNom: string;
  relance: ParametresRelance;
  beneficiaireId: string;
  beneficiaireNom: string;
  vagueDate: DateISO;
  statut: StatutCible;
  nbTentatives: number;
  prochaineTentativeAt: Date | null;
  rangCercleEssaye: number;
  assigneA: string | null;
  verrouPar: string | null;
  verrouAt: Date | null;
  besoins: Besoin[];
  nbContactsCercle: number;
};

export type ContactCercle = { id: string; rang: number; relation: string; nom: string; telephone: string | null; possedeCles: boolean };

export type FicheAppel = {
  beneficiaireId: string;
  civilite: string;
  nom: string;
  prenom: string;
  telephoneFixe: string | null;
  telephoneMobile: string | null;
  adresse: string;
  infoPrioritaire: string | null;
  cercle: ContactCercle[];
};

export type NoteAlerte = { auteur: string; at: Date; texte: string };

export type MiseAJourCible = Partial<{
  statut: StatutCible;
  nbTentatives: number;
  prochaineTentativeAt: Date | null;
  rangCercleEssaye: number;
  couverture: Couverture | null;
  besoins: Besoin[];
  reponses: Record<string, "oui" | "non"> | null;
  note: string | null;
  exclue: boolean;
  verrouPar: string | null;
  verrouAt: Date | null;
}>;

export type NouvelleInteraction = {
  beneficiaireId: string;
  campagneId: string;
  type: TypeInteraction;
  survenueLe: Date;
  auteurId: string | null;
  interlocuteurContactId: string | null;
  resultat: StatutCible;
  compteRendu: string | null;
  besoins: Besoin[];
  dureeMinutes: number | null;
  detailIa?: DetailIa | null;
};

/**
 * Notification in-app (E14-US1) : fournie par le module Notifications (`notifier`).
 * Destinataires nommés et/ou tous les membres actifs de certains rôles de la commune du contexte.
 */
export type Notifieur = (
  ctx: Contexte,
  notification: {
    destinataires?: string[];
    roles?: Role[];
    type: "escalade" | "danger" | "assignation" | "info";
    titre: string;
    message?: string | null;
    lien?: string | null;
    exclureAuteur?: boolean;
  },
) => Promise<number>;

export type TypeRappelAppel = "besoin" | "verification";

export type InteractionRapport = {
  id: string;
  beneficiaireId: string;
  survenueLe: Date;
  type: TypeInteraction;
  resultat: StatutCible | null;
  compteRendu: string | null;
  auteur: string | null;
};

export type DonneesRapport = {
  campagne: Campagne;
  cibles: (CibleTableau & { vagueDate: DateISO })[];
  interactions: InteractionRapport[];
  rappelsCrees: number;
};

export type AppelIa = {
  interactionId: string;
  campagneId: string;
  campagneNom: string;
  beneficiaireId: string;
  beneficiaire: string;
  telephone: string | null;
  survenueLe: Date;
  dureeMinutes: number | null;
  resultat: StatutCible | null;
  detail: DetailIa;
};

export interface DepotCrise {
  // Alertes
  creerAlerte(communeId: string, alerte: Omit<Alerte, "id" | "statut" | "clotureeLe">, declencheePar: string): Promise<string>;
  obtenirAlerte(communeId: string, id: string): Promise<Alerte | null>;
  listerAlertes(communeId: string): Promise<(Alerte & { campagnes: CampagneResume[] })[]>;
  cloturerAlerte(communeId: string, id: string, at: Date, jour: DateISO): Promise<string[]>;

  // Préparation d'une campagne
  scriptParType(communeId: string, type: TypeCampagne): Promise<ContenuScript | null>;
  listerListes(communeId: string): Promise<{ id: string; nom: string; type: "dynamique" | "figee"; nb: number | null }[]>;
  obtenirListe(communeId: string, id: string): Promise<{ type: "dynamique" | "figee"; filtre: Record<string, unknown>; beneficiaireIds: string[] } | null>;
  idsBeneficiairesActifs(communeId: string, parmi?: string[]): Promise<string[]>;
  listerVoies(communeId: string): Promise<string[]>;
  listerQuartiers(communeId: string): Promise<string[]>;
  listerMembres(communeId: string, roles?: Role[]): Promise<Membre[]>;

  // Campagnes
  creerCampagne(communeId: string, campagne: NouvelleCampagne): Promise<string>;
  obtenirCampagne(communeId: string, id: string): Promise<Campagne | null>;
  listerVagues(campagneId: string): Promise<DateISO[]>;
  /**
   * Génère la vague du jour si elle n'existe pas (verrou transactionnel : une seule génération).
   * `construire` reçoit les faits d'exclusion de chaque bénéficiaire du snapshot et renvoie les cibles.
   * Renvoie les cibles créées (vide si la vague existait déjà).
   */
  genererVagueSiAbsente(
    campagne: Campagne,
    jour: DateISO,
    construire: (beneficiaires: BeneficiaireVague[]) => CibleGeneree[],
  ): Promise<{ id: string; generee: CibleGeneree }[]>;
  listerCibles(communeId: string, campagneId: string, vague: DateISO): Promise<CibleTableau[]>;
  assigner(communeId: string, campagneId: string, affectations: { cibleId: string; utilisateurId: string | null }[]): Promise<void>;

  // Cibles et appels
  obtenirCible(communeId: string, cibleId: string): Promise<CibleAppel | null>;
  obtenirFicheAppel(communeId: string, beneficiaireId: string): Promise<FicheAppel | null>;
  /** « Fiche canicule » : comptes rendus écrits pendant l'alerte de la campagne (jamais l'historique de l'année). */
  notesAlerte(communeId: string, beneficiaireId: string, campagneId: string): Promise<NoteAlerte[]>;
  mettreAJourCible(cibleId: string, maj: MiseAJourCible): Promise<void>;
  /** Pose le verrou si libre, expiré ou déjà détenu par l'utilisateur. Renvoie le détenteur effectif. */
  poserVerrou(cibleId: string, utilisateurId: string, maintenant: Date, expireAvant: Date): Promise<{ obtenu: boolean; detenteur: string | null }>;
  leverVerrou(cibleId: string, utilisateurId: string): Promise<void>;
  creerInteraction(communeId: string, interaction: NouvelleInteraction): Promise<string>;
  creerRappel(
    communeId: string,
    rappel: { type: TypeRappelAppel; beneficiaireId: string; objet: string; echeance: DateISO; creePar: string | null; urgent: boolean },
  ): Promise<void>;

  // Rapport et maquettes IA
  donneesRapport(communeId: string, campagneId: string): Promise<DonneesRapport | null>;
  obtenirAppelIa(communeId: string, interactionId: string): Promise<AppelIa | null>;
}
