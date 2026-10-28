/**
 * E8-US1 / E8-US9 / E8-US10 — Colonnes, tri, pagination, vues sauvegardées et export du tableau.
 */
import { z } from "zod";
import {
  DEPLACEMENT_LIBELLES,
  MODE_DE_VIE_LIBELLES,
  SEXE_LIBELLES,
  STATUT_FICHE_LIBELLES,
  type Civilite,
  type Deplacement,
  type ModeDeVie,
  type NiveauPriorite,
  type Sexe,
  type StatutFiche,
} from "@/shared/domain/vocabulaire";
import { formaterDate } from "@/shared/domain/dates";
import { schemaFiltre, normaliserFiltre, FILTRE_VIDE, type Filtre } from "./filtre";

/** Une ligne du tableau (projection de la fiche, du foyer, des interactions et des assignations). */
export type LigneBeneficiaire = {
  id: string;
  civilite: Civilite;
  nom: string;
  prenom: string;
  dateNaissance: string;
  age: number;
  sexe: Sexe;
  niveau: NiveauPriorite;
  score: number;
  statut: StatutFiche;
  telephone: string | null;
  telephoneMobile: string | null;
  numero: number | null;
  rep: string | null;
  voie: string;
  quartier: string | null;
  modeDeVie: ModeDeVie | null;
  // Colonnes de santé (masquées sans le droit `fiches.sante`)
  deplacement: Deplacement | null;
  gir: number | null;
  handicap: string | null;
  apa: boolean;
  tags: string[];
  dernierContact: string | null; // ISO date-heure
  indisponible: boolean;
  assignes: string[]; // ids d'utilisateurs
  lat: number | null;
  lon: number | null;
};

export const COLONNES = [
  "nom",
  "age",
  "priorite",
  "statut",
  "telephone",
  "adresse",
  "quartier",
  "sexe",
  "modeDeVie",
  "deplacement",
  "gir",
  "apa",
  "handicap",
  "tags",
  "dernierContact",
  "indisponible",
  "assignes",
] as const;
export type Colonne = (typeof COLONNES)[number];

export type DefinitionColonne = {
  libelle: string;
  /** Donnée de santé (E8-US9 : confirmation explicite à l'export, droit `fiches.sante`). */
  sante: boolean;
  triable: boolean;
  visibleParDefaut: boolean;
};

export const DEFINITIONS_COLONNES: Record<Colonne, DefinitionColonne> = {
  nom: { libelle: "Nom", sante: false, triable: true, visibleParDefaut: true },
  age: { libelle: "Âge", sante: false, triable: true, visibleParDefaut: true },
  priorite: { libelle: "Priorité", sante: false, triable: true, visibleParDefaut: true },
  statut: { libelle: "Statut de la fiche", sante: false, triable: true, visibleParDefaut: false },
  telephone: { libelle: "Téléphone", sante: false, triable: false, visibleParDefaut: true },
  adresse: { libelle: "Adresse", sante: false, triable: true, visibleParDefaut: true },
  quartier: { libelle: "Quartier", sante: false, triable: true, visibleParDefaut: false },
  sexe: { libelle: "Sexe", sante: false, triable: true, visibleParDefaut: false },
  modeDeVie: { libelle: "Mode de vie", sante: false, triable: true, visibleParDefaut: false },
  deplacement: { libelle: "Mobilité", sante: true, triable: true, visibleParDefaut: false },
  gir: { libelle: "GIR", sante: true, triable: true, visibleParDefaut: false },
  apa: { libelle: "APA", sante: true, triable: false, visibleParDefaut: false },
  handicap: { libelle: "Handicap", sante: true, triable: false, visibleParDefaut: false },
  tags: { libelle: "Tags", sante: false, triable: false, visibleParDefaut: false },
  dernierContact: { libelle: "Dernier contact", sante: false, triable: true, visibleParDefaut: true },
  indisponible: { libelle: "Disponibilité", sante: false, triable: false, visibleParDefaut: false },
  assignes: { libelle: "Assigné à", sante: false, triable: false, visibleParDefaut: true },
};

export const COLONNES_SANTE = COLONNES.filter((c) => DEFINITIONS_COLONNES[c].sante);
export const COLONNES_TRIABLES = COLONNES.filter((c) => DEFINITIONS_COLONNES[c].triable);
export type ColonneTriable = Colonne;

export const colonnesVisiblesParDefaut = (): Colonne[] => COLONNES.filter((c) => DEFINITIONS_COLONNES[c].visibleParDefaut);

export const contientDonneesSante = (colonnes: readonly Colonne[]) => colonnes.some((c) => DEFINITIONS_COLONNES[c].sante);

/** Retire les colonnes de santé si l'utilisateur n'y a pas droit. */
export function colonnesAutorisees(colonnes: readonly Colonne[], accesSante: boolean): Colonne[] {
  return colonnes.filter((c) => accesSante || !DEFINITIONS_COLONNES[c].sante);
}

// ─── Tri & requête paginée ────────────────────────────────────────────────────

export type Tri = { colonne: Colonne; sens: "asc" | "desc" };

/** Tri par défaut : priorité (P1 d'abord, score décroissant), puis nom. */
export const TRI_PAR_DEFAUT: Tri[] = [{ colonne: "priorite", sens: "asc" }];

export const TAILLES_PAGE = [25, 50, 100] as const;

export const schemaTri = z
  .array(z.object({ colonne: z.enum(COLONNES), sens: z.enum(["asc", "desc"]) }))
  .max(5)
  .transform((tris) => tris.filter((t, i) => DEFINITIONS_COLONNES[t.colonne].triable && tris.findIndex((u) => u.colonne === t.colonne) === i));

export const schemaRequeteTableau = z.object({
  filtre: schemaFiltre.default(FILTRE_VIDE),
  listeId: z.uuid().optional(),
  tri: schemaTri.default(TRI_PAR_DEFAUT),
  page: z.number().int().min(0).max(10_000).default(0),
  taillePage: z.number().int().min(10).max(200).default(50),
});

export type RequeteTableau = {
  filtre: Filtre;
  listeId?: string;
  tri: Tri[];
  page: number;
  taillePage: number;
};

export type ResultatTableau = { lignes: LigneBeneficiaire[]; total: number };

export function lireRequeteTableau(donnee: unknown): RequeteTableau {
  const r = schemaRequeteTableau.parse(donnee);
  return { ...r, filtre: normaliserFiltre(r.filtre as Filtre) };
}

// ─── Vues sauvegardées (E8-US10) ──────────────────────────────────────────────

export type ConfigVue = { colonnes: Colonne[]; filtre: Filtre; tri: Tri[] };

export const schemaConfigVue = z.object({
  colonnes: z
    .array(z.enum(COLONNES))
    .min(1)
    .transform((c) => [...new Set(c)]),
  filtre: schemaFiltre.default(FILTRE_VIDE),
  tri: schemaTri.default(TRI_PAR_DEFAUT),
});

export function lireConfigVue(donnee: unknown): ConfigVue {
  const r = schemaConfigVue.parse(donnee);
  return { colonnes: r.colonnes, tri: r.tri, filtre: normaliserFiltre(r.filtre as Filtre) };
}

// ─── Ordre de priorité & répartition (E8-US6, RG-02) ──────────────────────────

const RANG_NIVEAU: Record<NiveauPriorite, number> = { P1: 0, P2: 1, P3: 2 };

/** RG-02 : P1 avant P2 avant P3 ; à niveau égal, score décroissant ; puis nom. */
export function comparerPriorite(
  a: { niveau: NiveauPriorite; score: number; nom?: string },
  b: { niveau: NiveauPriorite; score: number; nom?: string },
): number {
  return RANG_NIVEAU[a.niveau] - RANG_NIVEAU[b.niveau] || b.score - a.score || (a.nom ?? "").localeCompare(b.nom ?? "", "fr");
}

// ─── Saisie rapide d'un appel (E3-US4) ────────────────────────────────────────

export const RESULTATS_APPEL_RAPIDE = ["joint_ras", "joint_besoin", "non_joint", "messagerie", "numero_invalide"] as const;
export type ResultatAppelRapide = (typeof RESULTATS_APPEL_RAPIDE)[number];
export const RESULTAT_APPEL_LIBELLES: Record<ResultatAppelRapide, string> = {
  joint_ras: "Joint, tout va bien",
  joint_besoin: "Joint, besoin signalé",
  non_joint: "Pas de réponse",
  messagerie: "Messagerie",
  numero_invalide: "Numéro invalide",
};

// ─── Changement de statut groupé (E8-US8) ─────────────────────────────────────

export const STATUTS_GROUPES = ["active", "suspendue", "archivee"] as const satisfies readonly StatutFiche[];
export type StatutGroupe = (typeof STATUTS_GROUPES)[number];

// ─── Export CSV (E8-US9) ──────────────────────────────────────────────────────

const nomComplet = (l: LigneBeneficiaire) => `${l.civilite} ${l.nom} ${l.prenom}`;
export const adresseCourte = (l: Pick<LigneBeneficiaire, "numero" | "rep" | "voie">) =>
  [l.numero !== null ? `${l.numero}${l.rep ? ` ${l.rep}` : ""}` : null, l.voie].filter(Boolean).join(" ");

/** Valeur textuelle d'une cellule (affichage simple et export). */
export function valeurTexte(l: LigneBeneficiaire, c: Colonne, noms: Record<string, string> = {}): string {
  switch (c) {
    case "nom":
      return nomComplet(l);
    case "age":
      return String(l.age);
    case "priorite":
      return `${l.niveau} (${l.score})`;
    case "statut":
      return STATUT_FICHE_LIBELLES[l.statut];
    case "telephone":
      return [l.telephone, l.telephoneMobile].filter(Boolean).join(" / ");
    case "adresse":
      return adresseCourte(l);
    case "quartier":
      return l.quartier ?? "";
    case "sexe":
      return SEXE_LIBELLES[l.sexe];
    case "modeDeVie":
      return l.modeDeVie ? MODE_DE_VIE_LIBELLES[l.modeDeVie] : "";
    case "deplacement":
      return l.deplacement ? DEPLACEMENT_LIBELLES[l.deplacement] : "";
    case "gir":
      return l.gir !== null ? String(l.gir) : "";
    case "apa":
      return l.apa ? "Oui" : "Non";
    case "handicap":
      return l.handicap ?? "";
    case "tags":
      return l.tags.join(", ");
    case "dernierContact":
      return l.dernierContact ? formaterDate(l.dernierContact.slice(0, 10)) : "Jamais";
    case "indisponible":
      return l.indisponible ? "Indisponible" : "Disponible";
    case "assignes":
      return l.assignes.map((id) => noms[id] ?? "").filter(Boolean).join(", ");
  }
}

const echapperCsv = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/**
 * CSV compatible Excel français : séparateur « ; », fin de ligne CRLF, BOM UTF-8.
 * Les cellules commençant par = + - @ sont neutralisées (injection de formules).
 */
export function genererCsv(lignes: LigneBeneficiaire[], colonnes: readonly Colonne[], noms: Record<string, string> = {}): string {
  const neutraliser = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  const entete = colonnes.map((c) => echapperCsv(DEFINITIONS_COLONNES[c].libelle)).join(";");
  const corps = lignes.map((l) => colonnes.map((c) => echapperCsv(neutraliser(valeurTexte(l, c, noms)))).join(";"));
  return `﻿${[entete, ...corps].join("\r\n")}\r\n`;
}
