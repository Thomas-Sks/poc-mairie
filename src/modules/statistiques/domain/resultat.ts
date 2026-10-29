/**
 * Mise en forme d'un résultat : regroupements (tranches d'âge, statuts d'appel…), libellés, ordre,
 * mois manquants, comparaison entre deux périodes, choix du graphique adapté.
 */
import {
  BESOIN_LIBELLES,
  CAISSE_RETRAITE_LIBELLES,
  DEPLACEMENTS,
  DEPLACEMENT_LIBELLES,
  INTERACTION_LIBELLES,
  MODE_DE_VIE_LIBELLES,
  ORIGINES_INSCRIPTION,
  ORIGINE_INSCRIPTION_LIBELLES,
  PRISE_EN_CHARGE_LIBELLES,
  SEXE_LIBELLES,
  type Besoin,
  type CaisseRetraite,
  type Deplacement,
  type ModeDeVie,
  type OrigineInscription,
  type Sexe,
  type TypeInteraction,
  type TypePriseEnCharge,
} from "@/shared/domain/vocabulaire";
import { ajouterJours, type DateISO } from "@/shared/domain/dates";
import {
  CANAL_APPEL_LIBELLES,
  DECOUPAGES,
  ETAT_RAPPEL_LIBELLES,
  ETATS_RAPPEL,
  GROUPES_STATUT_APPEL,
  GROUPE_STATUT_APPEL_LIBELLES,
  MAX_PARTS_CAMEMBERT,
  STATUTS_INSCRIPTION,
  STATUT_INSCRIPTION_LIBELLES,
  TRANCHES_AGE,
  TYPE_RAPPEL_LIBELLES,
  groupeDuStatut,
  trancheAge,
  type DecoupageId,
  type TypeGraphique,
} from "./catalogue";
import type { DefinitionRequete, Periode, Referentiels } from "./requete";
import type { TypeRappel } from "@/shared/domain/vocabulaire";

/** Ce que renvoie la base : un effectif par valeur brute du découpage. */
export type LigneBrute = { cle: string | null; n: number };
export type ResultatBrut = { total: number; lignes: LigneBrute[] };

export type LigneResultat = {
  cle: string;
  libelle: string;
  n: number;
  /** Effectif de la période de comparaison (null sans comparaison). */
  nComparaison: number | null;
  libelleComparaison?: string;
};

export type ResultatRequete = {
  total: number;
  totalComparaison: number | null;
  decoupage: DecoupageId | null;
  lignes: LigneResultat[];
};

const NON_RENSEIGNE = "__vide__";

type Categorie = { cle: string; libelle: string; rang: number };

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function libelleMois(cle: string): string {
  const [an, mois] = cle.split("-").map(Number);
  return `${MOIS_COURTS[mois - 1]} ${an}`;
}

export function libelleJour(cle: DateISO): string {
  const [, mois, jour] = cle.split("-");
  return `${jour}/${mois}`;
}

const indexDe = (liste: readonly string[], v: string) => {
  const i = liste.indexOf(v);
  return i === -1 ? liste.length : i;
};

/** Traduit une valeur brute en catégorie affichée (avec regroupement éventuel). */
export function categoriser(decoupage: DecoupageId, brute: string | null, r: Referentiels): Categorie {
  if (brute === null || brute === "") {
    const libelle = decoupage === "prise_en_charge" ? "Aucune" : decoupage === "besoin" ? "Aucun besoin" : "Non renseigné";
    return { cle: NON_RENSEIGNE, libelle, rang: 999 };
  }
  switch (decoupage) {
    case "tranche_age": {
      const t = trancheAge(Number(brute));
      return { cle: t.cle, libelle: t.libelle, rang: TRANCHES_AGE.findIndex((x) => x.cle === t.cle) };
    }
    case "statut_appel": {
      const g = groupeDuStatut(brute);
      if (!g) return { cle: brute, libelle: brute, rang: 99 };
      return { cle: g, libelle: GROUPE_STATUT_APPEL_LIBELLES[g], rang: indexDe(Object.keys(GROUPES_STATUT_APPEL), g) };
    }
    case "sexe":
      return { cle: brute, libelle: SEXE_LIBELLES[brute as Sexe] ?? brute, rang: 0 };
    case "mode_de_vie":
      return { cle: brute, libelle: MODE_DE_VIE_LIBELLES[brute as ModeDeVie] ?? brute, rang: 0 };
    case "caisse_retraite":
      return { cle: brute, libelle: CAISSE_RETRAITE_LIBELLES[brute as CaisseRetraite] ?? brute, rang: 0 };
    case "origine_inscription":
      return { cle: brute, libelle: ORIGINE_INSCRIPTION_LIBELLES[brute as OrigineInscription] ?? brute, rang: indexDe(ORIGINES_INSCRIPTION, brute) };
    case "mobilite":
      return { cle: brute, libelle: DEPLACEMENT_LIBELLES[brute as Deplacement] ?? brute, rang: indexDe(DEPLACEMENTS, brute) };
    case "gir":
      return { cle: brute, libelle: `GIR ${brute}`, rang: Number(brute) };
    case "priorite":
      return { cle: brute, libelle: brute, rang: Number(brute.slice(1)) };
    case "prise_en_charge":
      return { cle: brute, libelle: PRISE_EN_CHARGE_LIBELLES[brute as TypePriseEnCharge] ?? brute, rang: 0 };
    case "mois":
      return { cle: brute, libelle: libelleMois(brute), rang: 0 };
    case "jour":
      return { cle: brute, libelle: libelleJour(brute), rang: 0 };
    case "type_interaction":
      return { cle: brute, libelle: INTERACTION_LIBELLES[brute as TypeInteraction] ?? brute, rang: 0 };
    case "canal":
      return { cle: brute, libelle: CANAL_APPEL_LIBELLES[brute as keyof typeof CANAL_APPEL_LIBELLES] ?? brute, rang: 0 };
    case "besoin":
      return { cle: brute, libelle: BESOIN_LIBELLES[brute as Besoin] ?? brute, rang: 0 };
    case "campagne":
      return { cle: brute, libelle: r.campagnes.find((c) => c.id === brute)?.nom ?? "Campagne supprimée", rang: 0 };
    case "statut_inscription":
      return { cle: brute, libelle: STATUT_INSCRIPTION_LIBELLES[brute as (typeof STATUTS_INSCRIPTION)[number]] ?? brute, rang: indexDe(STATUTS_INSCRIPTION, brute) };
    case "etat_rappel":
      return { cle: brute, libelle: ETAT_RAPPEL_LIBELLES[brute as (typeof ETATS_RAPPEL)[number]] ?? brute, rang: indexDe(ETATS_RAPPEL, brute) };
    case "type_rappel":
      return { cle: brute, libelle: TYPE_RAPPEL_LIBELLES[brute as TypeRappel] ?? brute, rang: 0 };
    case "quartier":
      return { cle: brute, libelle: brute, rang: 0 };
  }
}

type LigneGroupee = { cle: string; libelle: string; rang: number; n: number };

/** Regroupe les lignes brutes en catégories affichées et additionne les effectifs. */
export function regrouper(decoupage: DecoupageId, lignes: LigneBrute[], r: Referentiels): LigneGroupee[] {
  const parCle = new Map<string, LigneGroupee>();
  for (const l of lignes) {
    const c = categoriser(decoupage, l.cle, r);
    const existante = parCle.get(c.cle);
    if (existante) existante.n += l.n;
    else parCle.set(c.cle, { ...c, n: l.n });
  }
  return ordonner(decoupage, [...parCle.values()]);
}

function ordonner(decoupage: DecoupageId, lignes: LigneGroupee[]): LigneGroupee[] {
  const def = DECOUPAGES[decoupage];
  return [...lignes].sort((a, b) => {
    if (a.cle === NON_RENSEIGNE || b.cle === NON_RENSEIGNE) return a.cle === NON_RENSEIGNE ? 1 : -1;
    if (def.temporel) return a.cle.localeCompare(b.cle);
    if (def.ordonne) return a.rang - b.rang;
    return b.n - a.n || a.libelle.localeCompare(b.libelle, "fr");
  });
}

/** Mois successifs (YYYY-MM) de `du` à `au` inclus. */
export function moisEntre(du: string, au: string): string[] {
  const res: string[] = [];
  let [an, mois] = du.slice(0, 7).split("-").map(Number);
  const [anFin, moisFin] = au.slice(0, 7).split("-").map(Number);
  while ((an < anFin || (an === anFin && mois <= moisFin)) && res.length < 240) {
    res.push(`${an}-${String(mois).padStart(2, "0")}`);
    mois += 1;
    if (mois > 12) {
      mois = 1;
      an += 1;
    }
  }
  return res;
}

function joursEntre(du: DateISO, au: DateISO): DateISO[] {
  const res: DateISO[] = [];
  for (let d = du; d <= au && res.length < 400; d = ajouterJours(d, 1)) res.push(d);
  return res;
}

/** Ajoute les mois (ou jours) sans donnée pour qu'une courbe ne saute pas de période. */
export function completerTemps(decoupage: DecoupageId, lignes: LigneGroupee[], periode: Periode | null): LigneGroupee[] {
  if (decoupage !== "mois" && decoupage !== "jour") return lignes;
  const datees = lignes.filter((l) => l.cle !== NON_RENSEIGNE);
  if (!datees.length && !periode) return lignes;
  const cles = datees.map((l) => l.cle);
  const debut = periode?.du ?? cles[0];
  const fin = periode?.au ?? cles[cles.length - 1];
  const serie = decoupage === "mois" ? moisEntre(debut, fin) : joursEntre(debut, fin);
  if (serie.length > (decoupage === "mois" ? 60 : 62)) return lignes;
  const parCle = new Map(datees.map((l) => [l.cle, l]));
  return serie.map((cle) => parCle.get(cle) ?? { cle, libelle: decoupage === "mois" ? libelleMois(cle) : libelleJour(cle), rang: 0, n: 0 });
}

/** Construit le résultat affichable à partir des effectifs bruts (et de la comparaison éventuelle). */
export function construireResultat(
  d: DefinitionRequete,
  brut: ResultatBrut,
  brutComparaison: ResultatBrut | null,
  r: Referentiels,
): ResultatRequete {
  const base = { total: brut.total, totalComparaison: brutComparaison?.total ?? null, decoupage: d.decoupage };
  if (!d.decoupage) return { ...base, lignes: [] };
  const dec = d.decoupage;
  const a = completerTemps(dec, regrouper(dec, brut.lignes, r), d.periode);
  if (!brutComparaison) return { ...base, lignes: a.map((l) => ({ cle: l.cle, libelle: l.libelle, n: l.n, nComparaison: null })) };

  const b = completerTemps(dec, regrouper(dec, brutComparaison.lignes, r), d.comparaison);
  if (DECOUPAGES[dec].temporel) {
    // Dans le temps, on compare rang à rang : 1er mois de la période avec 1er mois de la comparaison.
    const longueur = Math.max(a.length, b.length);
    return {
      ...base,
      lignes: Array.from({ length: longueur }, (_, i) => ({
        cle: a[i]?.cle ?? `rang-${i}`,
        libelle: a[i]?.libelle ?? `+${i + 1}`,
        n: a[i]?.n ?? 0,
        nComparaison: b[i]?.n ?? 0,
        libelleComparaison: b[i]?.libelle,
      })),
    };
  }
  const cles = new Map<string, LigneGroupee>();
  for (const l of [...a, ...b]) if (!cles.has(l.cle)) cles.set(l.cle, l);
  const lignes = ordonner(dec, [...cles.values()].map((l) => ({ ...l, n: a.find((x) => x.cle === l.cle)?.n ?? 0 })));
  return {
    ...base,
    lignes: lignes.map((l) => ({ cle: l.cle, libelle: l.libelle, n: l.n, nComparaison: b.find((x) => x.cle === l.cle)?.n ?? 0 })),
  };
}

/** Période équivalente un an plus tôt (comparaison par défaut, E12-US5). */
export function memePeriodeAnneePrecedente(p: Periode): Periode {
  const recule = (d: DateISO) => {
    const [an, mois, jour] = d.split("-");
    const j = mois === "02" && jour === "29" ? "28" : jour;
    return `${Number(an) - 1}-${mois}-${j}`;
  };
  return { du: recule(p.du), au: recule(p.au) };
}

/** Évolution en % entre la comparaison et la période (null si non calculable). */
export function evolution(n: number, reference: number): number | null {
  if (reference === 0) return null;
  return Math.round(((n - reference) / reference) * 100);
}

// ─── Graphique adapté ─────────────────────────────────────────────────────────

/** Graphiques proposés pour un découpage et un nombre de catégories. */
export function graphiquesPossibles(decoupage: DecoupageId | null, nbCategories: number): TypeGraphique[] {
  if (!decoupage) return [];
  const def = DECOUPAGES[decoupage];
  if (def.temporel) return ["courbe", "barres"];
  const res: TypeGraphique[] = ["barres"];
  if (nbCategories >= 2 && nbCategories <= MAX_PARTS_CAMEMBERT && !def.multiValeur) res.push("camembert");
  if (def.geographique) res.push("carte");
  return res;
}

/** Graphique retenu : le choix de l'agent s'il est possible, sinon le plus lisible. */
export function graphiqueAdapte(decoupage: DecoupageId | null, nbCategories: number, prefere: TypeGraphique | null): TypeGraphique | null {
  const possibles = graphiquesPossibles(decoupage, nbCategories);
  if (!possibles.length) return null;
  if (prefere && possibles.includes(prefere)) return prefere;
  if (possibles[0] === "courbe") return "courbe";
  if (possibles.includes("camembert") && nbCategories <= 3) return "camembert";
  return "barres";
}
