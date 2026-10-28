/**
 * Adresse d'un foyer : suggestions d'autocomplétion (BAN ou référentiel local) et rattachement au quartier.
 */

export type SuggestionAdresse = {
  banId: string;
  numero: number | null;
  rep: string | null;
  voie: string;
  lon: number;
  lat: number;
  libelle: string;
  /** Pertinence 0-1 (fournie par la BAN ; 1 pour une correspondance exacte locale). */
  score: number;
  source: "ban" | "locale";
};

/** Seuil au-dessus duquel un géocodage automatique (sans choix explicite) est accepté. */
export const SEUIL_GEOCODAGE = 0.6;

/** Meilleure suggestion acceptable pour un géocodage automatique, sinon null (→ « adresse à vérifier »). */
export function meilleureCorrespondance(suggestions: SuggestionAdresse[]): SuggestionAdresse | null {
  const meilleure = [...suggestions].sort((a, b) => b.score - a.score)[0];
  return meilleure && meilleure.score >= SEUIL_GEOCODAGE && meilleure.numero !== null ? meilleure : null;
}

/** Point dans un polygone [lon, lat][] (lancer de rayon). */
export function pointDansPolygone(lon: number, lat: number, polygone: [number, number][]): boolean {
  let dedans = false;
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const [xi, yi] = polygone[i];
    const [xj, yj] = polygone[j];
    const croise = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (croise) dedans = !dedans;
  }
  return dedans;
}

export function quartierContenant(lon: number, lat: number, quartiers: { nom: string; contour: [number, number][] }[]): string | null {
  return quartiers.find((q) => pointDansPolygone(lon, lat, q.contour))?.nom ?? null;
}
