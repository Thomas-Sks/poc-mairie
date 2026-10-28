import "server-only";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { adresses } from "@/shared/infrastructure/db/schema";
import type { SuggestionAdresse } from "../domain/adresse";
import type { Geocodeur } from "../application/ports";

/**
 * Autocomplétion et géocodage via l'API Adresse (BAN, adresse.data.gouv.fr), limités au code postal
 * de la commune. Si l'API ne répond pas (réseau, quota), repli sur la table locale `adresses` (extrait BAN du seed).
 */
const API = "https://api-adresse.data.gouv.fr/search/";

type FeatureBan = {
  geometry: { coordinates: [number, number] };
  properties: { id: string; label: string; score: number; housenumber?: string; street?: string; name: string; postcode: string; city: string; type: string };
};

function decouperNumero(numero: string | undefined): { numero: number | null; rep: string | null } {
  const m = numero?.match(/^(\d+)\s*(.*)$/);
  if (!m) return { numero: null, rep: null };
  return { numero: Number(m[1]), rep: m[2] ? m[2].trim().toLowerCase() : null };
}

async function rechercherBan(recherche: string, codePostal: string): Promise<SuggestionAdresse[]> {
  const url = `${API}?${new URLSearchParams({ q: recherche, postcode: codePostal, limit: "6", autocomplete: "1" })}`;
  const reponse = await fetch(url, { signal: AbortSignal.timeout(2500), cache: "no-store" });
  if (!reponse.ok) throw new Error(`API Adresse : ${reponse.status}`);
  const json = (await reponse.json()) as { features: FeatureBan[] };
  return json.features
    .filter((f) => f.properties.postcode === codePostal)
    .map((f) => {
      const { numero, rep } = decouperNumero(f.properties.housenumber);
      return {
        banId: f.properties.id,
        numero,
        rep,
        voie: f.properties.street ?? f.properties.name,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        libelle: `${f.properties.name}, ${f.properties.postcode} ${f.properties.city}`,
        score: f.properties.score,
        source: "ban" as const,
      };
    });
}

async function rechercherLocale(communeId: string, recherche: string, codePostal: string): Promise<SuggestionAdresse[]> {
  const m = recherche.trim().match(/^(\d+)\s*(bis|ter|quater)?\s*,?\s*(.*)$/i);
  const numero = m ? Number(m[1]) : null;
  const texteVoie = (m ? m[3] : recherche).trim();
  const mots = texteVoie.split(/\s+/).filter((mot) => mot.length >= 2);
  if (!mots.length) return [];

  const conditions = [eq(adresses.communeId, communeId), ...mots.map((mot) => ilike(adresses.voie, `%${mot}%`))];
  if (numero !== null) conditions.push(eq(adresses.numero, numero));
  const lignes = await db
    .select()
    .from(adresses)
    .where(and(...conditions))
    .orderBy(asc(adresses.voie), asc(adresses.numero))
    .limit(6);
  return lignes.map((a) => ({
    banId: a.id,
    numero: a.numero,
    rep: a.rep,
    voie: a.voie,
    lon: a.lon,
    lat: a.lat,
    libelle: `${a.numero}${a.rep ? ` ${a.rep}` : ""} ${a.voie}, ${codePostal}`,
    score: numero !== null ? 0.9 : 0.5,
    source: "locale" as const,
  }));
}

export const geocodeurBan: Geocodeur = {
  async rechercher(communeId, recherche, codePostal) {
    try {
      const resultats = await rechercherBan(recherche, codePostal);
      if (resultats.length) return resultats;
    } catch {
      // API indisponible : on bascule sur le référentiel local.
    }
    return rechercherLocale(communeId, recherche, codePostal);
  },
};
