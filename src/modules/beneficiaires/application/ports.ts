/**
 * Ports du module « bénéficiaires » : ce dont les cas d'usage ont besoin, sans dire comment c'est fait.
 * Toutes les méthodes reçoivent `communeId` (cloisonnement multi-tenant, E13-US8).
 */
import type { DateISO } from "@/shared/domain/dates";
import type { GrilleScore } from "@/shared/domain/priorite";
import type {
  Besoin,
  MotifArchivage,
  NiveauPriorite,
  NiveauRisque,
  Relation,
  StatutCible,
  StatutFiche,
  TypeIndisponibilite,
  TypeInteraction,
  TypePriseEnCharge,
} from "@/shared/domain/vocabulaire";
import type { SuggestionAdresse } from "../domain/adresse";
import type { FicheExistante } from "../domain/doublons";
import type { EntreeFaits } from "../domain/faits-priorite";
import type { Changement, SaisieBeneficiaire, SaisieFiche, SaisieFoyer, SaisieSante } from "../domain/fiche";

// ─── Fiche ───────────────────────────────────────────────────────────────────

export type MembreFoyer = { id: string; civilite: SaisieBeneficiaire["civilite"]; prenom: string; nom: string; statut: StatutFiche };

export type FicheComplete = {
  id: string;
  statut: StatutFiche;
  motifArchivage: MotifArchivage | null;
  motifStatut: string | null;
  score: number;
  niveauPriorite: NiveauPriorite;
  niveauForce: NiveauPriorite | null;
  niveauForceJustification: string | null;
  dateInscription: DateISO;
  dateDerniereVerification: DateISO | null;
  retourHospitalisationLe: DateISO | null;
  iaActivee: boolean;
  beneficiaire: SaisieBeneficiaire;
  sante: SaisieSante;
  foyer: SaisieFoyer & { id: string; codePostal: string; ville: string; quartier: string | null; adresseAVerifier: boolean };
  autresMembresFoyer: MembreFoyer[];
};

export type NouvelleFiche = SaisieFiche & {
  foyerComplement: { codePostal: string; ville: string; quartier: string | null; adresseAVerifier: boolean };
  score: number;
  niveauPriorite: NiveauPriorite;
  dateInscription: DateISO;
};

export type Referentiels = {
  tags: string[];
  equipe: { id: string; prenom: string; nom: string }[];
  structures: { id: string; nom: string; telephone: string | null }[];
  quartiers: { nom: string; contour: [number, number][] }[];
  commune: { codePostal: string; nom: string };
};

export interface FicheRepository {
  trouver(communeId: string, id: string): Promise<FicheComplete | null>;
  creer(communeId: string, fiche: NouvelleFiche): Promise<string>;
  /** Met à jour la fiche (et son foyer) et enregistre les changements dans l'historique, de façon atomique. */
  mettreAJour(
    communeId: string,
    id: string,
    fiche: SaisieFiche & { foyerComplement: { quartier: string | null; adresseAVerifier: boolean } },
    changements: Changement[],
    auteurId: string,
  ): Promise<void>;
  historiser(beneficiaireId: string, changements: Changement[], auteurId: string): Promise<void>;
  /** Fiches pouvant être des doublons : même date de naissance ou un des téléphones donnés. */
  candidatsDoublons(communeId: string, critere: { dateNaissance: DateISO; telephones: string[] }): Promise<FicheExistante[]>;
  entreeFaits(communeId: string, id: string): Promise<Omit<EntreeFaits, "aujourdhui"> | null>;
  enregistrerScore(communeId: string, id: string, score: number, niveau: NiveauPriorite): Promise<void>;
  grilleScore(communeId: string): Promise<GrilleScore>;
  archiver(communeId: string, id: string, motif: MotifArchivage, commentaire: string | null): Promise<void>;
  forcerNiveau(communeId: string, id: string, niveau: NiveauPriorite | null, justification: string | null): Promise<void>;
  definirIa(communeId: string, id: string, active: boolean): Promise<void>;
  definirRetourHospitalisation(communeId: string, id: string, date: DateISO | null): Promise<void>;
  referentiels(communeId: string): Promise<Referentiels>;
}

// ─── Journal, rappels, indisponibilités ──────────────────────────────────────

export type InteractionVue = {
  id: string;
  type: TypeInteraction;
  survenueLe: Date;
  dureeMinutes: number | null;
  auteur: string | null;
  interlocuteur: string | null;
  resultat: StatutCible | null;
  compteRendu: string | null;
  besoins: Besoin[];
  actionSuivi: string | null;
  campagne: { id: string; nom: string } | null;
  aDetailIa: boolean;
};

export type DetailAppelIa = InteractionVue & {
  detail: {
    transcription: { locuteur: "ia" | "personne"; texte: string }[];
    resume: string;
    reponses: Record<string, string>;
    risque: NiveauRisque;
    justification: string;
  };
};

export type ModificationVue = { id: string; champ: string; ancienneValeur: string | null; nouvelleValeur: string | null; at: Date; auteur: string | null };

/** Note libre rattachée à la fiche (ex. colonnes « fourre-tout » d'un import Excel, E15-US3). */
export type NoteFicheVue = { id: string; texte: string; source: string; at: Date; auteur: string | null };

export type RappelVue = { id: string; objet: string; echeance: DateISO; assigne: string | null; urgent: boolean; faitLe: Date | null; type: string };

export type IndisponibiliteVue = {
  id: string;
  type: TypeIndisponibilite;
  debut: DateISO;
  fin: DateISO | null;
  joignabilite: string | null;
  source: string | null;
  createdAt: Date;
};

export type NouvelleInteraction = {
  beneficiaireId: string;
  type: TypeInteraction;
  survenueLe: Date;
  dureeMinutes: number | null;
  auteurId: string;
  interlocuteurContactId: string | null;
  resultat: StatutCible | null;
  compteRendu: string | null;
  besoins: Besoin[];
  actionSuivi: string | null;
};

export type NouveauRappel = {
  beneficiaireId: string;
  type: "manuel" | "suivi" | "retour_absence";
  objet: string;
  echeance: DateISO;
  assigneA: string | null;
  creePar: string;
  urgent: boolean;
};

export type NouvelleIndisponibilite = {
  beneficiaireId: string;
  type: TypeIndisponibilite;
  debut: DateISO;
  fin: DateISO | null;
  joignabilite: string | null;
  source: string | null;
  creePar: string;
};

export type CibleActive = { campagne: string; statut: StatutCible; exclue: boolean; motifExclusion: string | null };

export interface SuiviRepository {
  interactions(communeId: string, beneficiaireId: string): Promise<InteractionVue[]>;
  appelIa(communeId: string, beneficiaireId: string, interactionId: string): Promise<DetailAppelIa | null>;
  modifications(communeId: string, beneficiaireId: string): Promise<ModificationVue[]>;
  rappels(communeId: string, beneficiaireId: string): Promise<RappelVue[]>;
  notes(communeId: string, beneficiaireId: string): Promise<NoteFicheVue[]>;
  indisponibilites(communeId: string, beneficiaireId: string): Promise<IndisponibiliteVue[]>;
  cibleActive(communeId: string, beneficiaireId: string, jour: DateISO): Promise<CibleActive | null>;
  /** Enregistre l'interaction et, s'il y en a un, le rappel de suivi, de façon atomique. */
  ajouterInteraction(communeId: string, interaction: NouvelleInteraction, rappel: NouveauRappel | null): Promise<string>;
  ajouterRappel(communeId: string, rappel: NouveauRappel): Promise<string>;
  marquerRappelFait(communeId: string, rappelId: string, at: Date): Promise<void>;
  /** Enregistre l'indisponibilité et le rappel « Vérifier le retour », de façon atomique. */
  ajouterIndisponibilite(communeId: string, indisponibilite: NouvelleIndisponibilite, rappel: NouveauRappel | null): Promise<string>;
  terminerIndisponibilite(communeId: string, indisponibiliteId: string, fin: DateISO): Promise<IndisponibiliteVue & { beneficiaireId: string }>;
}

// ─── Cercle ──────────────────────────────────────────────────────────────────

export type DonneesContact = {
  prenom: string | null;
  nom: string;
  structure: string | null;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  ville: string | null;
  disponibilites: string | null;
};

export type DonneesLien = {
  relation: Relation;
  rangAppel: number;
  possedeCles: boolean;
  estUrgence: boolean;
  estRepresentantLegal: boolean;
};

export type LienCercleVue = DonneesLien & {
  lienId: string;
  contactId: string;
  contact: DonneesContact;
  /** Nombre d'AUTRES bénéficiaires liés à ce contact (E2-US2). */
  partageAvec: number;
};

export type ContactTrouve = DonneesContact & { id: string; nbBeneficiaires: number };

export interface CercleRepository {
  liens(communeId: string, beneficiaireId: string): Promise<LienCercleVue[]>;
  lien(communeId: string, lienId: string): Promise<(LienCercleVue & { beneficiaireId: string }) | null>;
  chercherContacts(communeId: string, recherche: string): Promise<ContactTrouve[]>;
  creerContact(communeId: string, contact: DonneesContact): Promise<string>;
  contactExiste(communeId: string, contactId: string): Promise<boolean>;
  lier(beneficiaireId: string, contactId: string, lien: DonneesLien): Promise<string>;
  /** Modifie le contact partagé : la modification s'applique à tous les bénéficiaires liés (E2-US2). */
  modifierContact(communeId: string, contactId: string, contact: DonneesContact): Promise<void>;
  modifierLien(communeId: string, lienId: string, lien: DonneesLien): Promise<void>;
  retirerLien(communeId: string, lienId: string): Promise<void>;
}

// ─── Prises en charge ────────────────────────────────────────────────────────

export type DonneesPriseEnCharge = {
  type: TypePriseEnCharge;
  structureId: string | null;
  intervenantNom: string | null;
  telephone: string | null;
  possedeCles: boolean;
  dateDebut: DateISO | null;
  dateFin: DateISO | null;
  gir: number | null;
  heuresParSemaine: number | null;
  contactId: string | null;
};

export type CreneauVue = { id: string; joursSemaine: number[]; heureDebut: string; heureFin: string; exceptions: DateISO[] };

export type PriseEnChargeVue = DonneesPriseEnCharge & {
  id: string;
  structureNom: string | null;
  contactNom: string | null;
  creneaux: CreneauVue[];
};

export type DonneesCreneau = Omit<CreneauVue, "id">;

export interface PriseEnChargeRepository {
  lister(communeId: string, beneficiaireId: string): Promise<PriseEnChargeVue[]>;
  /** Bénéficiaire auquel appartient la prise en charge (ou le créneau), si dans la commune. */
  beneficiaireDe(communeId: string, ref: { priseEnChargeId?: string; creneauId?: string }): Promise<string | null>;
  ajouter(beneficiaireId: string, donnees: DonneesPriseEnCharge): Promise<string>;
  modifier(priseEnChargeId: string, donnees: DonneesPriseEnCharge): Promise<void>;
  retirer(priseEnChargeId: string): Promise<void>;
  ajouterCreneau(priseEnChargeId: string, creneau: DonneesCreneau): Promise<string>;
  modifierCreneau(creneauId: string, creneau: DonneesCreneau): Promise<void>;
  retirerCreneau(creneauId: string): Promise<void>;
}

// ─── Adresses ────────────────────────────────────────────────────────────────

export interface Geocodeur {
  /** Suggestions limitées au code postal de la commune ; repli sur le référentiel local si l'API échoue. */
  rechercher(communeId: string, recherche: string, codePostal: string): Promise<SuggestionAdresse[]>;
}

export type DepsBeneficiaires = {
  fiches: FicheRepository;
  suivi: SuiviRepository;
  cercle: CercleRepository;
  prises: PriseEnChargeRepository;
  geocodeur: Geocodeur;
};
