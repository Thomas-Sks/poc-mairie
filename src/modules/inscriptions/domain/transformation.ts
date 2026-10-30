/**
 * E7-US2 / E7-US2 bis — Transformation des réponses du formulaire en données du registre :
 * un foyer, 1 ou 2 fiches « en attente de validation » (chacune avec son score RG-01),
 * les contacts du cercle, les prises en charge (avec créneaux de passage) et les indisponibilités.
 * Fonction pure : la persistance est faite par l'infrastructure.
 */
import { extraireFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import type { DateISO } from "@/shared/domain/dates";
import { calculerScore, GRILLE_PAR_DEFAUT, type GrilleScore, type ResultatScore } from "@/shared/domain/priorite";
import { formaterNom, formaterPrenom } from "@/shared/domain/normalisation";
import type {
  CaisseRetraite,
  Categorie,
  Civilite,
  Deplacement,
  ModeDeVie,
  NiveauPriorite,
  Protection,
  Relation,
  Sexe,
  TypeIndisponibilite,
  TypePriseEnCharge,
} from "@/shared/domain/vocabulaire";
import type { FormulaireInscription } from "./formulaire";

export type FoyerACreer = {
  banId: string | null;
  numero: number | null;
  rep: string | null;
  voie: string;
  residence: string | null;
  batiment: string | null;
  entree: string | null;
  appartement: string | null;
  etage: number | null;
  ascenseur: boolean | null;
  codePostal: string;
  ville: string;
  lon: number | null;
  lat: number | null;
  /** Adresse saisie sans passer par l'autocomplétion : à vérifier par le CCAS. */
  adresseAVerifier: boolean;
  typeLogement: "appartement" | null;
  sousLesToits: boolean;
  pieceFraiche: boolean | null;
};

export type FicheACreer = {
  civilite: Civilite;
  sexe: Sexe;
  nom: string;
  prenom: string;
  dateNaissance: DateISO;
  telephoneFixe: string | null;
  telephoneMobile: string | null;
  pasDeTelephone: boolean;
  email: string | null;
  modeDeVie: ModeDeVie;
  categorie: Categorie;
  caisseRetraite: CaisseRetraite | null;
  aideCaisseRetraite: boolean;
  origineInscription: "demande";
  deplacement: Deplacement;
  protection: Protection;
  mandataireStructure: string | null;
  mandataireTelephone: string | null;
  troublesAuditifs: boolean;
  teleassistance: boolean;
  medecinTraitant: string | null;
  creneauxAppel: string | null;
  consentementIa: boolean;
  personneInformee: boolean;
  dateInscription: DateISO;
  consentementDate: DateISO;
  consentementCanal: string;
  statut: "en_attente";
  score: number;
  niveauPriorite: NiveauPriorite;
};

export type ContactACreer = {
  prenom: string;
  nom: string;
  telephone: string;
  ville: string | null;
  relation: Relation;
  possedeCles: boolean;
  rangAppel: number;
};

export type PriseEnChargeACreer = {
  type: TypePriseEnCharge;
  intervenantNom: string;
  telephone: string | null;
  possedeCles: boolean;
  creneau: { joursSemaine: number[]; heureDebut: string; heureFin: string } | null;
};

export type IndisponibiliteACreer = { type: TypeIndisponibilite; debut: DateISO; fin: DateISO; source: string };

export type InscriptionTransformee = {
  foyer: FoyerACreer;
  fiches: (FicheACreer & { criteres: ResultatScore["criteres"] })[];
  /** Partagés par toutes les fiches du foyer (E7-US2 bis). */
  contacts: ContactACreer[];
  prisesEnCharge: PriseEnChargeACreer[];
  indisponibilites: IndisponibiliteACreer[];
};

export type ParametresTransformation = {
  aujourdhui: DateISO;
  commune: { nom: string; codePostal: string };
  grille?: GrilleScore;
};

const ouNull = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

/** Ajoute une heure à « HH:MM » (passage sans heure de fin indiquée). */
export function heurePlusUne(heure: string): string {
  const [h, m] = heure.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function transformerInscription(f: FormulaireInscription, p: ParametresTransformation): InscriptionTransformee {
  const grille = p.grille ?? GRILLE_PAR_DEFAUT;
  const a = f.adresse;

  const foyer: FoyerACreer = {
    banId: ouNull(a.banId),
    numero: a.numero ?? null,
    rep: ouNull(a.rep),
    voie: a.voie.trim(),
    residence: ouNull(a.residence),
    batiment: ouNull(a.batiment),
    entree: ouNull(a.entree),
    appartement: ouNull(a.appartement),
    etage: a.etage ?? null,
    ascenseur: a.ascenseur ?? null,
    codePostal: p.commune.codePostal,
    ville: p.commune.nom,
    lon: a.lon ?? null,
    lat: a.lat ?? null,
    adresseAVerifier: !a.banId,
    typeLogement: a.appartement || a.residence || (a.etage ?? 0) > 0 ? "appartement" : null,
    sousLesToits: f.sousLesToits === true,
    pieceFraiche: f.pieceFraiche ?? null,
  };

  const contacts: ContactACreer[] = f.contactsUrgence.map((c, i) => ({
    prenom: formaterPrenom(c.prenom),
    nom: formaterNom(c.nom),
    telephone: c.telephone,
    ville: ouNull(c.ville),
    relation: c.relation,
    possedeCles: c.possedeCles,
    rangAppel: i + 1,
  }));

  const prisesEnCharge: PriseEnChargeACreer[] = f.intervenants.map((i) => ({
    type: i.type,
    intervenantNom: i.nom.trim(),
    telephone: ouNull(i.telephone),
    possedeCles: i.possedeCles,
    creneau:
      i.joursPassage.length > 0
        ? {
            joursSemaine: [...i.joursPassage].sort((x, y) => x - y),
            heureDebut: i.heurePassage || "09:00",
            heureFin: i.heureFinPassage || heurePlusUne(i.heurePassage || "09:00"),
          }
        : null,
  }));

  // Décret n° 2026-590 : l'APA et la PCH déclarées deviennent des prises en charge (source du score).
  for (const aide of f.aides) {
    if (aide === "apa" || aide === "pch")
      prisesEnCharge.push({ type: aide, intervenantNom: "Département du Nord", telephone: null, possedeCles: false, creneau: null });
  }
  const aideCaisseRetraite = f.aides.includes("aide_caisse");

  const indisponibilites: IndisponibiliteACreer[] = f.absences.map((x) => ({
    type: x.type,
    debut: x.debut,
    fin: x.fin,
    source: "Formulaire d'inscription",
  }));

  const telephonesFoyer = f.personnes.map((pers) => ouNull(pers.telephone)).filter((t): t is string => t !== null);
  const medecin = f.intervenants.find((i) => i.type === "medecin_traitant");

  const fiches = f.personnes.map((pers) => {
    const telephone = ouNull(pers.telephone);
    const mobile = telephone !== null && /^0[67]/.test(telephone);
    const resultat = calculerScore(
      extraireFaits({
        beneficiaire: {
          dateNaissance: pers.dateNaissance,
          modeDeVie: f.modeDeVie,
          deplacement: pers.deplacement,
          protection: pers.protection,
          troublesCognitifs: false,
          // Pas de numéro pour la personne ni pour le foyer : une visite sera nécessaire.
          pasDeTelephone: telephonesFoyer.length === 0,
          retourHospitalisationLe: null,
          gir: null,
          aideCaisseRetraite,
        },
        foyer: { sousLesToits: foyer.sousLesToits, pieceFraiche: foyer.pieceFraiche, etage: foyer.etage, typeLogement: foyer.typeLogement },
        cercle: contacts.map((c) => ({ relation: c.relation, possedeCles: c.possedeCles, ville: c.ville, telephone: c.telephone })),
        prisesEnCharge: prisesEnCharge.map((x) => ({ type: x.type, possedeCles: x.possedeCles, dateFin: null, gir: null })),
        aujourdhui: p.aujourdhui,
      }),
      grille,
    );
    const fiche: FicheACreer & { criteres: ResultatScore["criteres"] } = {
      civilite: pers.civilite,
      sexe: pers.civilite === "Mme" ? "F" : "M",
      nom: formaterNom(pers.nom),
      prenom: formaterPrenom(pers.prenom),
      dateNaissance: pers.dateNaissance,
      telephoneFixe: telephone && !mobile ? telephone : (telephonesFoyer.find((t) => !/^0[67]/.test(t)) ?? null),
      telephoneMobile: telephone && mobile ? telephone : null,
      pasDeTelephone: telephonesFoyer.length === 0,
      email: ouNull(pers.email),
      modeDeVie: f.modeDeVie,
      categorie: f.categorie,
      caisseRetraite: f.caisseRetraite ?? null,
      aideCaisseRetraite,
      origineInscription: "demande",
      deplacement: pers.deplacement,
      protection: pers.protection,
      mandataireStructure: pers.protection !== "non" ? ouNull(pers.protectionStructure) : null,
      mandataireTelephone: pers.protection !== "non" ? ouNull(pers.protectionTelephone) : null,
      troublesAuditifs: f.troublesAuditifs === true,
      teleassistance: f.intervenants.some((i) => i.type === "teleassistance"),
      medecinTraitant: medecin ? medecin.nom.trim() : null,
      creneauxAppel: ouNull(f.preferenceHoraire),
      consentementIa: f.accordAppelIa === true,
      personneInformee: true,
      dateInscription: p.aujourdhui,
      consentementDate: p.aujourdhui,
      consentementCanal: f.remplisseur === "tiers" ? "Formulaire en ligne (rempli par un proche)" : "Formulaire en ligne",
      statut: "en_attente",
      score: resultat.score,
      niveauPriorite: resultat.niveau,
      criteres: resultat.criteres,
    };
    return fiche;
  });

  return { foyer, fiches, contacts, prisesEnCharge, indisponibilites };
}

export type AccuseReception = { canal: "sms" | "email"; destinataire: string };

/**
 * E7-US4 — Accusé de réception au demandeur (simulé dans le POC) : SMS sur un mobile si possible
 * (le proche qui remplit, sinon la personne), sinon email. `null` sans coordonnées exploitables.
 */
export function destinataireAccuse(f: FormulaireInscription): AccuseReception | null {
  const mobiles = [f.remplisseur === "tiers" ? f.tiers?.telephone : undefined, ...f.personnes.map((p) => p.telephone)];
  const mobile = mobiles.find((t): t is string => !!t && /^0[67]/.test(t));
  if (mobile) return { canal: "sms", destinataire: mobile };
  const email = f.personnes.map((p) => p.email).find((e): e is string => !!e);
  return email ? { canal: "email", destinataire: email } : null;
}
