/**
 * Ports du module registre (implémentés par les adaptateurs Drizzle de `infrastructure/`).
 */
import type { DateISO } from "@/shared/domain/dates";
import type { NiveauPriorite, Role, StatutFiche } from "@/shared/domain/vocabulaire";
import type { Filtre } from "../domain/filtre";
import type { ConfigVue, LigneBeneficiaire, ResultatAppelRapide, Tri } from "../domain/tableau";

export type PointCarte = { id: string; nom: string; lat: number; lon: number; niveau: NiveauPriorite; adresse: string };

export type Membre = { id: string; prenom: string; nom: string; role: Role };

/** Un filtre se combine éventuellement avec le filtre de base d'une liste (ET). */
export type Filtres = Filtre[];

export interface RegistreRepository {
  rechercher(
    communeId: string,
    filtres: Filtres,
    options: { tri: Tri[]; page: number; taillePage: number; jour: DateISO },
  ): Promise<{ lignes: LigneBeneficiaire[]; total: number }>;
  /** Identifiants correspondant aux filtres, dans l'ordre de priorité (RG-02). */
  rechercherIds(communeId: string, filtres: Filtres, jour: DateISO): Promise<string[]>;
  /** Lignes complètes (export), dans l'ordre de priorité. */
  lignes(communeId: string, filtres: Filtres, jour: DateISO): Promise<LigneBeneficiaire[]>;
  pointsCarte(communeId: string, filtres: Filtres, jour: DateISO): Promise<PointCarte[]>;
  /** Ne garde que les ids appartenant à la commune. */
  idsDeLaCommune(communeId: string, ids: string[]): Promise<string[]>;
  /** Ids triés par priorité (P1 d'abord, score décroissant). */
  ordonnerParPriorite(communeId: string, ids: string[]): Promise<string[]>;
}

export interface ReferentielsRepository {
  voies(communeId: string, recherche: string, limite: number): Promise<string[]>;
  quartiers(communeId: string): Promise<string[]>;
  tags(communeId: string): Promise<string[]>;
  equipe(communeId: string): Promise<Membre[]>;
}

export interface ActionsRepository {
  assigner(
    communeId: string,
    affectations: { beneficiaireId: string; utilisateurId: string }[],
    options: { remplacer: boolean; beneficiaireIds: string[] },
  ): Promise<void>;
  retirerAssignations(beneficiaireIds: string[]): Promise<void>;
  ajouterTag(communeId: string, ids: string[], tag: string, auteurId: string): Promise<number>;
  changerStatut(
    communeId: string,
    ids: string[],
    statut: StatutFiche,
    motif: { motifArchivage?: string; motifStatut?: string },
    auteurId: string,
  ): Promise<number>;
  enregistrerAppel(
    communeId: string,
    entree: { beneficiaireId: string; auteurId: string; resultat: ResultatAppelRapide; commentaire?: string; at: Date },
  ): Promise<string>;
  completerAppel(communeId: string, interactionId: string, auteurId: string, commentaire: string): Promise<boolean>;
  notifier(communeId: string, destinataireId: string, titre: string, message: string, lien: string): Promise<void>;
  journaliser(communeId: string, utilisateurId: string, action: string, cible: string, details: Record<string, unknown>): Promise<void>;
}

export type Liste = {
  id: string;
  nom: string;
  type: "dynamique" | "figee";
  filtre: Filtre;
  beneficiaireIds: string[];
  creePar: string | null;
  createdAt: Date;
};

export interface ListesRepository {
  lister(communeId: string): Promise<Liste[]>;
  trouver(communeId: string, id: string): Promise<Liste | null>;
  creer(communeId: string, liste: Omit<Liste, "id" | "createdAt">): Promise<string>;
  renommer(communeId: string, id: string, nom: string): Promise<void>;
  supprimer(communeId: string, id: string): Promise<void>;
}

export type VueSauvegardee = { id: string; nom: string; config: ConfigVue };

export interface VuesRepository {
  lister(utilisateurId: string): Promise<VueSauvegardee[]>;
  creer(utilisateurId: string, nom: string, config: ConfigVue): Promise<string>;
  supprimer(utilisateurId: string, id: string): Promise<void>;
}

export interface PresencesRepository {
  signaler(utilisateurId: string, ressource: string, at: Date): Promise<void>;
  presents(communeId: string, ressource: string, depuis: Date): Promise<Membre[]>;
}
