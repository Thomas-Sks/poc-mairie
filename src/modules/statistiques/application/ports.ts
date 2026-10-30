import type { DateISO } from "@/shared/domain/dates";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";
import type { DefinitionRequete, Periode, Referentiels } from "../domain/requete";
import type { ResultatBrut } from "../domain/resultat";

export type PersonneTrouvee = {
  id: string;
  civilite: string;
  nom: string;
  prenom: string;
  age: number;
  quartier: string | null;
  priorite: NiveauPriorite;
  adresse: string;
  telephone: string | null;
};

export type QuartierCarte = { nom: string; contour: [number, number][] };

/** Moteur de calcul : traduit une définition en requête SQL sûre sur les données de la commune. */
export interface MoteurStatistiques {
  compter(communeId: string, d: DefinitionRequete, periode: Periode | null, reference: DateISO): Promise<ResultatBrut>;
  personnes(communeId: string, d: DefinitionRequete, reference: DateISO, limite: number): Promise<{ total: number; personnes: PersonneTrouvee[] }>;
  referentiels(communeId: string): Promise<Referentiels>;
  quartiers(communeId: string): Promise<QuartierCarte[]>;
}
