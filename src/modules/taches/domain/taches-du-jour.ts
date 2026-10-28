/**
 * E4-US3 — Sélection des tâches du jour (fonctions pures).
 * Rappels du jour et en retard, anniversaires à venir (E4-US1), fiches à revérifier (E1-US5)
 * et contacts dus selon la fréquence cible (E4-US4).
 */
import { ajouterJours, ecartEnJours, estAnniversaireRond, prochainAnniversaire, retirerMois, type DateISO } from "@/shared/domain/dates";
import type { TypeRappel } from "@/shared/domain/vocabulaire";

// ─── Rappels ──────────────────────────────────────────────────────────────────

export type Rappel = {
  id: string;
  objet: string;
  type: TypeRappel;
  echeance: DateISO;
  urgent: boolean;
  faitLe: Date | null;
  assigneA: string | null;
  beneficiaire: { id: string; nom: string } | null;
};

export type RappelDuJour = Rappel & { joursDeRetard: number };

/**
 * Rappels non faits dont l'échéance est aujourd'hui ou passée.
 * Ordre : urgents d'abord, puis les plus en retard, puis par objet.
 */
export function selectionnerRappels(rappels: Rappel[], jour: DateISO): RappelDuJour[] {
  return rappels
    .filter((r) => r.faitLe === null && r.echeance <= jour)
    .map((r) => ({ ...r, joursDeRetard: ecartEnJours(r.echeance, jour) }))
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (a.joursDeRetard !== b.joursDeRetard) return b.joursDeRetard - a.joursDeRetard;
      return a.objet.localeCompare(b.objet, "fr");
    });
}

/** Choix proposés pour reporter un rappel. */
export const REPORTS = ["demain", "trois_jours", "semaine"] as const;
export type Report = (typeof REPORTS)[number];
export const REPORT_LIBELLES: Record<Report, string> = {
  demain: "À demain",
  trois_jours: "Dans 3 jours",
  semaine: "Dans une semaine",
};
const REPORT_JOURS: Record<Report, number> = { demain: 1, trois_jours: 3, semaine: 7 };

export function nouvelleEcheance(report: Report, jour: DateISO): DateISO {
  return ajouterJours(jour, REPORT_JOURS[report]);
}

// ─── Personnes suivies ───────────────────────────────────────────────────────

export type PersonneSuivie = {
  id: string;
  nom: string;
  dateNaissance: DateISO;
  dateInscription: DateISO;
  dateDerniereVerification: DateISO | null;
  frequenceContactJours: number | null;
  dernierContact: DateISO | null;
};

export type AnniversaireAVenir = {
  personne: PersonneSuivie;
  date: DateISO;
  age: number;
  dansJours: number;
  rond: boolean;
};

/** E4-US1 : anniversaires dans les `joursAvant` prochains jours (aujourd'hui compris). */
export function anniversairesAVenir(personnes: PersonneSuivie[], jour: DateISO, joursAvant: number): AnniversaireAVenir[] {
  return personnes
    .map((personne) => {
      const { date, age } = prochainAnniversaire(personne.dateNaissance, jour);
      return { personne, date, age, dansJours: ecartEnJours(jour, date), rond: estAnniversaireRond(age) };
    })
    .filter((a) => a.dansJours <= joursAvant)
    .sort((a, b) => a.dansJours - b.dansJours || a.personne.nom.localeCompare(b.personne.nom, "fr"));
}

/** Retire `mois` mois à une date ISO (le jour est ramené au dernier jour du mois si besoin). */
export { retirerMois };

export type FicheAReverifier = { personne: PersonneSuivie; depuis: DateISO };

/**
 * E1-US5 : fiches non vérifiées depuis plus de `verificationMois` mois.
 * Sans date de vérification, on part de la date d'inscription. Les plus anciennes d'abord.
 */
export function fichesAReverifier(personnes: PersonneSuivie[], jour: DateISO, verificationMois: number): FicheAReverifier[] {
  const limite = retirerMois(jour, verificationMois);
  return personnes
    .map((personne) => ({ personne, depuis: personne.dateDerniereVerification ?? personne.dateInscription }))
    .filter((f) => f.depuis < limite)
    .sort((a, b) => a.depuis.localeCompare(b.depuis));
}

export type ContactDu = { personne: PersonneSuivie; joursSansContact: number | null; retard: number };

/**
 * E4-US4 : personnes avec une fréquence de contact cible et aucune interaction depuis au moins N jours.
 * Sans aucun contact enregistré, on compte depuis l'inscription. Les plus en retard d'abord.
 */
export function contactsDus(personnes: PersonneSuivie[], jour: DateISO): ContactDu[] {
  return personnes
    .filter((p): p is PersonneSuivie & { frequenceContactJours: number } => p.frequenceContactJours !== null && p.frequenceContactJours > 0)
    .map((personne) => {
      const reference = personne.dernierContact ?? personne.dateInscription;
      const joursDepuis = ecartEnJours(reference, jour);
      return {
        personne,
        joursSansContact: personne.dernierContact ? joursDepuis : null,
        retard: joursDepuis - personne.frequenceContactJours,
      };
    })
    .filter((c) => c.retard >= 0)
    .sort((a, b) => b.retard - a.retard);
}

// ─── Synthèse ────────────────────────────────────────────────────────────────

export type ParametresTaches = { anniversaireJoursAvant: number; verificationMois: number };

export type TachesDuJour = {
  jour: DateISO;
  rappels: RappelDuJour[];
  anniversaires: AnniversaireAVenir[];
  fichesAReverifier: FicheAReverifier[];
  /** Seuil utilisé pour les fiches à revérifier (lien vers la liste complète du registre). */
  verificationMois: number;
  contactsDus: ContactDu[];
};

export function selectionnerTachesDuJour(
  entree: { rappels: Rappel[]; personnes: PersonneSuivie[]; parametres: ParametresTaches },
  jour: DateISO,
): TachesDuJour {
  return {
    jour,
    rappels: selectionnerRappels(entree.rappels, jour),
    anniversaires: anniversairesAVenir(entree.personnes, jour, entree.parametres.anniversaireJoursAvant),
    fichesAReverifier: fichesAReverifier(entree.personnes, jour, entree.parametres.verificationMois),
    verificationMois: entree.parametres.verificationMois,
    contactsDus: contactsDus(entree.personnes, jour),
  };
}

/** « aujourd'hui », « demain », « dans 3 jours » */
export function libelleDans(jours: number): string {
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  return `dans ${jours} jours`;
}

/** « Prévu aujourd'hui », « En retard d'1 jour », « En retard de 5 jours » */
export function libelleRetard(joursDeRetard: number): string {
  if (joursDeRetard <= 0) return "Aujourd'hui";
  if (joursDeRetard === 1) return "En retard d'1 jour";
  return `En retard de ${joursDeRetard} jours`;
}
