/**
 * Définition d'une requête statistique (E12-US1) : type pur, sérialisable en JSON, validé par Zod.
 * C'est ce qui est enregistré dans `requetes_stat.definition` et dans les widgets de dashboards.
 */
import { z } from "zod";
import {
  CHAMPS,
  CHAMP_IDS,
  DECOUPAGES,
  DECOUPAGE_IDS,
  OPERATEURS,
  OPERATEUR_LIBELLES,
  SUJETS,
  TYPES_GRAPHIQUE,
  champ,
  type ChampId,
  type DecoupageId,
  type Operateur,
  type Option,
  type Sujet,
  type TypeGraphique,
} from "./catalogue";

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

export const schemaPeriode = z
  .object({ du: dateIso, au: dateIso })
  .refine((p) => p.du <= p.au, { message: "La date de début doit précéder la date de fin." });
export type Periode = z.infer<typeof schemaPeriode>;

export const schemaFiltre = z.object({
  champ: z.enum(CHAMP_IDS as [ChampId, ...ChampId[]]),
  operateur: z.enum(OPERATEURS),
  valeur: z.string().trim().min(1).max(100),
});
export type Filtre = z.infer<typeof schemaFiltre>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Message d'erreur si le filtre est incohérent avec le sujet, sinon null. */
export function erreurFiltre(sujet: Sujet, f: Filtre): string | null {
  const def = champ(f.champ);
  if (!def.sujets.includes(sujet)) return `« ${def.libelle} » ne s'applique pas à ce que vous comptez.`;
  if (!def.operateurs.includes(f.operateur)) return `Comparaison impossible pour « ${def.libelle} ».`;
  if (def.type === "nombre") {
    if (!/^\d{1,3}$/.test(f.valeur)) return `« ${def.libelle} » attend un nombre entier.`;
    const n = Number(f.valeur);
    if ((def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max)) return `Valeur hors limites pour « ${def.libelle} ».`;
  } else if (def.type === "oui_non") {
    if (f.valeur !== "oui" && f.valeur !== "non") return `« ${def.libelle} » attend oui ou non.`;
  } else if (Array.isArray(def.options)) {
    if (!def.options.some((o) => o.valeur === f.valeur)) return `Valeur inconnue pour « ${def.libelle} ».`;
  } else if (def.options === "campagnes" && !UUID.test(f.valeur)) {
    return "Campagne inconnue.";
  }
  return null;
}

export const schemaDefinition = z
  .object({
    sujet: z.enum(SUJETS),
    filtres: z.array(schemaFiltre).max(12),
    decoupage: z.enum(DECOUPAGE_IDS as [DecoupageId, ...DecoupageId[]]).nullable(),
    periode: schemaPeriode.nullable(),
    comparaison: schemaPeriode.nullable(),
    graphique: z.enum(TYPES_GRAPHIQUE).nullable(),
  })
  .superRefine((d, ctx) => {
    d.filtres.forEach((f, i) => {
      const erreur = erreurFiltre(d.sujet, f);
      if (erreur) ctx.addIssue({ code: "custom", message: erreur, path: ["filtres", i] });
    });
    if (d.decoupage && !(DECOUPAGES[d.decoupage].sujets as readonly Sujet[]).includes(d.sujet)) {
      ctx.addIssue({ code: "custom", message: "Ce découpage ne s'applique pas à ce que vous comptez.", path: ["decoupage"] });
    }
    if (d.comparaison && !d.periode) {
      ctx.addIssue({ code: "custom", message: "Choisissez d'abord une période à comparer.", path: ["comparaison"] });
    }
  });
export type DefinitionRequete = z.infer<typeof schemaDefinition>;

export function definitionVide(sujet: Sujet = "beneficiaires"): DefinitionRequete {
  return { sujet, filtres: [], decoupage: null, periode: null, comparaison: null, graphique: null };
}

/** Lecture tolérante d'une définition stockée (JSONB) : null si elle n'est plus valide. */
export function lireDefinition(brut: unknown): DefinitionRequete | null {
  const r = schemaDefinition.safeParse(brut);
  return r.success ? r.data : null;
}

/** Change de sujet en ne gardant que les filtres et le découpage encore applicables. */
export function changerSujet(d: DefinitionRequete, sujet: Sujet): DefinitionRequete {
  return {
    ...d,
    sujet,
    filtres: d.filtres.filter((f) => (CHAMPS[f.champ].sujets as readonly Sujet[]).includes(sujet)),
    decoupage: d.decoupage && (DECOUPAGES[d.decoupage].sujets as readonly Sujet[]).includes(sujet) ? d.decoupage : null,
    graphique: null,
  };
}

/** Filtre proposé quand l'agent choisit un champ : opérateur et valeur par défaut. */
export function nouveauFiltre(id: ChampId, referentiels: Referentiels): Filtre {
  const def = champ(id);
  const operateur: Operateur = def.operateurs[0];
  if (def.type === "nombre") return { champ: id, operateur, valeur: def.defaut ?? "1" };
  if (def.type === "oui_non") return { champ: id, operateur, valeur: "oui" };
  const opts = optionsDuChamp(id, referentiels);
  return { champ: id, operateur, valeur: opts[0]?.valeur ?? "" };
}

// ─── Référentiels de la commune (options dynamiques) ─────────────────────────

export type Referentiels = {
  quartiers: string[];
  campagnes: { id: string; nom: string }[];
};

export function optionsDuChamp(id: ChampId, r: Referentiels): Option[] {
  const def = champ(id);
  if (def.options === "quartiers") return r.quartiers.map((q) => ({ valeur: q, libelle: q }));
  if (def.options === "campagnes") return r.campagnes.map((c) => ({ valeur: c.id, libelle: c.nom }));
  return def.options ?? [];
}

// ─── Phrases affichées ────────────────────────────────────────────────────────

/** « Sexe = Homme », « Âge ≥ 80 ans », « Mobilité = forte difficulté… ». */
export function decrireFiltre(f: Filtre, r: Referentiels): string {
  const def = champ(f.champ);
  const symbole = OPERATEUR_LIBELLES[f.operateur].symbole;
  if (def.type === "oui_non") return f.valeur === "oui" ? def.libelle : `${def.libelle} : non`;
  if (def.type === "nombre") return `${def.libelle} ${symbole} ${f.valeur}${def.unite ? ` ${def.unite}` : ""}`;
  const option = optionsDuChamp(f.champ, r).find((o) => o.valeur === f.valeur);
  return `${def.libelle} ${symbole} ${option?.libelle ?? f.valeur}`;
}

export function decrireFiltres(d: DefinitionRequete, r: Referentiels): string {
  return d.filtres.length ? d.filtres.map((f) => decrireFiltre(f, r)).join(" et ") : "Aucun filtre";
}

export type { TypeGraphique };
