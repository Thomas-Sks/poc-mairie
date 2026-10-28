/**
 * E15-US1 (étapes 2 et 3) — Champs de la plateforme proposés à l'import, suggestion automatique
 * de correspondance des colonnes (« Tél » → téléphone, « DDN » → date de naissance) et
 * correspondance des valeurs de listes (« fauteuil », « FR » → Fauteuil roulant).
 */
import { cleTexte } from "@/shared/domain/normalisation";
import {
  DEPLACEMENT_LIBELLES,
  MODE_DE_VIE_LIBELLES,
  PROTECTION_LIBELLES,
  RELATION_LIBELLES,
} from "@/shared/domain/vocabulaire";

export const CHAMPS_IMPORT = [
  "civilite",
  "nom",
  "prenom",
  "nomPrenom",
  "dateNaissance",
  "telephone",
  "telephoneFixe",
  "telephoneMobile",
  "email",
  "adresse",
  "numero",
  "voie",
  "complementAdresse",
  "etage",
  "modeDeVie",
  "deplacement",
  "protection",
  "teleassistance",
  "medecinTraitant",
  "contactNom",
  "contactTelephone",
  "contactRelation",
  "contactVille",
] as const;
export type ChampImport = (typeof CHAMPS_IMPORT)[number];

/** Destination d'une colonne : un champ, une note sur la fiche (E15-US3), ou rien. */
export type Destination = ChampImport | "note" | "ignorer";

export type DefinitionChamp = {
  libelle: string;
  groupe: "Identité" | "Coordonnées" | "Adresse" | "Situation" | "Personne à prévenir";
  synonymes: string[];
  /** Champ à valeurs fixes : ses valeurs passent par l'étape « correspondance des valeurs ». */
  valeurs?: Record<string, string>;
};

export const DEFINITIONS: Record<ChampImport, DefinitionChamp> = {
  civilite: { libelle: "Civilité", groupe: "Identité", synonymes: ["civ", "civilite", "titre", "sexe", "genre", "m mme"], valeurs: { Mme: "Madame", "M.": "Monsieur" } },
  nom: { libelle: "Nom", groupe: "Identité", synonymes: ["nom", "nom usage", "nom d usage", "nom de famille", "patronyme", "nom marital"] },
  prenom: { libelle: "Prénom", groupe: "Identité", synonymes: ["prenom", "prenoms"] },
  nomPrenom: { libelle: "Nom et prénom (même colonne)", groupe: "Identité", synonymes: ["nom prenom", "nom et prenom", "nom prenoms", "identite", "beneficiaire", "nom complet", "personne"] },
  dateNaissance: { libelle: "Date de naissance", groupe: "Identité", synonymes: ["ddn", "date de naissance", "date naissance", "date naiss", "dt naiss", "date de naiss", "ne le", "nee le", "ne e le", "naissance", "dn"] },
  telephone: { libelle: "Téléphone (fixe ou mobile)", groupe: "Coordonnées", synonymes: ["tel", "tel.", "telephone", "tel domicile", "numero de telephone", "n tel", "no tel", "num tel", "telephone domicile"] },
  telephoneFixe: { libelle: "Téléphone fixe", groupe: "Coordonnées", synonymes: ["tel fixe", "fixe", "telephone fixe", "ligne fixe"] },
  telephoneMobile: { libelle: "Téléphone mobile", groupe: "Coordonnées", synonymes: ["portable", "mobile", "tel portable", "tel mobile", "gsm", "telephone portable", "telephone mobile", "port"] },
  email: { libelle: "Email", groupe: "Coordonnées", synonymes: ["email", "e mail", "mail", "courriel", "adresse mail", "adresse email"] },
  adresse: { libelle: "Adresse complète (numéro et rue)", groupe: "Adresse", synonymes: ["adresse", "adresse complete", "domicile", "adresse postale", "adr"] },
  numero: { libelle: "Numéro dans la rue", groupe: "Adresse", synonymes: ["numero", "n rue", "n voie", "no voie", "numero voie", "num voie", "numero de rue"] },
  voie: { libelle: "Rue", groupe: "Adresse", synonymes: ["rue", "voie", "nom de rue", "libelle voie", "nom voie"] },
  complementAdresse: { libelle: "Complément d'adresse (résidence, appartement)", groupe: "Adresse", synonymes: ["complement", "complement adresse", "complement d adresse", "residence", "batiment", "bat", "appt", "appartement", "logement"] },
  etage: { libelle: "Étage", groupe: "Adresse", synonymes: ["etage", "niveau", "etg"] },
  modeDeVie: { libelle: "Mode de vie", groupe: "Situation", synonymes: ["vit seul", "vit seule", "seul", "isole", "isolee", "mode de vie", "situation familiale", "situation"], valeurs: MODE_DE_VIE_LIBELLES },
  deplacement: { libelle: "Déplacement dans le domicile", groupe: "Situation", synonymes: ["mobilite", "deplacement", "deplacements", "autonomie", "mode de deplacement"], valeurs: DEPLACEMENT_LIBELLES },
  protection: { libelle: "Mesure de protection", groupe: "Situation", synonymes: ["protection", "mesure de protection", "mesure protection", "tutelle", "curatelle", "tutelle curatelle"], valeurs: PROTECTION_LIBELLES },
  teleassistance: { libelle: "Téléassistance", groupe: "Situation", synonymes: ["teleassistance", "telealarme", "tele assistance", "tele alarme", "teleal", "bip"], valeurs: { oui: "Oui", non: "Non" } },
  medecinTraitant: { libelle: "Médecin traitant", groupe: "Situation", synonymes: ["medecin", "medecin traitant", "docteur", "dr", "mt"] },
  contactNom: { libelle: "Personne à prévenir : nom", groupe: "Personne à prévenir", synonymes: ["personne a prevenir", "contact", "contact urgence", "contact d urgence", "a prevenir", "referent", "famille", "nom contact", "personne a contacter"] },
  contactTelephone: { libelle: "Personne à prévenir : téléphone", groupe: "Personne à prévenir", synonymes: ["tel contact", "telephone contact", "tel personne a prevenir", "tel famille", "tel referent", "tel urgence", "tel a prevenir", "tel contact urgence"] },
  contactRelation: { libelle: "Personne à prévenir : lien", groupe: "Personne à prévenir", synonymes: ["lien", "lien de parente", "parente", "lien contact", "qualite", "lien avec la personne"], valeurs: RELATION_LIBELLES },
  contactVille: { libelle: "Personne à prévenir : ville", groupe: "Personne à prévenir", synonymes: ["ville contact", "commune contact", "ville famille", "ville referent"] },
};

const SYNONYMES_NOTE = ["observations", "observation", "remarques", "remarque", "commentaire", "commentaires", "notes", "note", "infos", "informations", "divers", "obs"];

/** Clé comparable d'un en-tête : sans accents, ponctuation ni casse (« Tél. » → « tel »). */
export const cleEntete = (entete: string) => cleTexte(entete);

/** Correspondance d'un en-tête : synonyme exact (le plus long gagne), puis en-tête commençant par un synonyme. */
function meilleurChamp(entete: string): { champ: Destination; force: number } | null {
  const cle = cleEntete(entete);
  if (!cle) return null;
  if (SYNONYMES_NOTE.includes(cle)) return { champ: "note", force: 100 };
  let meilleur: { champ: Destination; force: number } | null = null;
  for (const champ of CHAMPS_IMPORT) {
    for (const syn of DEFINITIONS[champ].synonymes.map(cleEntete)) {
      let force = 0;
      if (cle === syn) force = 100 + syn.length;
      else if (cle.startsWith(`${syn} `) || cle.endsWith(` ${syn}`)) force = syn.length;
      if (force > (meilleur?.force ?? 0)) meilleur = { champ, force };
    }
  }
  return meilleur;
}

/**
 * Suggère une destination pour chaque colonne. Un champ n'est attribué qu'une fois (à la colonne
 * la plus probante) ; les colonnes inconnues sont ignorées par défaut.
 */
export function suggererCorrespondance(entetes: string[]): Destination[] {
  const candidats = entetes.map((e, i) => ({ i, ...(meilleurChamp(e) ?? { champ: "ignorer" as Destination, force: 0 }) }));
  const resultat: Destination[] = entetes.map(() => "ignorer");
  const pris = new Set<Destination>();
  for (const c of [...candidats].sort((a, b) => b.force - a.force)) {
    if (c.champ === "ignorer") continue;
    if (c.champ !== "note" && pris.has(c.champ)) continue;
    resultat[c.i] = c.champ;
    pris.add(c.champ);
  }
  return resultat;
}

/** Empreinte d'un format de fichier (E15-US2) : les en-têtes normalisés, dans l'ordre. */
export const signatureFormat = (entetes: string[]) => entetes.map(cleEntete).join("|");

/** Ligne d'en-tête probable : la première ligne qui reconnaît au moins 3 champs (parmi les 15 premières). */
export function detecterLigneEntete(lignes: string[][]): number {
  let meilleure = { index: 0, score: 0 };
  lignes.slice(0, 15).forEach((ligne, index) => {
    const score = ligne.filter((c) => meilleurChamp(String(c ?? "")) !== null).length;
    if (score > meilleure.score) meilleure = { index, score };
  });
  return meilleure.score >= 2 ? meilleure.index : 0;
}

// ─── Correspondance des valeurs (listes) ──────────────────────────────────────

export const estChampListe = (c: Destination): c is ChampImport => c !== "note" && c !== "ignorer" && DEFINITIONS[c].valeurs !== undefined;

const SYNONYMES_VALEURS: Partial<Record<ChampImport, Record<string, string[]>>> = {
  civilite: {
    Mme: ["mme", "madame", "mlle", "melle", "mademoiselle", "f", "femme", "mm"],
    "M.": ["m", "mr", "monsieur", "h", "homme", "m."],
  },
  modeDeVie: {
    seul: ["seul", "seule", "seul e", "oui", "o", "x", "isole", "isolee", "1", "vrai", "celibataire", "veuf", "veuve", "vit seul", "vit seule"],
    couple: ["couple", "en couple", "marie", "mariee", "maries", "conjoint", "avec conjoint", "avec epoux", "avec epouse"],
    tiers: ["tiers", "famille", "avec enfant", "avec un tiers", "en famille", "heberge", "hebergee", "avec sa fille", "avec son fils"],
  },
  deplacement: {
    seul: ["seul", "seule", "autonome", "valide", "ras", "aucun", "aucune", "non", "normal", "sans aide"],
    canne: ["canne", "cannes", "canne anglaise", "cannes anglaises", "baton"],
    deambulateur: ["deambulateur", "deamb", "deambu", "rollator", "cadre de marche", "deambulateur roulettes"],
    fauteuil: ["fauteuil", "fauteuil roulant", "fr", "ufr", "fauteuil electrique", "en fauteuil"],
    immobilise: ["immobilise", "immobilisee", "alite", "alitee", "grabataire", "lit", "au lit", "immobile"],
  },
  protection: {
    non: ["non", "aucune", "aucun", "sans", "n", "0", "ras", "neant"],
    tutelle: ["tutelle", "sous tutelle", "tuteur"],
    curatelle: ["curatelle", "curatelle renforcee", "curatelle simple", "sous curatelle", "curateur"],
    sauvegarde: ["sauvegarde", "sauvegarde de justice", "sdj"],
  },
  teleassistance: {
    oui: ["oui", "o", "x", "1", "vrai", "yes", "ok", "equipe", "equipee", "presence verte", "vitaris", "filien", "bip"],
    non: ["non", "n", "0", "faux", "no", "sans", "aucune"],
  },
  contactRelation: {
    enfant: ["enfant", "fils", "fille", "fils fille", "enfants"],
    conjoint: ["conjoint", "conjointe", "epoux", "epouse", "mari", "femme", "compagnon", "compagne"],
    famille: ["famille", "frere", "soeur", "neveu", "niece", "petit fils", "petite fille", "petit enfant", "cousin", "cousine", "belle fille", "beau fils", "gendre", "bru", "oncle", "tante"],
    voisin: ["voisin", "voisine", "voisins"],
    ami: ["ami", "amie", "amis"],
    gardien: ["gardien", "gardienne", "concierge"],
    tuteur: ["tuteur", "tutrice", "curateur", "curatrice", "mandataire"],
    infirmiere: ["infirmier", "infirmiere", "ide"],
    aide_domicile: ["aide a domicile", "auxiliaire de vie", "aide menagere", "avs"],
    medecin: ["medecin", "docteur"],
    autre: ["autre"],
  },
};

/** Suggestion de valeur de la plateforme pour une valeur brute du fichier (« FR » → fauteuil). `null` si inconnue. */
export function suggererValeur(champ: ChampImport, brut: string): string | null {
  const valeurs = DEFINITIONS[champ].valeurs;
  if (!valeurs) return null;
  const cle = cleTexte(brut);
  if (!cle) return null;
  for (const [valeur, libelle] of Object.entries(valeurs)) {
    if (cle === cleTexte(valeur) || cle === cleTexte(libelle)) return valeur;
  }
  const synonymes = SYNONYMES_VALEURS[champ] ?? {};
  for (const [valeur, liste] of Object.entries(synonymes)) if (liste.includes(cle)) return valeur;
  for (const [valeur, liste] of Object.entries(synonymes)) if (liste.some((s) => s.length > 3 && cle.startsWith(s))) return valeur;
  return null;
}
