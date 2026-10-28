/**
 * E15-US1 (étapes 4 et 5) — Analyse des lignes d'un fichier Excel de mairie : application de la
 * correspondance, normalisation (dates françaises, téléphones), contrôles ligne par ligne
 * (date invalide, téléphone mal formé, doublon) et rapport CSV des lignes rejetées.
 */
import { calculerAge, type DateISO } from "@/shared/domain/dates";
import {
  cleTexte,
  estMobile,
  formaterNom,
  formaterPrenom,
  normaliserDate,
  normaliserTelephone,
} from "@/shared/domain/normalisation";
import type { Civilite, Deplacement, ModeDeVie, Protection, Relation, Sexe } from "@/shared/domain/vocabulaire";
import { detecterDoublons, MOTIF_DOUBLON_LIBELLES, motifsDoublon, type FicheExistante } from "@/modules/inscriptions/domain/doublons";
import { DEFINITIONS, estChampListe, suggererValeur, type ChampImport, type Destination } from "./champs";

/** Champ → valeur brute (clé normalisée) → valeur retenue ("" = ignorer la valeur). */
export type CorrespondanceValeurs = Partial<Record<ChampImport, Record<string, string>>>;

export type ParametresImport = {
  entetes: string[];
  destinations: Destination[];
  valeurs: CorrespondanceValeurs;
};

export type FicheImport = {
  civilite: Civilite;
  sexe: Sexe;
  nom: string;
  prenom: string;
  dateNaissance: DateISO;
  telephoneFixe: string | null;
  telephoneMobile: string | null;
  email: string | null;
  adresse: { numero: number | null; rep: string | null; voie: string; voieReconnue: boolean; complement: string | null; etage: number | null };
  modeDeVie: ModeDeVie | null;
  deplacement: Deplacement | null;
  protection: Protection;
  teleassistance: boolean;
  medecinTraitant: string | null;
  contact: { prenom: string | null; nom: string; telephone: string | null; relation: Relation; ville: string | null } | null;
  notes: string[];
};

export type LigneAnalysee = {
  /** Numéro de ligne dans le fichier (1 = première ligne du tableur). */
  numero: number;
  brut: string[];
  /** Identité lisible de la ligne, même rejetée (« Mme Simone LECLERCQ »). */
  libelle: string;
  fiche: FicheImport | null;
  erreurs: string[];
  avertissements: string[];
};

// ─── Adresse ──────────────────────────────────────────────────────────────────

const ABREVIATIONS: Record<string, string> = {
  r: "rue",
  av: "avenue",
  ave: "avenue",
  bd: "boulevard",
  bld: "boulevard",
  bvd: "boulevard",
  pl: "place",
  all: "allee",
  imp: "impasse",
  ch: "chemin",
  che: "chemin",
  sq: "square",
  res: "residence",
  rte: "route",
  st: "saint",
  ste: "sainte",
  pass: "passage",
  sen: "sentier",
};

/** Clé de voie comparable : « R. V. Hugo » ≈ « rue v hugo », « Av de Dunkerque » ≈ « avenue de dunkerque ». */
export const cleVoie = (voie: string) =>
  cleTexte(voie)
    .split(" ")
    .map((m) => ABREVIATIONS[m] ?? m)
    .join(" ");

/** « 12 bis, rue Victor Hugo 59160 Lomme » → { numero: 12, rep: "bis", voie: "rue Victor Hugo" }. */
export function decouperAdresse(adresse: string): { numero: number | null; rep: string | null; voie: string } {
  const sansVille = adresse
    .replace(/\b\d{5}\b.*$/, "")
    .replace(/[,\s]+(lomme|lille)\s*$/i, "")
    .trim();
  const m = sansVille.match(/^(\d+)\s*(bis|ter|quater|b|t)?\b[\s,]*(.+)$/i);
  if (!m) return { numero: null, rep: null, voie: sansVille.replace(/^[,\s]+|[,\s]+$/g, "") };
  return { numero: Number(m[1]), rep: m[2] ? m[2].toLowerCase() : null, voie: m[3].replace(/[,\s]+$/, "").trim() };
}

/** Retrouve la voie officielle (BAN) correspondant à une saisie, ou `null`. */
export function trouverVoie(saisie: string, voiesConnues: readonly string[]): string | null {
  const cle = cleVoie(saisie);
  if (!cle) return null;
  const exacte = voiesConnues.find((v) => cleVoie(v) === cle);
  if (exacte) return exacte;
  // « rue v hugo » : chaque mot saisi est le début d'un mot de la voie, dans l'ordre.
  const mots = cle.split(" ");
  const candidates = voiesConnues.filter((v) => {
    const ref = cleVoie(v).split(" ");
    let j = 0;
    for (const m of mots) {
      while (j < ref.length && !ref[j].startsWith(m)) j++;
      if (j === ref.length) return false;
      j++;
    }
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

// ─── Identité ─────────────────────────────────────────────────────────────────

/** « DUPONT Jean-Pierre » ou « Dupont Jean » → { nom, prenom } (le nom est en capitales ou en premier). */
export function decouperNomPrenom(valeur: string): { nom: string; prenom: string } {
  const mots = valeur.trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { nom: mots[0] ?? "", prenom: "" };
  const capitales = mots.filter((m) => /\p{L}/u.test(m) && m === m.toLocaleUpperCase("fr-FR"));
  if (capitales.length > 0 && capitales.length < mots.length) {
    return { nom: capitales.join(" "), prenom: mots.filter((m) => !capitales.includes(m)).join(" ") };
  }
  return { nom: mots[0], prenom: mots.slice(1).join(" ") };
}

// ─── Valeurs de listes (étape 3) ──────────────────────────────────────────────

export type ValeurAMapper = { cle: string; exemple: string; occurrences: number };

/** Valeurs distinctes de chaque colonne « liste » du fichier, à faire correspondre aux valeurs de la plateforme. */
export function valeursAMapper(lignes: readonly (readonly string[])[], destinations: readonly Destination[]): { champ: ChampImport; valeurs: ValeurAMapper[] }[] {
  const resultat: { champ: ChampImport; valeurs: ValeurAMapper[] }[] = [];
  destinations.forEach((d, i) => {
    if (!estChampListe(d)) return;
    const parCle = new Map<string, ValeurAMapper>();
    for (const ligne of lignes) {
      const brut = String(ligne[i] ?? "").trim();
      const cle = cleTexte(brut);
      if (!cle) continue;
      const v = parCle.get(cle) ?? { cle, exemple: brut, occurrences: 0 };
      v.occurrences += 1;
      parCle.set(cle, v);
    }
    resultat.push({ champ: d, valeurs: [...parCle.values()].sort((a, b) => b.occurrences - a.occurrences) });
  });
  return resultat;
}

/** Correspondance initiale : celle sauvegardée si elle existe, sinon la suggestion automatique. */
export function correspondanceValeursInitiale(
  aMapper: ReturnType<typeof valeursAMapper>,
  sauvegardee: CorrespondanceValeurs = {},
): CorrespondanceValeurs {
  const resultat: CorrespondanceValeurs = {};
  for (const { champ, valeurs } of aMapper) {
    resultat[champ] = Object.fromEntries(valeurs.map((v) => [v.cle, sauvegardee[champ]?.[v.cle] ?? suggererValeur(champ, v.exemple) ?? ""]));
  }
  return resultat;
}

// ─── Analyse ──────────────────────────────────────────────────────────────────

const estVide = (ligne: readonly string[]) => ligne.every((c) => String(c ?? "").trim() === "");

export function valeurListe(p: ParametresImport, champ: ChampImport, brut: string): string | null {
  const choix = p.valeurs[champ]?.[cleTexte(brut)];
  return choix === undefined || choix === "" ? null : choix;
}

export type Referentiel = {
  existants: readonly FicheExistante[];
  voiesConnues: readonly string[];
  aujourdhui: DateISO;
};

export function analyserLigne(ligne: readonly string[], numero: number, p: ParametresImport, ref: Referentiel): LigneAnalysee {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const val = (champ: ChampImport) => {
    const i = p.destinations.indexOf(champ);
    return i < 0 ? "" : String(ligne[i] ?? "").trim();
  };
  const liste = <T extends string>(champ: ChampImport): T | null => {
    const brut = val(champ);
    if (!brut) return null;
    const v = valeurListe(p, champ, brut);
    // Une valeur volontairement ignorée à l'étape 3 ne génère pas d'avertissement ; une valeur jamais vue, si.
    if (v === null && p.valeurs[champ]?.[cleTexte(brut)] === undefined) avertissements.push(`${DEFINITIONS[champ].libelle} « ${brut} » non reconnu(e) : valeur ignorée`);
    return v as T | null;
  };
  const telephone = (champ: ChampImport) => {
    const brut = val(champ);
    if (!brut) return null;
    const t = normaliserTelephone(brut);
    if (!t) erreurs.push(`${DEFINITIONS[champ].libelle} mal formé : « ${brut} »`);
    return t;
  };

  // Identité
  let { nom, prenom } = { nom: val("nom"), prenom: val("prenom") };
  if (!nom && val("nomPrenom")) ({ nom, prenom } = decouperNomPrenom(val("nomPrenom")));
  if (!nom) erreurs.push("Nom manquant");
  if (!prenom) erreurs.push("Prénom manquant");
  const civilite = val("civilite") ? (valeurListe(p, "civilite", val("civilite")) as Civilite | null) : null;
  if (!civilite) erreurs.push(val("civilite") ? `Civilité non reconnue : « ${val("civilite")} »` : "Civilité manquante");

  const ddnBrute = val("dateNaissance");
  const dateNaissance = normaliserDate(ddnBrute, Number(ref.aujourdhui.slice(0, 4)));
  if (!ddnBrute) erreurs.push("Date de naissance manquante");
  else if (!dateNaissance) erreurs.push(`Date de naissance invalide : « ${ddnBrute} »`);
  else if (dateNaissance > ref.aujourdhui || calculerAge(dateNaissance, ref.aujourdhui) > 115) erreurs.push(`Date de naissance improbable : « ${ddnBrute} »`);

  // Téléphones : une colonne générique est rangée en fixe ou mobile selon le préfixe.
  let telephoneFixe = telephone("telephoneFixe");
  let telephoneMobile = telephone("telephoneMobile");
  const generique = telephone("telephone");
  if (generique) {
    if (estMobile(generique)) telephoneMobile ??= generique;
    else telephoneFixe ??= generique;
  }
  const email = val("email") || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.push(`Email mal formé : « ${email} »`);

  // Adresse
  const decoupee = val("adresse") ? decouperAdresse(val("adresse")) : { numero: null, rep: null, voie: "" };
  const numeroBrut = val("numero") ? Number.parseInt(val("numero"), 10) : null;
  const voieSaisie = val("voie") || decoupee.voie;
  const voieOfficielle = voieSaisie ? trouverVoie(voieSaisie, ref.voiesConnues) : null;
  if (!voieSaisie) erreurs.push("Adresse manquante");
  else if (!voieOfficielle) avertissements.push(`Rue « ${voieSaisie} » introuvable dans la Base Adresse Nationale : adresse à vérifier`);
  const etageBrut = val("etage");
  const etage = /^(rdc|rez)/i.test(etageBrut) ? 0 : etageBrut ? Number.parseInt(etageBrut, 10) : null;

  // Personne à prévenir
  const contactNomBrut = val("contactNom");
  const contactTelephone = telephone("contactTelephone");
  const contactIdentite = contactNomBrut ? decouperNomPrenom(contactNomBrut) : null;

  const teleassistance = liste<"oui" | "non">("teleassistance") === "oui";
  const modeDeVie = liste<ModeDeVie>("modeDeVie");
  const deplacement = liste<Deplacement>("deplacement");
  const protection = liste<Protection>("protection");
  const contactRelation = liste<Relation>("contactRelation");
  const notes = p.destinations
    .map((d, i) => (d === "note" && String(ligne[i] ?? "").trim() ? `${p.entetes[i] || "Note"} : ${String(ligne[i]).trim()}` : null))
    .filter((n): n is string => n !== null);

  const fiche: FicheImport | null =
    erreurs.length === 0 && civilite && dateNaissance
      ? {
          civilite,
          sexe: civilite === "Mme" ? "F" : "M",
          nom: formaterNom(nom),
          prenom: formaterPrenom(prenom),
          dateNaissance,
          telephoneFixe,
          telephoneMobile,
          email,
          adresse: {
            numero: numeroBrut !== null && !Number.isNaN(numeroBrut) ? numeroBrut : decoupee.numero,
            rep: decoupee.rep,
            voie: voieOfficielle ?? voieSaisie,
            voieReconnue: voieOfficielle !== null,
            complement: val("complementAdresse") || null,
            etage: etage !== null && !Number.isNaN(etage) ? etage : null,
          },
          modeDeVie,
          deplacement,
          protection: protection ?? "non",
          teleassistance,
          medecinTraitant: val("medecinTraitant") || null,
          contact:
            contactIdentite && contactIdentite.nom
              ? {
                  prenom: contactIdentite.prenom ? formaterPrenom(contactIdentite.prenom) : null,
                  nom: formaterNom(contactIdentite.nom),
                  telephone: contactTelephone,
                  relation: contactRelation ?? "autre",
                  ville: val("contactVille") || null,
                }
              : null,
          notes,
        }
      : null;

  // Doublon avec une fiche existante : la ligne n'est pas importée.
  if (fiche) {
    const [doublon] = detecterDoublons(
      { nom: fiche.nom, prenom: fiche.prenom, dateNaissance: fiche.dateNaissance, telephones: [fiche.telephoneFixe, fiche.telephoneMobile] },
      ref.existants,
    );
    if (doublon) erreurs.push(`Doublon : ${doublon.libelle} existe déjà (${doublon.motifs.map((m) => MOTIF_DOUBLON_LIBELLES[m]).join(", ")})`);
  }

  const libelle = [val("civilite"), prenom, nom.toLocaleUpperCase("fr-FR")].filter(Boolean).join(" ") || `Ligne ${numero}`;
  return { numero, brut: [...ligne], libelle, fiche: erreurs.length === 0 ? fiche : null, erreurs, avertissements };
}

/** Analyse toutes les lignes situées sous l'en-tête. `premiereLigne` = numéro (1-based) de la première ligne de données. */
export function analyserLignes(lignes: readonly (readonly string[])[], premiereLigne: number, p: ParametresImport, ref: Referentiel): LigneAnalysee[] {
  const resultats: LigneAnalysee[] = [];
  lignes.forEach((ligne, i) => {
    if (estVide(ligne)) return;
    const r = analyserLigne(ligne, premiereLigne + i, p, ref);
    // Doublon à l'intérieur du fichier : seule la première occurrence est importée.
    if (r.fiche) {
      const f = r.fiche;
      const precedente = resultats.find(
        (x) => x.fiche && motifsDoublon({ nom: f.nom, dateNaissance: f.dateNaissance, telephones: [] }, { nom: x.fiche.nom, dateNaissance: x.fiche.dateNaissance, telephones: [] }).length > 0,
      );
      if (precedente) {
        r.erreurs.push(`Doublon de la ligne ${precedente.numero} du fichier`);
        r.fiche = null;
      }
    }
    resultats.push(r);
  });
  return resultats;
}

/** Les personnes d'un même logement (même adresse et même complément) partagent un foyer. */
export const cleFoyer = (f: FicheImport) => [cleVoie(f.adresse.voie), f.adresse.numero ?? "", f.adresse.rep ?? "", cleTexte(f.adresse.complement ?? "")].join("|");

// ─── Rapport ──────────────────────────────────────────────────────────────────

const champCsv = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Rapport des lignes rejetées (CSV « ; », lisible par Excel en français). */
export function rapportRejetsCsv(entetes: readonly string[], rejets: readonly LigneAnalysee[]): string {
  const lignes = [
    ["Ligne du fichier", "Motif du rejet", ...entetes],
    ...rejets.map((r) => [String(r.numero), r.erreurs.join(" ; "), ...entetes.map((_, i) => String(r.brut[i] ?? ""))]),
  ];
  // BOM pour qu'Excel lise correctement les accents.
  return `﻿${lignes.map((l) => l.map(champCsv).join(";")).join("\r\n")}\r\n`;
}
