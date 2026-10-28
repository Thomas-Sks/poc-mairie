/**
 * E7-US3 / E15-US1 — Détection des doublons : même nom et même date de naissance,
 * ou même numéro de téléphone. Utilisé par la file de validation et par l'import Excel.
 */
import type { DateISO } from "@/shared/domain/dates";
import { chiffresTelephone, cleTexte } from "@/shared/domain/normalisation";

export type IdentiteComparee = {
  nom: string;
  prenom?: string | null;
  dateNaissance: DateISO | null;
  telephones: (string | null | undefined)[];
};

export type FicheExistante = IdentiteComparee & { id: string; libelle: string };

export type MotifDoublon = "identite" | "telephone";

export type Doublon = { id: string; libelle: string; motifs: MotifDoublon[] };

export const MOTIF_DOUBLON_LIBELLES: Record<MotifDoublon, string> = {
  identite: "même nom et même date de naissance",
  telephone: "même numéro de téléphone",
};

/** Nom comparable : sans accents, casse, tirets ni espaces (« Le-Febvre » = « LEFEBVRE »). */
export const cleNom = (nom: string) => cleTexte(nom).replace(/\s/g, "");

function numeros(telephones: IdentiteComparee["telephones"]): Set<string> {
  return new Set(telephones.map((t) => chiffresTelephone(t)).filter((t): t is string => t !== null));
}

export function motifsDoublon(a: IdentiteComparee, b: IdentiteComparee): MotifDoublon[] {
  const motifs: MotifDoublon[] = [];
  if (a.dateNaissance && a.dateNaissance === b.dateNaissance && cleNom(a.nom) === cleNom(b.nom)) motifs.push("identite");
  const telsB = numeros(b.telephones);
  if ([...numeros(a.telephones)].some((t) => telsB.has(t))) motifs.push("telephone");
  return motifs;
}

export function detecterDoublons(candidat: IdentiteComparee, existants: readonly FicheExistante[]): Doublon[] {
  const doublons: Doublon[] = [];
  for (const e of existants) {
    const motifs = motifsDoublon(candidat, e);
    if (motifs.length > 0) doublons.push({ id: e.id, libelle: e.libelle, motifs });
  }
  // Une identité identique est plus probante qu'un téléphone partagé (couple, même ligne fixe).
  return doublons.sort((x, y) => Number(y.motifs.includes("identite")) - Number(x.motifs.includes("identite")));
}
