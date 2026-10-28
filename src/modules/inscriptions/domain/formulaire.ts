/**
 * E7-US1 — Modèle du formulaire public d'inscription (reprise du formulaire PAU 2026).
 * Schéma Zod partagé entre le formulaire (client), la soumission (serveur) et le seed.
 * Les schémas par étape (validation au fil de l'eau) sont dans `etapes.ts`.
 */
import { z } from "zod";
import {
  CATEGORIES,
  DEPLACEMENTS,
  MODES_DE_VIE,
  PROTECTIONS,
  RELATIONS,
  TYPES_INDISPONIBILITE,
  TYPES_PRISE_EN_CHARGE,
} from "@/shared/domain/vocabulaire";

const telephone = z
  .string("Indiquez le numéro de téléphone")
  .trim()
  .regex(/^0[1-9](\s?\d{2}){4}$/, "Numéro attendu au format 06 12 34 56 78");
const telephoneFacultatif = z.union([telephone, z.literal("")]).optional();
const heure = z.string().regex(/^\d{2}:\d{2}$/, "Heure attendue au format 09:30");

export const personneSchema = z.object({
  civilite: z.enum(["Mme", "M."], "Choisissez Madame ou Monsieur"),
  nom: z.string("Indiquez le nom").trim().min(1, "Indiquez le nom"),
  prenom: z.string("Indiquez le prénom").trim().min(1, "Indiquez le prénom"),
  dateNaissance: z.iso.date("Date de naissance attendue au format JJ/MM/AAAA, par exemple 12/03/1938"),
  telephone: telephoneFacultatif,
  email: z.union([z.email("Adresse email invalide, par exemple jean.dupont@exemple.fr"), z.literal("")]).optional(),
  // Étape 4 — situation propre à chaque personne (chaque fiche a son propre score, E7-US2).
  deplacement: z.enum(DEPLACEMENTS, "Indiquez comment la personne se déplace dans son domicile"),
  protection: z.enum(PROTECTIONS, "Indiquez s'il existe une mesure de protection"),
  protectionStructure: z.string().trim().optional(),
  protectionTelephone: telephoneFacultatif,
});

/** Types d'intervenants proposés par le formulaire PAU (ordre du formulaire papier). */
export const TYPES_INTERVENANT_FORMULAIRE = [
  "aide_domicile",
  "portage_repas",
  "soins_infirmiers",
  "teleassistance",
  "kine",
  "medecin_traitant",
] as const satisfies readonly (typeof TYPES_PRISE_EN_CHARGE)[number][];

export const intervenantSchema = z
  .object({
    type: z.enum(TYPES_PRISE_EN_CHARGE),
    nom: z.string("Indiquez le nom de l'intervenant ou du service").trim().min(1, "Indiquez le nom de l'intervenant ou du service"),
    telephone: telephoneFacultatif,
    possedeCles: z.boolean().default(false),
    /** Ajout plateforme : jours (1 = lundi) et heures de passage habituels, facultatifs (E6-US3). */
    joursPassage: z.array(z.number().int().min(1).max(7)).default([]),
    heurePassage: z.union([heure, z.literal("")]).optional(),
    heureFinPassage: z.union([heure, z.literal("")]).optional(),
  })
  .refine((i) => !i.heurePassage || !i.heureFinPassage || i.heureFinPassage > i.heurePassage, {
    path: ["heureFinPassage"],
    message: "L'heure de fin doit être après l'heure de début",
  });

export const contactUrgenceSchema = z.object({
  prenom: z.string("Indiquez le prénom").trim().min(1, "Indiquez le prénom"),
  nom: z.string("Indiquez le nom").trim().min(1, "Indiquez le nom"),
  relation: z.enum(RELATIONS, "Indiquez le lien avec la personne"),
  telephone,
  possedeCles: z.boolean().default(false),
  ville: z.string().trim().optional(),
});

export const absenceSchema = z
  .object({
    type: z.enum(TYPES_INDISPONIBILITE).default("vacances"),
    debut: z.iso.date("Indiquez la date de départ"),
    fin: z.iso.date("Indiquez la date de retour"),
  })
  .refine((a) => a.fin >= a.debut, { path: ["fin"], message: "La date de retour doit être après la date de départ" });

export const adresseSchema = z.object({
  banId: z.string().optional(),
  numero: z.number().int().optional(),
  rep: z.string().optional(),
  voie: z.string("Indiquez la rue").trim().min(1, "Indiquez la rue"),
  lon: z.number().optional(),
  lat: z.number().optional(),
  residence: z.string().optional(),
  batiment: z.string().optional(),
  entree: z.string().optional(),
  appartement: z.string().optional(),
  etage: z.number("Étage attendu en chiffres (0 pour le rez-de-chaussée)").int().min(0).max(40).optional(),
  ascenseur: z.boolean().optional(),
});

export const champsFormulaire = z.object({
  // 1. Qui remplit ?
  remplisseur: z.enum(["moi", "tiers"], "Indiquez qui remplit le formulaire"),
  personneInformee: z.boolean().optional(),
  tiers: z
    .object({
      prenom: z.string().trim().optional(),
      nom: z.string().trim(),
      lien: z.string().trim().optional(),
      telephone: telephoneFacultatif,
    })
    .optional(),
  // 2. Personne(s) concernée(s)
  personnes: z.array(personneSchema).min(1).max(2),
  // 3. Adresse
  adresse: adresseSchema,
  // 4. Situation personnelle (foyer)
  modeDeVie: z.enum(MODES_DE_VIE, "Indiquez avec qui vit la personne"),
  categorie: z.enum(CATEGORIES, "Indiquez la situation de la personne"),
  // 5. Intervenants à domicile
  servicesADomicile: z.boolean().optional(),
  intervenants: z.array(intervenantSchema).default([]),
  // 6. Personnes à prévenir (1 à 5)
  contactsUrgence: z.array(contactUrgenceSchema).min(1, "Indiquez au moins une personne à prévenir").max(5, "5 personnes au maximum"),
  // 7. Absences prévues
  absences: z.array(absenceSchema).default([]),
  // 8. Ajouts plateforme
  sousLesToits: z.boolean().optional(),
  pieceFraiche: z.boolean().optional(),
  troublesAuditifs: z.boolean().optional(),
  preferenceHoraire: z.string().optional(),
  accordAppelIa: z.boolean().optional(),
  // 9. Consentement
  consentement: z.literal(true, "Cochez la case pour accepter et valider l'inscription"),
});

type ChampsTiers = Pick<z.infer<typeof champsFormulaire>, "remplisseur" | "personneInformee" | "tiers">;

/** Règles de l'étape 1 (tiers), partagées entre le schéma complet et le schéma d'étape. */
export function regleTiers(f: ChampsTiers, ctx: z.RefinementCtx) {
  if (f.remplisseur !== "tiers") return;
  if (f.personneInformee !== true) {
    ctx.addIssue({
      code: "custom",
      path: ["personneInformee"],
      message: "L'inscription au registre est volontaire : la personne concernée doit être informée et d'accord.",
    });
  }
  if (!f.tiers?.nom) ctx.addIssue({ code: "custom", path: ["tiers", "nom"], message: "Indiquez votre nom" });
  if (!f.tiers?.telephone) ctx.addIssue({ code: "custom", path: ["tiers", "telephone"], message: "Indiquez votre numéro de téléphone" });
}

export const formulaireInscriptionSchema = champsFormulaire.superRefine(regleTiers);

export type FormulaireInscription = z.infer<typeof formulaireInscriptionSchema>;
export type PersonneFormulaire = z.infer<typeof personneSchema>;
export type IntervenantFormulaire = z.infer<typeof intervenantSchema>;
export type ContactUrgenceFormulaire = z.infer<typeof contactUrgenceSchema>;
