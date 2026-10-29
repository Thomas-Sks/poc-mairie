/**
 * Ports du module bénévole. Les cas d'usage n'en connaissent que les interfaces ;
 * l'adaptateur Drizzle est dans `infrastructure/`.
 *
 * RG-07 (minimisation) : les modèles de lecture ne portent QUE les champs listés en E10-US4/US5.
 */
import type { Contexte } from "@/shared/application/contexte";
import type { Besoin, Civilite, NiveauPriorite, Relation, StatutCible, TypeCampagne } from "@/shared/domain/vocabulaire";
import type { ResultatAppel, ResultatProche } from "../domain/resultats";
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
  /** « Fiche canicule » : comptes rendus écrits pendant l'alerte en cours, par tous les appelants. Jamais l'historique de l'année. */
  notesAlerte: NoteAlerte[];
};

/** Même forme que les notes lues par le module Crise. */
export type NoteAlerte = { auteur: string; at: Date; texte: string };

export interface LectureBenevole {
  /** Cibles de la vague du jour assignées au bénévole, dans les campagnes actives de la commune. */
  maListe(communeId: string, benevoleId: string, jour: string, maintenant: Date): Promise<PersonneDeMaListe[]>;
  /** null si la cible n'est pas assignée à ce bénévole, pas du jour ou hors campagne active (RG-07). */
  ficheAppel(communeId: string, benevoleId: string, cibleId: string, jour: string, maintenant: Date): Promise<FicheAppel | null>;
  engagementAccepteLe(benevoleId: string): Promise<Date | null>;
  /** Nombre de personnes confiées au bénévole (table des assignations), même hors alerte. */
  nbPersonnesConfiees(communeId: string, benevoleId: string): Promise<number>;
}

// ─── Gestion des bénévoles (côté CCAS) ───────────────────────────────────────

export type BenevoleResume = { id: string; prenom: string; nom: string; telephone: string | null; email: string; nbPersonnes: number };

export type PersonneConfiee = {
  id: string;
  civilite: Civilite;
  prenom: string;
  nom: string;
  age: number;
  adresse: string;
  niveau: NiveauPriorite;
};

export type PersonneTrouvee = PersonneConfiee & { dejaConfiee: boolean };

export interface GestionBenevoles {
  lister(communeId: string): Promise<BenevoleResume[]>;
  obtenir(communeId: string, benevoleId: string): Promise<BenevoleResume | null>;
  personnesConfiees(communeId: string, benevoleId: string, jour: string): Promise<PersonneConfiee[]>;
  /** Recherche par nom ou rue parmi les fiches actives (20 résultats au plus). */
  rechercher(communeId: string, benevoleId: string, texte: string, jour: string): Promise<PersonneTrouvee[]>;
  emailUtilise(email: string): Promise<boolean>;
  creer(communeId: string, b: { prenom: string; nom: string; telephone: string | null; email: string }): Promise<string>;
  confier(communeId: string, benevoleId: string, beneficiaireIds: string[]): Promise<number>;
  retirer(communeId: string, benevoleId: string, beneficiaireId: string): Promise<void>;
}

type CommandeBase = {
  /** Identifiant généré par le navigateur : rend l'envoi rejouable sans doublon (file hors connexion). */
  idOperation: string;
  cibleId: string;
};

export type CommandeResultat = CommandeBase & {
  resultat: ResultatAppel;
  reponses: Reponses;
  besoins: Besoin[];
  /** Tags à ajouter à la personne (ex. « isolement »), déduits des réponses au script. */
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
 * Port d'écriture des appels. L'adaptateur délègue verrou et résultats aux cas d'usage du module Crise
 * (cycle de vie de la cible : RG-04 relances, escalade cercle, notifications) et ajoute ce qui est propre
 * au bénévole : idempotence des renvois hors connexion, tags issus du script, demandes, « rendre ma liste ».
 * Le contrôle RG-07 est fait AVANT, par les cas d'usage du bénévole.
 */
export interface JournalAppels {
  /** Prend le verrou d'appel (E8-US7) ; false si quelqu'un d'autre appelle déjà. */
  prendreVerrou(ctx: Contexte, cibleId: string): Promise<boolean>;
  libererVerrou(ctx: Contexte, cibleId: string): Promise<void>;
  enregistrerResultat(ctx: Contexte, commande: CommandeResultat): Promise<IssueEnregistrement>;
  enregistrerResultatProche(ctx: Contexte, commande: CommandeProche): Promise<IssueEnregistrement>;
  /** « Besoin d'une visite à domicile » / « Demande d'info sur des services seniors ». */
  creerDemande(ctx: Contexte, commande: CommandeDemande): Promise<void>;
  /** E10-US9 : rend les personnes pas encore traitées de la vague `jour` ; renvoie leur nombre. */
  rendreListe(ctx: Contexte, jour: string): Promise<number>;
}

export interface Engagements {
  /** E10-US2 : engagement de confidentialité horodaté. */
  accepter(communeId: string, benevoleId: string, at: Date): Promise<void>;
}
