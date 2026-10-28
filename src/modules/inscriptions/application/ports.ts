import type { EntreeFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import type { DateISO } from "@/shared/domain/dates";
import type { GrilleScore } from "@/shared/domain/priorite";
import type { Civilite, NiveauPriorite, StatutFiche } from "@/shared/domain/vocabulaire";
import type { FicheExistante } from "../domain/doublons";
import type { InscriptionTransformee } from "../domain/transformation";

/** Commune du formulaire public (résolue côté serveur, sans utilisateur connecté). */
export type CommunePublique = {
  id: string;
  nom: string;
  codePostal: string;
  structureNom: string;
  structureTelephone: string;
  rgpd: { responsable: string; conservation: string; dpo: string; droits: string };
  grilleScore: GrilleScore;
};

export type ContextePublic = { commune: CommunePublique; maintenant: Date };

export type StatutInscription = "en_attente" | "validee" | "rejetee";

export type FicheInscription = {
  id: string;
  civilite: Civilite;
  nom: string;
  prenom: string;
  dateNaissance: DateISO;
  telephoneFixe: string | null;
  telephoneMobile: string | null;
  statut: StatutFiche;
  score: number;
  niveauPriorite: NiveauPriorite;
  foyerId: string;
};

export type InscriptionEnregistree = {
  id: string;
  communeId: string;
  reponses: Record<string, unknown>;
  soumisLe: Date;
  statut: StatutInscription;
  motifRejet: string | null;
  traiteeLe: Date | null;
  traiteePar: string | null;
  adresse: string | null;
  fiches: FicheInscription[];
};

export interface CommunePubliqueRepository {
  communePublique(): Promise<CommunePublique>;
}

export interface InscriptionRepository {
  enregistrer(communeId: string, reponses: Record<string, unknown>, donnees: InscriptionTransformee, soumisLe: Date): Promise<{ id: string }>;
  lister(communeId: string, statut: StatutInscription | "traitee", limite?: number): Promise<InscriptionEnregistree[]>;
  obtenir(communeId: string, id: string): Promise<InscriptionEnregistree | null>;
  /** Fiches non archivées de la commune, hors `exclure`, pour la détection de doublons. */
  fichesComparables(communeId: string, exclure: string[]): Promise<FicheExistante[]>;
  /** Fiches « en attente » de l'inscription → `active` ; inscription → `validee`. */
  valider(communeId: string, id: string, utilisateurId: string, maintenant: Date): Promise<void>;
  /** Supprime les fiches encore en attente (minimisation RGPD) ; inscription → `rejetee`. */
  rejeter(communeId: string, id: string, motif: string, utilisateurId: string, maintenant: Date): Promise<void>;
  /**
   * Rattache la fiche en attente à une fiche existante (cercle, intervenants, absences, coordonnées manquantes),
   * puis supprime la fiche en attente. L'inscription est validée quand plus aucune fiche n'est en attente.
   */
  fusionner(communeId: string, entree: { inscriptionId: string; ficheEnAttenteId: string; ficheExistanteId: string }, utilisateurId: string, maintenant: Date): Promise<void>;
  /** Données nécessaires au calcul RG-01 d'une fiche (hors date du jour). */
  entreeFaits(communeId: string, beneficiaireId: string): Promise<Omit<EntreeFaits, "aujourdhui"> | null>;
  mettreAJourScore(communeId: string, beneficiaireId: string, score: number, niveau: NiveauPriorite): Promise<void>;
  grilleScore(communeId: string): Promise<GrilleScore>;
}

export interface Notifieur {
  /** Notification in-app à tous les admins de la commune (E7-US4, E14). */
  notifierAdmins(communeId: string, notification: { titre: string; message: string; lien: string }): Promise<void>;
}
