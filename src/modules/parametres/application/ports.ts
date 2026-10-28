import type { EntreeFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import type { NiveauPriorite, Role } from "@/shared/domain/vocabulaire";
import type { ParametresCommune } from "../domain/parametres";

export type FichePourScore = {
  id: string;
  score: number;
  niveauPriorite: NiveauPriorite;
  niveauForce: NiveauPriorite | null;
  faits: Omit<EntreeFaits, "aujourdhui">;
};

export type MembreEquipe = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: Role;
  actif: boolean;
};

export type NouveauMembre = { prenom: string; nom: string; email: string; telephone: string | null; role: Role };

export interface ParametresRepository {
  lire(communeId: string): Promise<ParametresCommune>;
  enregistrer(communeId: string, parametres: ParametresCommune): Promise<void>;
  /** Fiches actives avec tout ce qu'il faut pour extraire les faits du score (foyer, cercle, prises en charge). */
  fichesActivesPourScore(communeId: string): Promise<FichePourScore[]>;
  enregistrerScores(communeId: string, scores: { id: string; score: number; niveauPriorite: NiveauPriorite }[]): Promise<void>;
  equipe(communeId: string): Promise<MembreEquipe[]>;
  emailUtilise(email: string): Promise<boolean>;
  creerMembre(communeId: string, membre: NouveauMembre): Promise<MembreEquipe>;
}

/** Rechargement du jeu de démonstration (§10.2). */
export interface DemoPort {
  reinitialiser(): Promise<void>;
}
