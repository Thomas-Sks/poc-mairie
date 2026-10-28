/**
 * E7-US1 / E7-US5 — Saisie du formulaire public étape par étape.
 * `Saisie` est l'état brut du brouillon (chaînes saisies, sauvegardé dans le navigateur) ;
 * `saisieVersReponses` le convertit en réponses typées, validées par le schéma de chaque étape.
 */
import { z } from "zod";
import { normaliserDate, normaliserTelephone } from "@/shared/domain/normalisation";
import type {
  Categorie,
  Deplacement,
  ModeDeVie,
  Protection,
  Relation,
  TypeIndisponibilite,
} from "@/shared/domain/vocabulaire";
import {
  absenceSchema,
  adresseSchema,
  champsFormulaire,
  formulaireInscriptionSchema,
  intervenantSchema,
  personneSchema,
  regleTiers,
  TYPES_INTERVENANT_FORMULAIRE,
  type FormulaireInscription,
} from "./formulaire";

export type TypeIntervenantFormulaire = (typeof TYPES_INTERVENANT_FORMULAIRE)[number];

export type PersonneSaisie = {
  civilite: "" | "Mme" | "M.";
  nom: string;
  prenom: string;
  /** Saisie libre JJ/MM/AAAA. */
  dateNaissance: string;
  telephone: string;
  email: string;
  deplacement: "" | Deplacement;
  protection: "" | Protection;
  protectionStructure: string;
  protectionTelephone: string;
};

export type IntervenantSaisie = {
  type: TypeIntervenantFormulaire;
  nom: string;
  telephone: string;
  possedeCles: boolean;
  joursPassage: number[];
  heurePassage: string;
  heureFinPassage: string;
};

export type ContactSaisie = {
  prenom: string;
  nom: string;
  relation: "" | Relation;
  telephone: string;
  possedeCles: boolean;
  ville: string;
};

export type AbsenceSaisie = { type: TypeIndisponibilite; debut: string; fin: string };

export type AdresseSaisie = {
  /** Libellé affiché dans le champ d'autocomplétion. */
  libelle: string;
  banId: string;
  numero: string;
  rep: string;
  voie: string;
  lon: number | null;
  lat: number | null;
  residence: string;
  batiment: string;
  entree: string;
  appartement: string;
  etage: string;
  ascenseur: boolean | null;
};

export type Saisie = {
  remplisseur: "" | "moi" | "tiers";
  personneInformee: boolean | null;
  tiers: { prenom: string; nom: string; lien: string; telephone: string };
  nombrePersonnes: 1 | 2;
  personnes: [PersonneSaisie, PersonneSaisie];
  adresse: AdresseSaisie;
  modeDeVie: "" | ModeDeVie;
  categorie: "" | Categorie;
  servicesADomicile: boolean | null;
  intervenants: IntervenantSaisie[];
  contactsUrgence: ContactSaisie[];
  absences: AbsenceSaisie[];
  sousLesToits: boolean | null;
  pieceFraiche: boolean | null;
  troublesAuditifs: boolean | null;
  preferenceHoraire: string;
  accordAppelIa: boolean | null;
  consentement: boolean;
};

export const personneVide = (): PersonneSaisie => ({
  civilite: "",
  nom: "",
  prenom: "",
  dateNaissance: "",
  telephone: "",
  email: "",
  deplacement: "",
  protection: "",
  protectionStructure: "",
  protectionTelephone: "",
});

export const contactVide = (): ContactSaisie => ({ prenom: "", nom: "", relation: "", telephone: "", possedeCles: false, ville: "" });

export const intervenantVide = (type: TypeIntervenantFormulaire): IntervenantSaisie => ({
  type,
  nom: "",
  telephone: "",
  possedeCles: false,
  joursPassage: [],
  heurePassage: "",
  heureFinPassage: "",
});

export const saisieVide = (): Saisie => ({
  remplisseur: "",
  personneInformee: null,
  tiers: { prenom: "", nom: "", lien: "", telephone: "" },
  nombrePersonnes: 1,
  personnes: [personneVide(), personneVide()],
  adresse: {
    libelle: "",
    banId: "",
    numero: "",
    rep: "",
    voie: "",
    lon: null,
    lat: null,
    residence: "",
    batiment: "",
    entree: "",
    appartement: "",
    etage: "",
    ascenseur: null,
  },
  modeDeVie: "",
  categorie: "",
  servicesADomicile: null,
  intervenants: [],
  contactsUrgence: [contactVide()],
  absences: [],
  sousLesToits: null,
  pieceFraiche: null,
  troublesAuditifs: null,
  preferenceHoraire: "",
  accordAppelIa: null,
  consentement: false,
});

// ─── Conversion saisie → réponses ─────────────────────────────────────────────

const vide = (v: string) => (v.trim() === "" ? undefined : v.trim());
const choix = <T extends string>(v: "" | T) => (v === "" ? undefined : v);
const oui = (v: boolean | null) => (v === null ? undefined : v);
/** Un numéro reconnu est remis au format « 06 12 34 56 78 » ; sinon on garde la saisie (le schéma l'explique). */
const tel = (v: string) => (v.trim() === "" ? "" : (normaliserTelephone(v) ?? v.trim()));
const date = (v: string) => (v.trim() === "" ? undefined : (normaliserDate(v) ?? v.trim()));
const entier = (v: string) => {
  if (v.trim() === "") return undefined;
  const n = Number(v.trim().replace(/^rdc$/i, "0"));
  return Number.isInteger(n) ? n : Number.NaN;
};

/** Convertit le brouillon en objet à valider (les champs non remplis deviennent `undefined`). */
export function saisieVersReponses(s: Saisie) {
  const personnes = s.personnes.slice(0, s.nombrePersonnes).map((p) => ({
    civilite: choix(p.civilite),
    nom: vide(p.nom),
    prenom: vide(p.prenom),
    dateNaissance: date(p.dateNaissance),
    telephone: tel(p.telephone),
    email: p.email.trim(),
    deplacement: choix(p.deplacement),
    protection: choix(p.protection),
    protectionStructure: p.protection && p.protection !== "non" ? vide(p.protectionStructure) : undefined,
    protectionTelephone: p.protection && p.protection !== "non" ? tel(p.protectionTelephone) : "",
  }));
  const a = s.adresse;
  return {
    remplisseur: choix(s.remplisseur),
    personneInformee: s.remplisseur === "tiers" ? oui(s.personneInformee) : undefined,
    tiers:
      s.remplisseur === "tiers"
        ? { prenom: vide(s.tiers.prenom), nom: s.tiers.nom.trim(), lien: vide(s.tiers.lien), telephone: tel(s.tiers.telephone) }
        : undefined,
    personnes,
    adresse: {
      banId: vide(a.banId),
      numero: entier(a.numero),
      rep: vide(a.rep),
      voie: vide(a.voie),
      lon: a.lon ?? undefined,
      lat: a.lat ?? undefined,
      residence: vide(a.residence),
      batiment: vide(a.batiment),
      entree: vide(a.entree),
      appartement: vide(a.appartement),
      etage: entier(a.etage),
      ascenseur: oui(a.ascenseur),
    },
    modeDeVie: choix(s.modeDeVie),
    categorie: choix(s.categorie),
    servicesADomicile: oui(s.servicesADomicile),
    intervenants:
      s.servicesADomicile === false
        ? []
        : s.intervenants.map((i) => ({
            type: i.type,
            nom: vide(i.nom),
            telephone: tel(i.telephone),
            possedeCles: i.possedeCles,
            joursPassage: [...i.joursPassage].sort(),
            heurePassage: i.heurePassage,
            heureFinPassage: i.heureFinPassage,
          })),
    contactsUrgence: s.contactsUrgence.map((c) => ({
      prenom: vide(c.prenom),
      nom: vide(c.nom),
      relation: choix(c.relation),
      telephone: c.telephone.trim() === "" ? undefined : tel(c.telephone),
      possedeCles: c.possedeCles,
      ville: vide(c.ville),
    })),
    absences: s.absences.map((x) => ({ type: x.type, debut: vide(x.debut), fin: vide(x.fin) })),
    sousLesToits: oui(s.sousLesToits),
    pieceFraiche: oui(s.pieceFraiche),
    troublesAuditifs: oui(s.troublesAuditifs),
    preferenceHoraire: vide(s.preferenceHoraire),
    accordAppelIa: oui(s.accordAppelIa),
    consentement: s.consentement,
  };
}

// ─── Étapes ───────────────────────────────────────────────────────────────────

const identite = personneSchema.pick({ civilite: true, nom: true, prenom: true, dateNaissance: true, telephone: true, email: true });
const situationPersonne = personneSchema
  .pick({ deplacement: true, protection: true, protectionStructure: true, protectionTelephone: true })
  .refine((p) => p.protection === "non" || (p.protectionStructure ?? "").length > 0, {
    path: ["protectionStructure"],
    message: "Indiquez la structure ou la personne qui exerce la mesure",
  });

export const ETAPES: readonly { titre: string; schema: z.ZodType }[] = [
  {
    titre: "Qui remplit ce formulaire ?",
    schema: champsFormulaire.pick({ remplisseur: true, personneInformee: true, tiers: true }).superRefine(regleTiers),
  },
  {
    titre: "Personne(s) à inscrire",
    schema: z.object({ personnes: z.array(identite).min(1).max(2) }),
  },
  {
    titre: "Adresse du domicile",
    schema: z.object({ adresse: adresseSchema }),
  },
  {
    titre: "Situation personnelle",
    schema: z.object({
      modeDeVie: champsFormulaire.shape.modeDeVie,
      categorie: champsFormulaire.shape.categorie,
      personnes: z.array(situationPersonne),
    }),
  },
  {
    titre: "Intervenants à domicile",
    schema: z
      .object({ servicesADomicile: z.boolean("Répondez oui ou non"), intervenants: z.array(intervenantSchema) })
      .refine((f) => !f.servicesADomicile || f.intervenants.length > 0, {
        path: ["intervenants"],
        message: "Cochez au moins un service, ou répondez « Non » à la question précédente",
      }),
  },
  {
    titre: "Personnes à prévenir en cas d'urgence",
    schema: z.object({ contactsUrgence: champsFormulaire.shape.contactsUrgence }),
  },
  {
    titre: "Absences prévues",
    schema: z.object({ absences: z.array(absenceSchema) }),
  },
  {
    titre: "Informations complémentaires",
    schema: champsFormulaire.pick({ sousLesToits: true, pieceFraiche: true, troublesAuditifs: true, preferenceHoraire: true, accordAppelIa: true }),
  },
  {
    titre: "Consentement et envoi",
    schema: champsFormulaire.pick({ consentement: true }),
  },
];

export const NOMBRE_ETAPES = ETAPES.length;

export type Erreurs = Record<string, string>;

/** Chemin Zod → clé de champ (« personnes.0.nom »). */
export const cleChamp = (path: readonly PropertyKey[]) => path.map(String).join(".");

function erreursDe(issues: readonly z.core.$ZodIssue[]): Erreurs {
  const erreurs: Erreurs = {};
  for (const issue of issues) {
    const cle = cleChamp(issue.path);
    if (!(cle in erreurs)) erreurs[cle] = issue.message;
  }
  return erreurs;
}

/** Valide une étape (index 0 à 8). Renvoie les erreurs par champ, vide si l'étape est complète. */
export function validerEtape(index: number, saisie: Saisie): Erreurs {
  const r = ETAPES[index].schema.safeParse(saisieVersReponses(saisie));
  return r.success ? {} : erreursDe(r.error.issues);
}

/** Validation complète avant envoi (côté client et côté serveur). */
export function validerFormulaire(
  reponses: unknown,
): { ok: true; formulaire: FormulaireInscription } | { ok: false; erreurs: Erreurs } {
  const r = formulaireInscriptionSchema.safeParse(reponses);
  return r.success ? { ok: true, formulaire: r.data } : { ok: false, erreurs: erreursDe(r.error.issues) };
}

/** Le tiers a répondu « non » : l'inscription est bloquée (registre à inscription volontaire). */
export const inscriptionBloquee = (s: Saisie) => s.remplisseur === "tiers" && s.personneInformee === false;

/** Première étape contenant une erreur (pour renvoyer l'utilisateur au bon écran). */
export function premiereEtapeEnErreur(saisie: Saisie): number | null {
  for (let i = 0; i < ETAPES.length; i++) if (Object.keys(validerEtape(i, saisie)).length > 0) return i;
  return null;
}
