/**
 * Vue d'ensemble des statistiques : quelques indicateurs choisis pour piloter le registre
 * d'un coup d'œil (population, fragilités, suivi, dernière alerte, qualité des données).
 * Fonctions pures : l'infrastructure fournit les comptages bruts, le domaine en dérive l'affichage.
 */
import { ajouterJours, type DateISO } from "@/shared/domain/dates";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";

/** Comptages bruts, sur les fiches actives de la commune. */
export type IndicateursBruts = {
  actifs: number;
  parNiveau: Record<NiveauPriorite, number>;
  inscritsSurPeriode: number; // inscriptions des 12 derniers mois
  fragilites: {
    vitSeul: number;
    age85: number;
    mobiliteReduite: number; // déambulateur, fauteuil, immobilisé
    troublesCognitifs: number;
    sansAideADomicile: number;
    sansTelephone: number;
  };
  suivi: {
    contactes90j: number;
    sansContact6Mois: number;
    rappelsEnRetard: number;
  };
  /** 12 derniers mois, du plus ancien au plus récent ; clé AAAA-MM. */
  contactsParMois: { mois: string; appels: number; appelsAlerte: number; visites: number }[];
  quartiers: { nom: string; total: number; p1: number }[];
  p1SansContact: { id: string; nom: string; joursSansContact: number | null; quartier: string | null }[];
  qualite: { aReverifier: number; adresseAVerifier: number; inscriptionsEnAttente: number };
  derniereAlerte: {
    campagneId: string;
    nom: string;
    debut: DateISO;
    fin: DateISO | null;
    personnes: number;
    vagues: number;
    cibles: number;
    jointesOuCouvertes: number;
    couvertesParPassage: number;
    situationsSignalees: number; // besoin, danger, évacuation, escalade, non joint à traiter
    parIa: number;
  } | null;
};

export type Indicateur = { valeur: number; part: number | null };

/** Part entière en pourcentage, ou null si le total est nul. */
export function pourcentage(n: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((n / total) * 100);
}

export function indicateur(n: number, total: number): Indicateur {
  return { valeur: n, part: pourcentage(n, total) };
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « oct. 26 » */
export function libelleMoisCourt(cle: string): string {
  const [an, mois] = cle.split("-");
  return `${MOIS_COURTS[Number(mois) - 1]} ${an.slice(2)}`;
}

/** Les 12 clés AAAA-MM se terminant par le mois de `jour`. */
export function douzeDerniersMois(jour: DateISO): string[] {
  const [an, mois] = jour.split("-").map(Number);
  return Array.from({ length: 12 }, (_, k) => {
    const d = new Date(Date.UTC(an, mois - 1 - (11 - k), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** Appels de suivi courant, appels passés pendant une alerte, visites. */
export type MoisActivite = { mois: string; libelle: string; appels: number; appelsAlerte: number; visites: number };

/** Complète les mois manquants à zéro, dans l'ordre chronologique. */
export function completerMois(
  lignes: { mois: string; appels: number; appelsAlerte: number; visites: number }[],
  jour: DateISO,
): MoisActivite[] {
  const parMois = new Map(lignes.map((l) => [l.mois, l]));
  return douzeDerniersMois(jour).map((mois) => ({
    mois,
    libelle: libelleMoisCourt(mois),
    appels: parMois.get(mois)?.appels ?? 0,
    appelsAlerte: parMois.get(mois)?.appelsAlerte ?? 0,
    visites: parMois.get(mois)?.visites ?? 0,
  }));
}

/** Date de référence « il y a N jours ». */
export const ilYA = (jour: DateISO, jours: number) => ajouterJours(jour, -jours);

export type VueEnsemble = {
  population: { actifs: number; p1: Indicateur; vitSeul: Indicateur; inscritsSurPeriode: number };
  niveaux: { niveau: NiveauPriorite; n: number; part: number | null }[];
  fragilites: { libelle: string; n: number; part: number | null }[];
  suivi: { contactes90j: Indicateur; sansContact6Mois: number; rappelsEnRetard: number };
  activite: MoisActivite[];
  quartiers: { nom: string; total: number; p1: number }[];
  p1SansContact: IndicateursBruts["p1SansContact"];
  qualite: IndicateursBruts["qualite"] & { sansTelephone: number };
  derniereAlerte:
    | (NonNullable<IndicateursBruts["derniereAlerte"]> & { tauxJointesOuCouvertes: number | null; tauxIa: number | null })
    | null;
};

export function assemblerVueEnsemble(b: IndicateursBruts, jour: DateISO): VueEnsemble {
  const total = b.actifs;
  const f = b.fragilites;
  const a = b.derniereAlerte;
  return {
    population: {
      actifs: total,
      p1: indicateur(b.parNiveau.P1, total),
      vitSeul: indicateur(f.vitSeul, total),
      inscritsSurPeriode: b.inscritsSurPeriode,
    },
    niveaux: (["P1", "P2", "P3"] as const).map((niveau) => ({ niveau, n: b.parNiveau[niveau], part: pourcentage(b.parNiveau[niveau], total) })),
    fragilites: [
      { libelle: "Vivent seules", n: f.vitSeul },
      { libelle: "85 ans et plus", n: f.age85 },
      { libelle: "Mobilité réduite dans le domicile", n: f.mobiliteReduite },
      { libelle: "Aucune aide à domicile", n: f.sansAideADomicile },
      { libelle: "Troubles cognitifs", n: f.troublesCognitifs },
    ]
      .map((x) => ({ ...x, part: pourcentage(x.n, total) }))
      .sort((x, y) => y.n - x.n),
    suivi: {
      contactes90j: indicateur(b.suivi.contactes90j, total),
      sansContact6Mois: b.suivi.sansContact6Mois,
      rappelsEnRetard: b.suivi.rappelsEnRetard,
    },
    activite: completerMois(b.contactsParMois, jour),
    quartiers: [...b.quartiers].sort((x, y) => y.total - x.total),
    p1SansContact: b.p1SansContact,
    qualite: { ...b.qualite, sansTelephone: f.sansTelephone },
    derniereAlerte: a
      ? { ...a, tauxJointesOuCouvertes: pourcentage(a.jointesOuCouvertes, a.cibles), tauxIa: pourcentage(a.parIa, a.cibles) }
      : null,
  };
}
