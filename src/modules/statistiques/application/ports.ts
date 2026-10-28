import type { DateISO } from "@/shared/domain/dates";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";
import type { Widget } from "../domain/dashboard";
import type { DefinitionRequete, Periode, Referentiels } from "../domain/requete";
import type { ResultatBrut } from "../domain/resultat";
import type { IndicateursBruts } from "../domain/vue-ensemble";

export type PersonneTrouvee = {
  id: string;
  civilite: string;
  nom: string;
  prenom: string;
  age: number;
  quartier: string | null;
  priorite: NiveauPriorite;
};

export type QuartierCarte = { nom: string; contour: [number, number][] };

/** Moteur de calcul : traduit une définition en requête SQL sûre sur les données de la commune. */
export interface MoteurStatistiques {
  compter(communeId: string, d: DefinitionRequete, periode: Periode | null, reference: DateISO): Promise<ResultatBrut>;
  personnes(communeId: string, d: DefinitionRequete, reference: DateISO, limite: number): Promise<{ total: number; personnes: PersonneTrouvee[] }>;
  referentiels(communeId: string): Promise<Referentiels>;
  quartiers(communeId: string): Promise<QuartierCarte[]>;
}

export type RequeteEnregistree = {
  id: string;
  nom: string;
  definition: DefinitionRequete;
  auteur: string | null;
  creeLe: Date;
};

export interface RequeteRepository {
  lister(communeId: string): Promise<RequeteEnregistree[]>;
  obtenir(communeId: string, id: string): Promise<RequeteEnregistree | null>;
  creer(communeId: string, auteurId: string, nom: string, d: DefinitionRequete): Promise<string>;
  supprimer(communeId: string, id: string): Promise<void>;
}

export type Dashboard = {
  id: string;
  nom: string;
  predefini: boolean;
  partage: boolean;
  widgets: Widget[];
  creePar: string | null;
  auteur: string | null;
};

export interface DashboardRepository {
  lister(communeId: string): Promise<Dashboard[]>;
  obtenir(communeId: string, id: string): Promise<Dashboard | null>;
  creer(communeId: string, auteurId: string, nom: string): Promise<string>;
  modifier(communeId: string, id: string, champs: Partial<Pick<Dashboard, "nom" | "partage" | "widgets">>): Promise<void>;
  supprimer(communeId: string, id: string): Promise<void>;
}

/** Indicateurs de la vue d'ensemble (comptages bruts sur les fiches actives). */
export interface IndicateursRepository {
  charger(communeId: string, jour: DateISO): Promise<IndicateursBruts>;
}
