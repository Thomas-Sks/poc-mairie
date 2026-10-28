import type { GrilleScore } from "@/shared/domain/priorite";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";
import type { FicheExistante } from "@/modules/inscriptions/domain/doublons";
import type { CorrespondanceValeurs, FicheImport } from "../domain/analyse";
import type { Destination } from "../domain/champs";

export type MappingSauvegarde = {
  signature: string;
  nom: string;
  /** En-tête normalisé → destination. */
  colonnes: Record<string, Destination>;
  valeurs: CorrespondanceValeurs;
  misAJourLe: Date;
};

export type FicheACreer = FicheImport & { score: number; niveauPriorite: NiveauPriorite };

export interface ImportRepository {
  fichesComparables(communeId: string): Promise<FicheExistante[]>;
  voiesConnues(communeId: string): Promise<string[]>;
  grilleScore(communeId: string): Promise<GrilleScore>;
  /** Crée foyers (regroupés par `cleFoyer`), fiches, contacts, téléassistance et notes. Renvoie le nombre de foyers créés. */
  creerFiches(
    communeId: string,
    foyers: FicheACreer[][],
    options: { statut: "active" | "en_attente"; auteurId: string; aujourdhui: string; commune: { nom: string; codePostal: string } },
  ): Promise<{ foyers: number; fiches: number }>;
  trouverMapping(communeId: string, signature: string): Promise<MappingSauvegarde | null>;
  enregistrerMapping(communeId: string, mapping: Omit<MappingSauvegarde, "misAJourLe">, auteurId: string): Promise<void>;
  communeCodePostal(communeId: string): Promise<string>;
}
