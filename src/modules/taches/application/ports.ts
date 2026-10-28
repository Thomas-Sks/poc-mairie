import type { DateISO } from "@/shared/domain/dates";
import type { ParametresTaches, PersonneSuivie, Rappel } from "../domain/taches-du-jour";

export type RappelAvecAssigne = Rappel & { assigneNom: string | null };

export type InscriptionEnAttente = { id: string; soumisLe: Date; personnes: string[] };

export interface TachesRepository {
  /** Rappels non faits dont l'échéance est ≤ `jusquAu` ; `assigneA` restreint à un utilisateur. */
  rappelsOuverts(communeId: string, filtre: { jusquAu: DateISO; assigneA?: string }): Promise<RappelAvecAssigne[]>;
  trouverRappel(communeId: string, id: string): Promise<Rappel | null>;
  marquerFait(communeId: string, id: string, at: Date): Promise<void>;
  reporter(communeId: string, id: string, echeance: DateISO): Promise<void>;
  /** Fiches actives avec les dates utiles (naissance, vérification, dernier contact). */
  personnesActives(communeId: string): Promise<PersonneSuivie[]>;
  inscriptionsEnAttente(communeId: string): Promise<InscriptionEnAttente[]>;
  parametres(communeId: string): Promise<ParametresTaches>;
}
