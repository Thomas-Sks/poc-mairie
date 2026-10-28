/**
 * Ports du module bénévole. Les cas d'usage n'en connaissent que les interfaces ;
 * l'adaptateur Drizzle est dans `infrastructure/`.
 *
 * RG-07 (minimisation) : les modèles de lecture ne portent QUE les champs listés en E10-US4/US5.
 */
import type { Besoin, Civilite, NiveauPriorite, Relation, StatutCible, TypeCampagne } from "@/shared/domain/vocabulaire";
import type { ResultatAppel, ResultatProche } from "../domain/issue-appel";
import type { Reponses } from "../domain/questions";
import type { ScriptAppel } from "../domain/script";

export type PersonneDeMaListe = {
  id: string; // identifiant de la cible (ligne de la vague du jour)
  civilite: Civilite;
  prenom: string;
  nom: string;
  age: number;
  niveau: NiveauPriorite;
  score: number;
  statut: StatutCible;
  prochaineTentativeAt: Date | null;
  verrouilleParAutre: boolean;
};

export type ProcheAAppeler = {
  lienId: string;
  rang: number;
  relation: Relation;
  prenom: string;
  telephone: string;
};

export type FicheAppel = {
  cibleId: string;
  typeAppel: TypeCampagne;
  civilite: Civilite;
  prenom: string;
  nom: string;
  age: number;
  infoPrioritaire: string | null;
  telephones: { libelle: string; numero: string }[];
  script: ScriptAppel;
  statut: StatutCible;
  nbTentatives: number;
  rangCercleEssaye: number;
  verrouilleParAutre: boolean;
  /** Cercle par rang d'appel, uniquement les proches qui ont un numéro (E10-US5). */
  cercle: ProcheAAppeler[];
};

export interface LectureBenevole {
  /** Cibles de la vague du jour assignées au bénévole, dans les campagnes actives de la commune. */
  maListe(communeId: string, benevoleId: string, jour: string, maintenant: Date): Promise<PersonneDeMaListe[]>;
  /** null si la cible n'est pas assignée à ce bénévole, pas du jour ou hors campagne active (RG-07). */
  ficheAppel(communeId: string, benevoleId: string, cibleId: string, jour: string, maintenant: Date): Promise<FicheAppel | null>;
  engagementAccepteLe(benevoleId: string): Promise<Date | null>;
}

export type Appelant = { id: string; prenom: string; nom: string };

type CommandeBase = {
  /** Identifiant généré par le navigateur : rend l'envoi rejouable sans doublon (file hors connexion). */
  idOperation: string;
  communeId: string;
  appelant: Appelant;
  cibleId: string;
  maintenant: Date;
};

export type CommandeResultat = CommandeBase & {
  resultat: ResultatAppel;
  reponses: Reponses;
  besoins: Besoin[];
  /** Tags à ajouter à la personne (ex. « isolement »). */
  tags: string[];
  note: string | null;
  /** Précision en une phrase (danger) ou sur le besoin. */
  precision: string | null;
};

export type CommandeProche = CommandeBase & { lienId: string; resultat: ResultatProche; note: string | null };

export type CommandeDemande = CommandeBase & { nature: "visite" | "info"; sujet: string | null };

export type IssueEnregistrement = {
  statut: StatutCible;
  /** L'opération avait déjà été enregistrée (renvoi depuis la file hors connexion). */
  dejaEnregistre: boolean;
  alerte: "danger" | "escalade" | null;
};

/**
 * Port d'écriture des appels. Point de branchement prévu avec le module « crise »
 * (enregistrer-resultat-appel) : RG-04 relances, escalade cercle, notifications.
 */
export interface JournalAppels {
  /** Prend le verrou d'appel (E8-US7) ; false si quelqu'un d'autre appelle déjà. */
  prendreVerrou(communeId: string, cibleId: string, appelantId: string, maintenant: Date): Promise<boolean>;
  libererVerrou(communeId: string, cibleId: string, appelantId: string): Promise<void>;
  enregistrerResultat(commande: CommandeResultat): Promise<IssueEnregistrement>;
  enregistrerResultatProche(commande: CommandeProche): Promise<IssueEnregistrement>;
  /** « Besoin d'une visite à domicile » / « Demande d'info sur des services seniors ». */
  creerDemande(commande: CommandeDemande): Promise<void>;
  /** E10-US9 : rend les personnes pas encore traitées ; renvoie leur nombre. */
  rendreListe(communeId: string, benevoleId: string, jour: string): Promise<number>;
}

export interface Engagements {
  /** E10-US2 : engagement de confidentialité horodaté. */
  accepter(communeId: string, benevoleId: string, at: Date): Promise<void>;
}
