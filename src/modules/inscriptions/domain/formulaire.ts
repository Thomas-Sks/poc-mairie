/**
 * E7-US1 — Modèle du formulaire public d'inscription (reprise du formulaire PAU 2026).
 * Schéma Zod partagé entre le formulaire (client), la soumission (serveur) et le seed.
 */
import { z } from "zod";
import { CATEGORIES, DEPLACEMENTS, MODES_DE_VIE, PROTECTIONS, RELATIONS, TYPES_PRISE_EN_CHARGE } from "@/shared/domain/vocabulaire";

const telephone = z
  .string()
  .trim()
  .regex(/^0[1-9](\s?\d{2}){4}$/, "Numéro attendu au format 06 12 34 56 78");
const telephoneFacultatif = z.union([telephone, z.literal("")]).optional();

export const personneSchema = z.object({
  civilite: z.enum(["Mme", "M."]),
  nom: z.string().trim().min(1, "Indiquez le nom"),
  prenom: z.string().trim().min(1, "Indiquez le prénom"),
  dateNaissance: z.iso.date("Date attendue au format JJ/MM/AAAA"),
  telephone: telephoneFacultatif,
  email: z.union([z.email("Adresse email invalide"), z.literal("")]).optional(),
});

export const intervenantSchema = z.object({
  type: z.enum(TYPES_PRISE_EN_CHARGE),
  nom: z.string().trim().min(1),
  telephone: telephoneFacultatif,
  possedeCles: z.boolean(),
  /** Ajout plateforme : jours (1 = lundi) et heure de passage habituels. */
  joursPassage: z.array(z.number().int().min(1).max(7)).default([]),
  heurePassage: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
});

export const contactUrgenceSchema = z.object({
  prenom: z.string().trim().min(1, "Indiquez le prénom"),
  nom: z.string().trim().min(1, "Indiquez le nom"),
  relation: z.enum(RELATIONS),
  telephone,
  possedeCles: z.boolean(),
  ville: z.string().trim().optional(),
});

export const formulaireInscriptionSchema = z
  .object({
    // 1. Qui remplit ?
    remplisseur: z.enum(["moi", "tiers"]),
    personneInformee: z.boolean().optional(),
    tiers: z.object({ nom: z.string().trim(), telephone: telephoneFacultatif }).optional(),
    // 2. Personne(s) concernée(s)
    personnes: z.array(personneSchema).min(1).max(2),
    // 3. Adresse
    adresse: z.object({
      banId: z.string().optional(),
      numero: z.number().int().optional(),
      rep: z.string().optional(),
      voie: z.string().trim().min(1, "Indiquez la rue"),
      lon: z.number().optional(),
      lat: z.number().optional(),
      residence: z.string().optional(),
      batiment: z.string().optional(),
      entree: z.string().optional(),
      appartement: z.string().optional(),
      etage: z.number().int().min(0).max(40).optional(),
      ascenseur: z.boolean().optional(),
    }),
    // 4. Situation personnelle
    modeDeVie: z.enum(MODES_DE_VIE),
    categorie: z.enum(CATEGORIES),
    deplacement: z.enum(DEPLACEMENTS),
    protection: z.enum(PROTECTIONS),
    protectionStructure: z.string().optional(),
    protectionTelephone: telephoneFacultatif,
    // 5. Intervenants à domicile
    intervenants: z.array(intervenantSchema).default([]),
    // 6. Personnes à prévenir (1 à 5)
    contactsUrgence: z.array(contactUrgenceSchema).min(1, "Indiquez au moins une personne à prévenir").max(5),
    // 7. Absences prévues
    absences: z.array(z.object({ debut: z.iso.date(), fin: z.iso.date() })).default([]),
    // 8. Ajouts plateforme
    sousLesToits: z.boolean().optional(),
    pieceFraiche: z.boolean().optional(),
    troublesAuditifs: z.boolean().optional(),
    preferenceHoraire: z.string().optional(),
    accordAppelIa: z.boolean().optional(),
    // 9. Consentement
    consentement: z.literal(true, "Vous devez accepter pour valider l'inscription"),
  })
  .refine((f) => f.remplisseur === "moi" || f.personneInformee === true, {
    path: ["personneInformee"],
    message: "L'inscription au registre est volontaire : la personne concernée doit être informée et d'accord.",
  });

export type FormulaireInscription = z.infer<typeof formulaireInscriptionSchema>;
