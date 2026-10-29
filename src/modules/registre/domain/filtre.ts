/**
 * E8-US2 / E8-US3 — Filtre combinable du registre.
 *
 * Objet PUR et sérialisable en JSON : il est stocké tel quel dans `listes.filtre`, dans les vues
 * sauvegardées (E8-US10) et réutilisé par le module Alertes (campagne « à partir d'un filtre »).
 * Tous les critères sont facultatifs et se combinent en ET ; à l'intérieur d'un critère multiple
 * (ex. plusieurs rues, plusieurs niveaux), les valeurs se combinent en OU.
 */
import { z } from "zod";
import {
  DEPLACEMENTS,
  DEPLACEMENT_LIBELLES,
  NIVEAUX_PRIORITE,
  SEXES,
  SEXE_LIBELLES,
  STATUTS_FICHE,
  STATUT_FICHE_LIBELLES,
  type Deplacement,
  type NiveauPriorite,
  type Sexe,
  type StatutFiche,
} from "@/shared/domain/vocabulaire";
import { ajouterJours, type DateISO } from "@/shared/domain/dates";

export const VERSION_FILTRE = 1;

/** Côté de la rue pour une plage de numéros (ex. inondation côté pair du n° 2 au n° 40). */
export const COTES = ["tous", "pair", "impair"] as const;
export type Cote = (typeof COTES)[number];
export const COTE_LIBELLES: Record<Cote, string> = { tous: "Les deux côtés", pair: "Numéros pairs", impair: "Numéros impairs" };

export type FiltreRue = {
  voie: string;
  numeroMin?: number;
  numeroMax?: number;
  cote: Cote;
};

/** Coordonnées [latitude, longitude] (ordre Leaflet). */
export type Coordonnee = [number, number];

/** E8-US3 (S) : zone dessinée sur la carte. */
export type ZoneCarte =
  | { type: "polygone"; points: Coordonnee[] }
  | { type: "cercle"; centre: Coordonnee; rayonMetres: number };

/** Date du dernier contact : « contacté il y a moins de N jours » ou « sans contact depuis plus de N jours » (jamais contacté inclus). */
export type DernierContact = { sens: "moins_de" | "plus_de"; jours: number };

export type Filtre = {
  version: typeof VERSION_FILTRE;
  /** Recherche plein texte : nom, prénom, téléphone, adresse. */
  recherche?: string;
  age?: { min?: number; max?: number };
  sexes?: Sexe[];
  vitSeul?: boolean;
  deplacements?: Deplacement[];
  handicap?: boolean;
  apa?: boolean;
  girs?: number[];
  /** Niveau effectif (forcé manuellement, sinon calculé). */
  niveaux?: NiveauPriorite[];
  /** Absent : toutes les fiches sauf les archivées. */
  statuts?: StatutFiche[];
  /** Au moins un des tags. */
  tags?: string[];
  dernierContact?: DernierContact;
  /** E1-US5 : fiche non vérifiée depuis plus de N mois (à défaut de vérification, depuis l'inscription). */
  /** Indisponibilité en cours aujourd'hui (vacances, hospitalisation…). */
  indisponible?: boolean;
  /** Assigné à l'un de ces utilisateurs (E8-US6). */
  assignesA?: string[];
  rues?: FiltreRue[];
  quartiers?: string[];
  zone?: ZoneCarte;
  /** Restriction à un ensemble de fiches (liste figée). */
  ids?: string[];
};

// ─── Validation (frontière : listes, vues, API) ───────────────────────────────

const entierPositif = z.number().int().min(0).max(100_000);
const coordonnee = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);

const schemaRue = z
  .object({
    voie: z.string().trim().min(1).max(200),
    numeroMin: entierPositif.optional(),
    numeroMax: entierPositif.optional(),
    cote: z.enum(COTES).default("tous"),
  })
  .refine((r) => r.numeroMin === undefined || r.numeroMax === undefined || r.numeroMin <= r.numeroMax, {
    message: "Le premier numéro doit être inférieur au dernier",
  });

const schemaZone = z.discriminatedUnion("type", [
  z.object({ type: z.literal("polygone"), points: z.array(coordonnee).min(3).max(500) }),
  z.object({ type: z.literal("cercle"), centre: coordonnee, rayonMetres: z.number().positive().max(50_000) }),
]);

export const schemaFiltre = z.object({
  version: z.literal(VERSION_FILTRE).default(VERSION_FILTRE),
  recherche: z.string().trim().max(200).optional(),
  age: z
    .object({ min: z.number().int().min(0).max(130).optional(), max: z.number().int().min(0).max(130).optional() })
    .refine((a) => a.min === undefined || a.max === undefined || a.min <= a.max, { message: "Âge minimum supérieur à l'âge maximum" })
    .optional(),
  sexes: z.array(z.enum(SEXES)).optional(),
  vitSeul: z.boolean().optional(),
  deplacements: z.array(z.enum(DEPLACEMENTS)).optional(),
  handicap: z.boolean().optional(),
  apa: z.boolean().optional(),
  girs: z.array(z.number().int().min(1).max(6)).optional(),
  niveaux: z.array(z.enum(NIVEAUX_PRIORITE)).optional(),
  statuts: z.array(z.enum(STATUTS_FICHE)).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
  dernierContact: z.object({ sens: z.enum(["moins_de", "plus_de"]), jours: z.number().int().min(1).max(3650) }).optional(),
  indisponible: z.boolean().optional(),
  assignesA: z.array(z.uuid()).optional(),
  rues: z.array(schemaRue).max(50).optional(),
  quartiers: z.array(z.string().trim().min(1).max(100)).optional(),
  zone: schemaZone.optional(),
  ids: z.array(z.uuid()).max(100_000).optional(),
});

export const FILTRE_VIDE: Filtre = { version: VERSION_FILTRE };

/**
 * Normalise un filtre : retire les critères vides (tableaux vides, chaînes vides, plages vides),
 * dédoublonne et trie les valeurs multiples. Deux filtres équivalents ont la même forme normalisée.
 */
export function normaliserFiltre(filtre: Filtre): Filtre {
  const f: Filtre = { version: VERSION_FILTRE };
  const multi = <T extends string | number>(v: T[] | undefined) => {
    if (!v || v.length === 0) return undefined;
    return [...new Set(v)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  };
  const recherche = filtre.recherche?.trim();
  if (recherche) f.recherche = recherche;
  if (filtre.age && (filtre.age.min !== undefined || filtre.age.max !== undefined)) {
    f.age = {};
    if (filtre.age.min !== undefined) f.age.min = filtre.age.min;
    if (filtre.age.max !== undefined) f.age.max = filtre.age.max;
  }
  const sexes = multi(filtre.sexes);
  if (sexes) f.sexes = sexes;
  if (filtre.vitSeul !== undefined) f.vitSeul = filtre.vitSeul;
  const deplacements = multi(filtre.deplacements);
  if (deplacements) f.deplacements = deplacements;
  if (filtre.handicap !== undefined) f.handicap = filtre.handicap;
  if (filtre.apa !== undefined) f.apa = filtre.apa;
  const girs = multi(filtre.girs);
  if (girs) f.girs = girs;
  const niveaux = multi(filtre.niveaux);
  if (niveaux) f.niveaux = niveaux;
  const statuts = multi(filtre.statuts);
  if (statuts) f.statuts = statuts;
  const tags = multi(filtre.tags);
  if (tags) f.tags = tags;
  if (filtre.dernierContact) f.dernierContact = { ...filtre.dernierContact };
  if (filtre.indisponible !== undefined) f.indisponible = filtre.indisponible;
  const assignes = multi(filtre.assignesA);
  if (assignes) f.assignesA = assignes;
  if (filtre.rues && filtre.rues.length > 0) {
    f.rues = filtre.rues.map((r) => {
      const rue: FiltreRue = { voie: r.voie.trim(), cote: r.cote };
      if (r.numeroMin !== undefined) rue.numeroMin = r.numeroMin;
      if (r.numeroMax !== undefined) rue.numeroMax = r.numeroMax;
      return rue;
    });
  }
  const quartiers = multi(filtre.quartiers);
  if (quartiers) f.quartiers = quartiers;
  if (filtre.zone) f.zone = filtre.zone;
  if (filtre.ids) f.ids = [...new Set(filtre.ids)];
  return f;
}

export type ResultatValidation = { ok: true; filtre: Filtre } | { ok: false; erreurs: string[] };

/** Valide une donnée inconnue (JSON stocké, corps de requête) et renvoie un filtre normalisé. */
export function validerFiltre(donnee: unknown): ResultatValidation {
  const r = schemaFiltre.safeParse(donnee ?? {});
  if (!r.success) return { ok: false, erreurs: r.error.issues.map((i) => `${i.path.join(".") || "filtre"} : ${i.message}`) };
  return { ok: true, filtre: normaliserFiltre(r.data as Filtre) };
}

/** Comme `validerFiltre` mais lève une erreur (à utiliser derrière une frontière déjà validée). */
export function lireFiltre(donnee: unknown): Filtre {
  const r = validerFiltre(donnee);
  if (!r.ok) throw new Error(`Filtre invalide : ${r.erreurs.join(" ; ")}`);
  return r.filtre;
}

/** Sérialisation stable (clés dans un ordre fixe) — utilisable comme clé de cache. */
export function serialiserFiltre(filtre: Filtre): string {
  return JSON.stringify(normaliserFiltre(filtre));
}

export function deserialiserFiltre(texte: string): Filtre {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error("Filtre invalide : JSON illisible");
  }
  return lireFiltre(brut);
}

/** Forme stockée en base (`listes.filtre` est un jsonb `Record<string, unknown>`). */
export function versJson(filtre: Filtre): Record<string, unknown> {
  return JSON.parse(serialiserFiltre(filtre)) as Record<string, unknown>;
}

export function estFiltreVide(filtre: Filtre): boolean {
  return Object.keys(normaliserFiltre(filtre)).length === 1;
}

// ─── Règles utilisées par l'adaptateur SQL ────────────────────────────────────

/**
 * RG-08 : l'âge est calculé depuis la date de naissance. On traduit une plage d'âge en bornes
 * de date de naissance (ce qui permet d'utiliser un index) : âge ≥ min ⇔ né le ou avant `jour - min ans`.
 */
export function bornesNaissance(age: { min?: number; max?: number }, jour: DateISO): { neAvantLe?: DateISO; neApres?: DateISO } {
  const decaler = (ans: number) => {
    const [a, m, j] = jour.split("-").map(Number);
    // 29 février → 28 février les années non bissextiles
    const annee = a - ans;
    const dernierJour = new Date(Date.UTC(annee, m, 0)).getUTCDate();
    return `${annee}-${String(m).padStart(2, "0")}-${String(Math.min(j, dernierJour)).padStart(2, "0")}`;
  };
  const bornes: { neAvantLe?: DateISO; neApres?: DateISO } = {};
  if (age.min !== undefined) bornes.neAvantLe = decaler(age.min);
  // âge ≤ max ⇔ né strictement après `jour - (max + 1) ans`
  if (age.max !== undefined) bornes.neApres = decaler(age.max + 1);
  return bornes;
}

/** Date limite pour le critère de dernier contact. */
export function dateLimiteContact(dc: DernierContact, jour: DateISO): DateISO {
  return ajouterJours(jour, -dc.jours);
}

/** Un numéro de voie satisfait-il le critère de rue (plage + côté) ? */
export function numeroCorrespond(rue: FiltreRue, numero: number | null): boolean {
  const sansPlage = rue.numeroMin === undefined && rue.numeroMax === undefined && rue.cote === "tous";
  if (sansPlage) return true;
  if (numero === null) return false;
  if (rue.numeroMin !== undefined && numero < rue.numeroMin) return false;
  if (rue.numeroMax !== undefined && numero > rue.numeroMax) return false;
  if (rue.cote === "pair" && numero % 2 !== 0) return false;
  if (rue.cote === "impair" && numero % 2 === 0) return false;
  return true;
}

// ─── Géométrie (sélection sur la carte) ───────────────────────────────────────

const RAYON_TERRE_M = 6_371_000;

/** Distance en mètres entre deux coordonnées [lat, lon] (haversine). */
export function distanceMetres(a: Coordonnee, b: Coordonnee): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h));
}

/** Point dans un polygone (lancer de rayon). */
export function pointDansPolygone(p: Coordonnee, polygone: Coordonnee[]): boolean {
  let dedans = false;
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const [yi, xi] = polygone[i];
    const [yj, xj] = polygone[j];
    const croise = yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi;
    if (croise) dedans = !dedans;
  }
  return dedans;
}

export function pointDansZone(p: Coordonnee, zone: ZoneCarte): boolean {
  return zone.type === "cercle" ? distanceMetres(p, zone.centre) <= zone.rayonMetres : pointDansPolygone(p, zone.points);
}

/** Rectangle englobant [latMin, lonMin, latMax, lonMax] — pré-filtre indexable côté SQL. */
export function rectangleEnglobant(zone: ZoneCarte): [number, number, number, number] {
  if (zone.type === "cercle") {
    const dLat = (zone.rayonMetres / RAYON_TERRE_M) * (180 / Math.PI);
    const dLon = dLat / Math.cos((zone.centre[0] * Math.PI) / 180);
    return [zone.centre[0] - dLat, zone.centre[1] - dLon, zone.centre[0] + dLat, zone.centre[1] + dLon];
  }
  const lats = zone.points.map((p) => p[0]);
  const lons = zone.points.map((p) => p[1]);
  return [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)];
}

// ─── Puces de filtres actifs ──────────────────────────────────────────────────

export type CleCritere =
  | "recherche"
  | "age"
  | "sexes"
  | "vitSeul"
  | "deplacements"
  | "handicap"
  | "apa"
  | "girs"
  | "niveaux"
  | "statuts"
  | "tags"
  | "dernierContact"
  | "indisponible"
  | "assignesA"
  | "quartiers"
  | "zone"
  | "ids"
  | `rues.${number}`;

export type Puce = { cle: CleCritere; libelle: string };

const ouiNon = (v: boolean, oui: string, non: string) => (v ? oui : non);
const enumerer = (valeurs: string[]) => valeurs.join(", ");

export function libelleRue(r: FiltreRue): string {
  const morceaux = [r.voie];
  const cote = r.cote === "pair" ? "pairs" : r.cote === "impair" ? "impairs" : null;
  if (r.numeroMin !== undefined && r.numeroMax !== undefined) morceaux.push(`${cote ?? "n°"} ${r.numeroMin} à ${r.numeroMax}`);
  else if (r.numeroMin !== undefined) morceaux.push(`${cote ?? "n°"} à partir du ${r.numeroMin}`);
  else if (r.numeroMax !== undefined) morceaux.push(`${cote ?? "n°"} jusqu'au ${r.numeroMax}`);
  else if (cote) morceaux.push(cote);
  return morceaux.join(", ");
}

export function libelleDernierContact(dc: DernierContact): string {
  return dc.sens === "moins_de" ? `Contacté il y a moins de ${dc.jours} jours` : `Sans contact depuis plus de ${dc.jours} jours`;
}

/** Libellés lisibles des critères actifs (les noms d'utilisateurs sont fournis par l'appelant). */
export function decrireFiltre(filtre: Filtre, noms: { utilisateurs?: Record<string, string> } = {}): Puce[] {
  const f = normaliserFiltre(filtre);
  const puces: Puce[] = [];
  if (f.recherche) puces.push({ cle: "recherche", libelle: `« ${f.recherche} »` });
  if (f.age) {
    const { min, max } = f.age;
    const libelle = min !== undefined && max !== undefined ? `${min} à ${max} ans` : min !== undefined ? `${min} ans et plus` : `${max} ans et moins`;
    puces.push({ cle: "age", libelle });
  }
  if (f.sexes) puces.push({ cle: "sexes", libelle: enumerer(f.sexes.map((s) => SEXE_LIBELLES[s])) });
  if (f.vitSeul !== undefined) puces.push({ cle: "vitSeul", libelle: ouiNon(f.vitSeul, "Vit seul(e)", "Ne vit pas seul(e)") });
  if (f.deplacements) puces.push({ cle: "deplacements", libelle: `Mobilité : ${enumerer(f.deplacements.map((d) => DEPLACEMENT_LIBELLES[d]))}` });
  if (f.handicap !== undefined) puces.push({ cle: "handicap", libelle: ouiNon(f.handicap, "Avec handicap", "Sans handicap") });
  if (f.apa !== undefined) puces.push({ cle: "apa", libelle: ouiNon(f.apa, "Bénéficie de l'APA", "Sans APA") });
  if (f.girs) puces.push({ cle: "girs", libelle: `GIR ${enumerer(f.girs.map(String))}` });
  if (f.niveaux) puces.push({ cle: "niveaux", libelle: `Priorité ${enumerer(f.niveaux)}` });
  if (f.statuts) puces.push({ cle: "statuts", libelle: `Fiche ${enumerer(f.statuts.map((s) => STATUT_FICHE_LIBELLES[s].toLowerCase()))}` });
  if (f.tags) puces.push({ cle: "tags", libelle: `Tag : ${enumerer(f.tags)}` });
  if (f.dernierContact) puces.push({ cle: "dernierContact", libelle: libelleDernierContact(f.dernierContact) });
  if (f.indisponible !== undefined) puces.push({ cle: "indisponible", libelle: ouiNon(f.indisponible, "Indisponible en ce moment", "Disponible en ce moment") });
  if (f.assignesA) {
    const n = f.assignesA.map((id) => noms.utilisateurs?.[id] ?? "Utilisateur inconnu");
    puces.push({ cle: "assignesA", libelle: `Assigné à ${enumerer(n)}` });
  }
  f.rues?.forEach((r, i) => puces.push({ cle: `rues.${i}`, libelle: libelleRue(r) }));
  if (f.quartiers) puces.push({ cle: "quartiers", libelle: `Quartier : ${enumerer(f.quartiers)}` });
  if (f.zone) puces.push({ cle: "zone", libelle: f.zone.type === "cercle" ? `Cercle de ${Math.round(f.zone.rayonMetres)} m sur la carte` : "Zone dessinée sur la carte" });
  if (f.ids) puces.push({ cle: "ids", libelle: `${f.ids.length} personne${f.ids.length > 1 ? "s" : ""} choisie${f.ids.length > 1 ? "s" : ""}` });
  return puces;
}

/** Retire un critère (clic sur la croix d'une puce). */
export function retirerCritere(filtre: Filtre, cle: CleCritere): Filtre {
  const f = { ...normaliserFiltre(filtre) };
  if (cle.startsWith("rues.")) {
    const index = Number(cle.slice(5));
    f.rues = f.rues?.filter((_, i) => i !== index);
  } else {
    delete f[cle as Exclude<CleCritere, `rues.${number}`>];
  }
  return normaliserFiltre(f);
}

/** Bascule une valeur dans un critère multiple (case cochée / décochée). */
export function basculerValeur<K extends "sexes" | "deplacements" | "girs" | "niveaux" | "statuts" | "tags" | "assignesA" | "quartiers">(
  filtre: Filtre,
  cle: K,
  valeur: NonNullable<Filtre[K]>[number],
): Filtre {
  const actuelles = (filtre[cle] ?? []) as (typeof valeur)[];
  const suivantes = actuelles.includes(valeur) ? actuelles.filter((v) => v !== valeur) : [...actuelles, valeur];
  return normaliserFiltre({ ...filtre, [cle]: suivantes });
}
