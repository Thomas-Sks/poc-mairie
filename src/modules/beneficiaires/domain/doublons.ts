/**
 * E1-US1 — Détection de doublon à la création : même nom + date de naissance, ou même téléphone.
 */
import type { DateISO } from "@/shared/domain/dates";

export type IdentiteDoublon = {
  nom: string;
  dateNaissance: DateISO;
  telephones: (string | null)[];
};

export type FicheExistante = IdentiteDoublon & { id: string; prenom: string; civilite: string; statut: string };

export type Doublon = { fiche: FicheExistante; motifs: string[] };

/** « +33 6 12 34 56 78 » → « 0612345678 ». */
export function normaliserTelephone(telephone: string | null | undefined): string | null {
  if (!telephone) return null;
  let chiffres = telephone.replace(/\D/g, "");
  if (chiffres.startsWith("33") && chiffres.length === 11) chiffres = `0${chiffres.slice(2)}`;
  return chiffres.length >= 9 ? chiffres : null;
}

/** Nom comparable : sans accents, sans casse, sans tirets ni espaces superflus. */
export function normaliserNom(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export function trouverDoublons(candidat: IdentiteDoublon, existants: FicheExistante[]): Doublon[] {
  const nom = normaliserNom(candidat.nom);
  const telephones = new Set(candidat.telephones.map(normaliserTelephone).filter((t): t is string => t !== null));

  return existants.flatMap((fiche) => {
    const motifs: string[] = [];
    if (normaliserNom(fiche.nom) === nom && fiche.dateNaissance === candidat.dateNaissance) {
      motifs.push("Même nom et même date de naissance");
    }
    if (fiche.telephones.some((t) => {
      const n = normaliserTelephone(t);
      return n !== null && telephones.has(n);
    })) {
      motifs.push("Même numéro de téléphone");
    }
    return motifs.length ? [{ fiche, motifs }] : [];
  });
}
