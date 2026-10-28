import type { Canal, Frequence, NiveauAlerte, Ton } from "@/shared/domain/vocabulaire";

export const NIVEAU_ALERTE_LIBELLES: Record<NiveauAlerte, string> = {
  jaune: "Vigilance jaune",
  orange: "Vigilance orange",
  rouge: "Vigilance rouge",
};

export const NIVEAU_ALERTE_TONS: Record<NiveauAlerte, Ton> = { jaune: "warn", orange: "warn", rouge: "err" };

export const CANAL_LIBELLES: Record<Canal, string> = {
  humain: "Appels humains",
  ia: "Appels IA",
  mixte: "Mixte (humains et IA)",
};

export const FREQUENCE_LIBELLES: Record<Frequence, string> = {
  unique: "Un appel unique",
  quotidienne: "Un appel par jour",
  tous_n_jours: "Tous les N jours",
};

/** Sérialisation JSON (Date → chaîne ISO) : même forme pour le rendu serveur et le polling. */
export type Jsonifie<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonifie<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonifie<T[K]> }
      : T;

export const versJson = <T,>(valeur: T): Jsonifie<T> => JSON.parse(JSON.stringify(valeur)) as Jsonifie<T>;

/** Couleurs des statuts sur la carte (mêmes valeurs que les tokens de la DA). */
export const COULEUR_TON: Record<Ton, string> = {
  neutre: "#8a8e96",
  accent: "#1d6670",
  ok: "#2f7a4f",
  warn: "#9a6412",
  err: "#b03a2e",
};

export const nomPersonne = (p: { civilite: string; prenom: string; nom: string }) => `${p.civilite} ${p.prenom} ${p.nom}`;
