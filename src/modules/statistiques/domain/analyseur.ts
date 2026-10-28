/**
 * E12-US2 (POC) — « Posez votre question » : un petit analyseur à base de motifs, sans IA.
 * Il traduit une question en filtres AFFICHÉS et MODIFIABLES (jamais de boîte noire) :
 * l'agent voit exactement ce qui a été compris, et ce qui ne l'a pas été.
 */
import { CHAMPS, DECOUPAGES, type ChampId, type DecoupageId, type Sujet } from "./catalogue";
import { definitionVide, type DefinitionRequete, type Filtre, type Referentiels } from "./requete";

export type AnalyseQuestion = {
  definition: DefinitionRequete;
  /** Morceaux de la question reconnus, dans l'ordre (pour l'afficher à l'agent). */
  compris: string[];
  /** Vrai si rien d'utile n'a été reconnu. */
  vide: boolean;
};

export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type Motif = { re: RegExp; filtre?: (m: RegExpMatchArray) => Filtre; sujet?: Sujet; decoupage?: DecoupageId };

const f = (champ: ChampId, valeur: string, operateur: Filtre["operateur"] = "est"): Filtre => ({ champ, operateur, valeur });

const MOTIFS: Motif[] = [
  // Ce que l'on compte
  { re: /\b(appels?|appeles?) (de|en|pendant la) (campagne|canicule|alerte)\b|\bcampagne\b/, sujet: "appels_campagne" },
  { re: /\binteractions?\b|\bvisites?\b|\bcontacts? (passes|realises)\b/, sujet: "interactions" },
  { re: /\binscriptions? (en ligne|recues|deposees)\b|\bformulaires?\b/, sujet: "inscriptions" },
  { re: /\brappels? (en retard|a venir|traites)\b/, sujet: "rappels" },

  // Personne
  { re: /\b(hommes?|messieurs)\b/, filtre: () => f("sexe", "M") },
  { re: /\b(femmes?|dames?|mesdames)\b/, filtre: () => f("sexe", "F") },
  { re: /\b(?:de )?(?:plus de|\+ de|au moins)\s*(\d{2,3}) ans/, filtre: (m) => f("age", m[1], "sup_egal") },
  { re: /\b(\d{2,3}) ans (?:et plus|ou plus)\b/, filtre: (m) => f("age", m[1], "sup_egal") },
  { re: /\b(?:moins de) (\d{2,3}) ans/, filtre: (m) => f("age", String(Number(m[1]) - 1), "inf_egal") },
  { re: /\bapa\b/, filtre: () => f("prise_en_charge", "apa") },
  { re: /\bpch\b/, filtre: () => f("prise_en_charge", "pch") },
  { re: /\bportage (de )?repas\b/, filtre: () => f("prise_en_charge", "portage_repas") },
  { re: /\baide a domicile\b/, filtre: () => f("prise_en_charge", "aide_domicile") },
  { re: /\bssiad\b/, filtre: () => f("prise_en_charge", "ssiad") },
  { re: /\b(teleassistance|telealarme)\b/, filtre: () => f("teleassistance", "oui") },
  {
    re: /\b(gros(ses?)? (probleme|difficulte)s? de (mobilite|deplacement)|forte difficulte|mobilite (tres )?reduite|ne (se deplace|marche) (presque )?plus)\b/,
    filtre: () => f("mobilite", "forte_difficulte"),
  },
  { re: /\b(difficultes? (a|pour) (se deplacer|marcher)|probleme de mobilite)\b/, filtre: () => f("mobilite", "difficulte") },
  { re: /\b(vi(t|vent) seule?s?|seule?s? a (la maison|domicile)|isolee?s?)\b/, filtre: () => f("mode_de_vie", "seul") },
  { re: /\bgir ?([1-6])\b/, filtre: (m) => f("gir", m[1]) },
  { re: /\b(p1|priorite 1|tres prioritaires?)\b/, filtre: () => f("priorite", "P1") },
  { re: /\btroubles? cognitifs?\b|\balzheimer\b/, filtre: () => f("troubles_cognitifs", "oui") },
  { re: /\b(sans|pas de|n'ont pas de) telephone\b/, filtre: () => f("sans_telephone", "oui") },
  { re: /\bnon verifiee?s? depuis (\d{1,2}) mois\b/, filtre: (m) => f("mois_depuis_verification", m[1], "sup_egal") },
  { re: /\bnon verifiee?s? depuis (un|1) an\b/, filtre: () => f("mois_depuis_verification", "12", "sup_egal") },
  { re: /\b(pas|jamais) (ete )?(contacte|appele)e?s? depuis (\d{1,2}) mois\b/, filtre: (m) => f("mois_sans_contact", m[4], "sup_egal") },
  { re: /\badresses? a verifier\b/, filtre: () => f("adresse_a_verifier", "oui") },

  // Campagne
  { re: /\bnon joints?\b|\bpas (ete )?joints?\b/, filtre: () => f("statut_appel", "non_joint") },
  { re: /(?<!non )\bjoints?\b/, filtre: () => f("statut_appel", "joint") },
  { re: /\bpar (l')?ia\b|\bagent vocal\b/, filtre: () => f("canal", "ia") },

  // Découpages
  { re: /\bpar (tranche d'age|age)\b/, decoupage: "tranche_age" },
  { re: /\bpar sexe\b/, decoupage: "sexe" },
  { re: /\bpar quartiers?\b/, decoupage: "quartier" },
  { re: /\bpar gir\b/, decoupage: "gir" },
  { re: /\bpar (niveau de )?priorite\b/, decoupage: "priorite" },
  { re: /\bpar mois\b/, decoupage: "mois" },
  { re: /\bpar (type|nature)\b/, decoupage: "type_interaction" },
  { re: /\bpar besoins?\b/, decoupage: "besoin" },
];

/**
 * Analyse une question. Les filtres « personne » sont gardés quel que soit le sujet reconnu,
 * les filtres incompatibles avec le sujet sont écartés (et donc non affichés comme compris).
 */
export function analyserQuestion(question: string, referentiels: Referentiels): AnalyseQuestion {
  const texte = normaliser(question);
  const definition = definitionVide();
  const compris: string[] = [];
  const filtres: { filtre: Filtre; extrait: string }[] = [];
  let decoupage: DecoupageId | null = null;

  for (const motif of MOTIFS) {
    const m = texte.match(motif.re);
    if (!m) continue;
    if (motif.sujet && definition.sujet === "beneficiaires") {
      definition.sujet = motif.sujet;
      compris.push(m[0]);
    }
    if (motif.filtre) {
      const filtre = motif.filtre(m);
      if (!filtres.some((x) => x.filtre.champ === filtre.champ)) filtres.push({ filtre, extrait: m[0] });
    }
    if (motif.decoupage && !decoupage) {
      decoupage = motif.decoupage;
      compris.push(m[0]);
    }
  }

  for (const q of referentiels.quartiers) {
    const re = new RegExp(`\\b${normaliser(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const m = texte.match(re);
    if (m && !filtres.some((x) => x.filtre.champ === "quartier")) filtres.push({ filtre: f("quartier", q), extrait: m[0] });
  }

  const sujet = definition.sujet;
  const garder = filtres.filter(({ filtre }) => compatible(filtre.champ, sujet));
  definition.filtres = garder.map((x) => x.filtre);
  compris.push(...garder.map((x) => x.extrait));
  if (decoupage && decoupageCompatible(decoupage, sujet)) definition.decoupage = decoupage;

  return { definition, compris, vide: definition.filtres.length === 0 && !definition.decoupage && sujet === "beneficiaires" && compris.length === 0 };
}

const compatible = (c: ChampId, s: Sujet) => (CHAMPS[c].sujets as readonly Sujet[]).includes(s);
const decoupageCompatible = (d: DecoupageId, s: Sujet) => (DECOUPAGES[d].sujets as readonly Sujet[]).includes(s);

/** Questions pré-câblées proposées sous le champ (démo §10.4-2 en premier). */
export const QUESTIONS_SUGGEREES = [
  "Combien d'hommes de plus de 80 ans touchent l'APA et ont une forte difficulté de mobilité ?",
  "Combien de personnes vivent seules, par quartier ?",
  "Combien de femmes de plus de 85 ans sans téléphone ?",
  "Combien de fiches non vérifiées depuis 12 mois, par quartier ?",
  "Combien d'appels de campagne non joints, par besoin ?",
] as const;
