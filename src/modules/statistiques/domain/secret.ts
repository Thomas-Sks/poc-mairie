/**
 * E12-US7 — Secret statistique : sans droit nominatif, un effectif de 1 à 4 personnes est masqué (« < 5 »)
 * pour éviter la ré-identification. Zéro reste affiché (il n'identifie personne).
 * Le masquage est appliqué côté serveur : les valeurs exactes ne quittent pas le serveur.
 */
import type { ResultatRequete } from "./resultat";

export const SEUIL_SECRET = 5;

/** Effectif affichable : un nombre, ou null quand il est masqué. */
export type Effectif = number | null;

export function masquerEffectif(n: number, secret: boolean): Effectif {
  return secret && n > 0 && n < SEUIL_SECRET ? null : n;
}

export function formaterEffectif(e: Effectif): string {
  return e === null ? `< ${SEUIL_SECRET}` : e.toLocaleString("fr-FR");
}

export type LigneAffichee = { cle: string; libelle: string; n: Effectif; nComparaison: Effectif | null; libelleComparaison?: string };
export type ResultatAffiche = Omit<ResultatRequete, "total" | "totalComparaison" | "lignes"> & {
  total: Effectif;
  totalComparaison: Effectif | null;
  lignes: LigneAffichee[];
  /** Le secret statistique a été appliqué à ce résultat. */
  secret: boolean;
};

export function appliquerSecret(r: ResultatRequete, secret: boolean): ResultatAffiche {
  return {
    decoupage: r.decoupage,
    secret,
    total: masquerEffectif(r.total, secret),
    totalComparaison: r.totalComparaison === null ? null : masquerEffectif(r.totalComparaison, secret),
    lignes: r.lignes.map((l) => ({
      ...l,
      n: masquerEffectif(l.n, secret),
      nComparaison: l.nComparaison === null ? null : masquerEffectif(l.nComparaison, secret),
    })),
  };
}

/** Le secret s'impose sans droit nominatif ; avec ce droit, l'agent peut l'activer (diffusion externe). */
export function secretApplicable(aDroitNominatif: boolean, demande: boolean): boolean {
  return !aDroitNominatif || demande;
}
