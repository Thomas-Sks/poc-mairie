/**
 * Validation Zod à la frontière (Server Actions) : FormData → entrées typées des cas d'usage.
 */
import { z } from "zod";
import {
  BESOINS,
  CATEGORIES,
  CIVILITES,
  DEPLACEMENTS,
  MODES_DE_VIE,
  MOTIFS_ARCHIVAGE,
  NIVEAUX_PRIORITE,
  PREFERENCES_CONTACT,
  PROTECTIONS,
  RELATIONS,
  SEXES,
  STATUTS_CIBLE,
  TYPES_INDISPONIBILITE,
  TYPES_INTERACTION,
  TYPES_LOGEMENT,
  TYPES_PRISE_EN_CHARGE,
} from "@/shared/domain/vocabulaire";
import type { SaisieFiche } from "../domain/fiche";

// ─── Briques ─────────────────────────────────────────────────────────────────

const vide = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const texteOpt = z.preprocess((v) => (vide(v) ? null : String(v).trim()), z.string().max(2000).nullable());
const texte = (message: string) => z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().min(1, message).max(500));
const booleen = z.preprocess((v) => v === "on" || v === "true" || v === "oui" || v === "1", z.boolean());
/** Oui / Non / non renseigné. */
const ouiNon = z.preprocess((v) => (v === "oui" ? true : v === "non" ? false : null), z.boolean().nullable());
const entierOpt = (min: number, max: number, message: string) =>
  z.preprocess((v) => (vide(v) ? null : Number(v)), z.number({ message }).int(message).min(min, message).max(max, message).nullable());
const nombreOpt = z.preprocess((v) => (vide(v) ? null : Number(String(v).replace(",", "."))), z.number({ message: "Nombre attendu" }).min(0).max(200).nullable());
const enumOpt = <T extends readonly [string, ...string[]]>(valeurs: T) => z.preprocess((v) => (vide(v) ? null : v), z.enum(valeurs).nullable());
const dateOpt = z.preprocess((v) => (vide(v) ? null : v), z.iso.date("Date invalide").nullable());
const date = (message: string) => z.preprocess((v) => (vide(v) ? undefined : v), z.iso.date(message));
const heure = z.string().regex(/^\d{2}:\d{2}$/, "Heure attendue (ex. 08:30)");
const uuidOpt = z.preprocess((v) => (vide(v) ? null : v), z.uuid().nullable());
const telephoneOpt = z.preprocess(
  (v) => (vide(v) ? null : String(v).trim()),
  z
    .string()
    .regex(/^(\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/, "Numéro attendu au format 06 12 34 56 78")
    .nullable(),
);
const emailOpt = z.preprocess((v) => (vide(v) ? null : String(v).trim()), z.email("Adresse email invalide").nullable());
const liste = <T extends z.ZodType>(element: T) => z.preprocess((v) => (Array.isArray(v) ? v : vide(v) ? [] : [v]), z.array(element));

/** FormData → objet ; les clés listées dans `multiples` sont lues avec getAll(). */
export function lireFormData(fd: FormData, multiples: string[] = []): Record<string, unknown> {
  const objet: Record<string, unknown> = {};
  for (const cle of new Set(fd.keys())) {
    objet[cle] = multiples.includes(cle) ? fd.getAll(cle) : fd.get(cle);
  }
  for (const cle of multiples) objet[cle] ??= [];
  return objet;
}

/** Première erreur par champ, pour affichage sous chaque contrôle. */
export function erreursParChamp(erreur: z.ZodError): Record<string, string> {
  const champs: Record<string, string> = {};
  for (const issue of erreur.issues) {
    const cle = String(issue.path[0] ?? "formulaire");
    champs[cle] ??= issue.message;
  }
  return champs;
}

// ─── Fiche ───────────────────────────────────────────────────────────────────

export const MULTIPLES_FICHE = ["tags", "appareillage"];

export const ficheSchema = z.object({
  // Identité
  civilite: z.enum(CIVILITES, "Choisissez la civilité"),
  nom: texte("Indiquez le nom"),
  nomNaissance: texteOpt,
  prenom: texte("Indiquez le prénom"),
  sexe: z.enum(SEXES, "Choisissez le sexe"),
  dateNaissance: date("Indiquez la date de naissance"),
  // Coordonnées
  telephoneFixe: telephoneOpt,
  telephoneMobile: telephoneOpt,
  pasDeTelephone: booleen,
  email: emailOpt,
  langue: z.preprocess((v) => (vide(v) ? "Français" : String(v).trim()), z.string()),
  preferenceContact: enumOpt(PREFERENCES_CONTACT),
  creneauxAppel: texteOpt,
  // Adresse (foyer)
  banId: texteOpt,
  numero: entierOpt(0, 9999, "Numéro invalide"),
  rep: texteOpt,
  voie: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string()),
  lon: z.preprocess((v) => (vide(v) ? null : Number(v)), z.number().nullable()),
  lat: z.preprocess((v) => (vide(v) ? null : Number(v)), z.number().nullable()),
  residence: texteOpt,
  batiment: texteOpt,
  entree: texteOpt,
  appartement: texteOpt,
  etage: entierOpt(0, 40, "Étage entre 0 et 40"),
  ascenseur: ouiNon,
  codeAcces: texteOpt,
  typeLogement: enumOpt(TYPES_LOGEMENT),
  sousLesToits: booleen,
  pieceFraiche: ouiNon,
  animaux: texteOpt,
  // Situation
  modeDeVie: enumOpt(MODES_DE_VIE),
  categorie: z.enum(CATEGORIES),
  protection: z.enum(PROTECTIONS),
  mandataireStructure: texteOpt,
  mandataireTelephone: telephoneOpt,
  // Santé
  gir: entierOpt(1, 6, "GIR entre 1 et 6"),
  deplacement: enumOpt(DEPLACEMENTS),
  troublesAuditifs: booleen,
  troublesVisuels: booleen,
  troublesCognitifs: booleen,
  handicap: texteOpt,
  appareillage: liste(z.string().trim().min(1)),
  teleassistance: booleen,
  teleassistanceFournisseur: texteOpt,
  medecinTraitant: texteOpt,
  // Habitudes
  habitudes: texteOpt,
  centresInteret: texteOpt,
  tags: liste(z.string()),
  infoPrioritaire: z.preprocess((v) => (vide(v) ? null : String(v).trim()), z.string().max(140, "140 caractères maximum").nullable()),
  // Consentements
  consentementRegistre: booleen,
  personneInformee: booleen,
  consentementIa: booleen,
  consentementPartage: booleen,
  consentementDate: dateOpt,
  consentementCanal: texteOpt,
});

/** Formulaire plat → saisie structurée du domaine. */
export function versSaisieFiche(d: z.infer<typeof ficheSchema>, avecSante: boolean): SaisieFiche {
  return {
    beneficiaire: {
      civilite: d.civilite,
      nom: d.nom,
      nomNaissance: d.nomNaissance,
      prenom: d.prenom,
      sexe: d.sexe,
      dateNaissance: d.dateNaissance,
      telephoneFixe: d.pasDeTelephone ? null : d.telephoneFixe,
      telephoneMobile: d.pasDeTelephone ? null : d.telephoneMobile,
      pasDeTelephone: d.pasDeTelephone,
      email: d.email,
      langue: d.langue,
      preferenceContact: d.preferenceContact,
      creneauxAppel: d.creneauxAppel,
      modeDeVie: d.modeDeVie,
      categorie: d.categorie,
      protection: d.protection,
      mandataireStructure: d.protection === "non" ? null : d.mandataireStructure,
      mandataireTelephone: d.protection === "non" ? null : d.mandataireTelephone,
      habitudes: d.habitudes,
      centresInteret: d.centresInteret,
      tags: d.tags,
      infoPrioritaire: d.infoPrioritaire,
      consentementRegistre: d.consentementRegistre,
      personneInformee: d.personneInformee,
      consentementIa: d.consentementIa,
      consentementPartage: d.consentementPartage,
      consentementDate: d.consentementDate,
      consentementCanal: d.consentementCanal,
    },
    sante: avecSante
      ? {
          gir: d.gir,
          deplacement: d.deplacement,
          troublesAuditifs: d.troublesAuditifs,
          troublesVisuels: d.troublesVisuels,
          troublesCognitifs: d.troublesCognitifs,
          handicap: d.handicap,
          appareillage: d.appareillage,
          teleassistance: d.teleassistance,
          teleassistanceFournisseur: d.teleassistance ? d.teleassistanceFournisseur : null,
          medecinTraitant: d.medecinTraitant,
        }
      : null,
    foyer: {
      banId: d.banId,
      numero: d.numero,
      rep: d.rep,
      voie: d.voie,
      lon: d.lon,
      lat: d.lat,
      residence: d.residence,
      batiment: d.batiment,
      entree: d.entree,
      appartement: d.appartement,
      etage: d.etage,
      ascenseur: d.ascenseur,
      codeAcces: d.codeAcces,
      typeLogement: d.typeLogement,
      sousLesToits: d.sousLesToits,
      pieceFraiche: d.pieceFraiche,
      animaux: d.animaux,
    },
  };
}

// ─── Actions de fiche ────────────────────────────────────────────────────────

export const archivageSchema = z.object({ motif: z.enum(MOTIFS_ARCHIVAGE, "Choisissez un motif"), commentaire: texteOpt });

export const prioriteSchema = z.object({
  niveau: z.enum([...NIVEAUX_PRIORITE, "auto"], "Choisissez un niveau"),
  justification: texteOpt,
});

// ─── Journal ─────────────────────────────────────────────────────────────────

export const interactionSchema = z.object({
  type: z.enum(TYPES_INTERACTION, "Choisissez le type"),
  survenueLe: z.preprocess((v) => (vide(v) ? undefined : v), z.iso.datetime({ local: true, message: "Date et heure invalides" })),
  dureeMinutes: entierOpt(0, 600, "Durée invalide"),
  interlocuteurContactId: uuidOpt,
  resultat: enumOpt(STATUTS_CIBLE),
  compteRendu: texteOpt,
  besoins: liste(z.enum(BESOINS)),
  actionSuivi: texteOpt,
  echeanceSuivi: dateOpt,
  assigneSuivi: uuidOpt,
});

export const rappelSchema = z.object({
  objet: texte("Indiquez l'objet du rappel"),
  echeance: date("Indiquez la date"),
  assigneA: uuidOpt,
  urgent: booleen,
});

export const indisponibiliteSchema = z.object({
  type: z.enum(TYPES_INDISPONIBILITE, "Choisissez le type"),
  debut: date("Indiquez la date de début"),
  fin: dateOpt,
  jusquANouvelOrdre: booleen,
  joignabilite: texteOpt,
  source: texteOpt,
});

// ─── Cercle ──────────────────────────────────────────────────────────────────

export const contactSchema = z.object({
  contactExistantId: uuidOpt,
  prenom: texteOpt,
  nom: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(200)),
  structure: texteOpt,
  telephone: telephoneOpt,
  telephone2: telephoneOpt,
  email: emailOpt,
  ville: texteOpt,
  disponibilites: texteOpt,
  relation: z.enum(RELATIONS, "Choisissez le lien"),
  rangAppel: z.preprocess((v) => Number(v), z.number().int().min(1, "Rang entre 1 et 20").max(20, "Rang entre 1 et 20")),
  possedeCles: booleen,
  estUrgence: booleen,
  estRepresentantLegal: booleen,
});

// ─── Prises en charge ────────────────────────────────────────────────────────

export const priseEnChargeSchema = z.object({
  type: z.enum(TYPES_PRISE_EN_CHARGE, "Choisissez le type"),
  structureId: uuidOpt,
  intervenantNom: texteOpt,
  telephone: telephoneOpt,
  possedeCles: booleen,
  dateDebut: dateOpt,
  dateFin: dateOpt,
  gir: entierOpt(1, 6, "GIR entre 1 et 6"),
  heuresParSemaine: nombreOpt,
  contactId: uuidOpt,
});

export const creneauSchema = z.object({
  joursSemaine: liste(z.preprocess((v) => Number(v), z.number().int().min(1).max(7))),
  heureDebut: heure,
  heureFin: heure,
  exceptions: liste(z.iso.date("Date invalide")),
});
