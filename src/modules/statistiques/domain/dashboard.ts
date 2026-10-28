/**
 * E12-US3 / US4 — Dashboards : des widgets (chiffre clé, graphique, tableau, carte) alimentés par des requêtes,
 * disposés sur une grille de 12 colonnes. Dashboards prédéfinis livrés par défaut.
 */
import { z } from "zod";
import { ajouterJours, type DateISO } from "@/shared/domain/dates";
import type { ChampId, DecoupageId, Sujet } from "./catalogue";
import { schemaDefinition, type DefinitionRequete, type Filtre, type Periode } from "./requete";

export const TYPES_WIDGET = ["chiffre", "barres", "camembert", "courbe", "carte", "tableau"] as const;
export type TypeWidget = (typeof TYPES_WIDGET)[number];
export const TYPE_WIDGET_LIBELLES: Record<TypeWidget, string> = {
  chiffre: "Chiffre clé",
  barres: "Graphique en barres",
  camembert: "Camembert",
  courbe: "Courbe dans le temps",
  carte: "Carte par quartier",
  tableau: "Tableau",
};

export const COLONNES_GRILLE = 12;

export const schemaDisposition = z.object({
  x: z.number().int().min(0).max(COLONNES_GRILLE - 1),
  y: z.number().int().min(0).max(500),
  w: z.number().int().min(1).max(COLONNES_GRILLE),
  h: z.number().int().min(1).max(12),
});
export type Disposition = z.infer<typeof schemaDisposition>;

export const schemaWidget = z.object({
  id: z.string().min(1).max(64),
  titre: z.string().trim().min(1).max(120),
  type: z.enum(TYPES_WIDGET),
  requete: schemaDefinition,
  layout: schemaDisposition,
});
export type Widget = z.infer<typeof schemaWidget>;

/** Taille par défaut d'un widget selon son type. */
export function tailleParDefaut(type: TypeWidget): Pick<Disposition, "w" | "h"> {
  if (type === "chiffre") return { w: 3, h: 2 };
  if (type === "carte") return { w: 6, h: 5 };
  return { w: 6, h: 4 };
}

/** Place un nouveau widget sous les autres (la grille compacte ensuite vers le haut). */
export function placerNouveau(existants: Pick<Widget, "layout">[], type: TypeWidget): Disposition {
  const bas = existants.reduce((max, w) => Math.max(max, w.layout.y + w.layout.h), 0);
  return { x: 0, y: bas, ...tailleParDefaut(type) };
}

/** Ordre de lecture (haut → bas, gauche → droite) : utilisé pour l'empilement en une colonne sur mobile. */
export function ordreDeLecture<T extends Pick<Widget, "layout">>(widgets: T[]): T[] {
  return [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
}

/** Le découpage qu'un type de widget exige (un graphique sans découpage n'a pas de sens). */
export function widgetCompatible(type: TypeWidget, d: DefinitionRequete): boolean {
  if (type === "chiffre") return true;
  if (!d.decoupage) return false;
  if (type === "carte") return d.decoupage === "quartier";
  if (type === "courbe") return d.decoupage === "mois" || d.decoupage === "jour";
  return true;
}

/**
 * Filtre de période global d'un dashboard (E12-US5). Il s'applique aux événements (interactions, appels,
 * inscriptions, rappels) et aux évolutions dans le temps, mais pas à une photographie de la population.
 */
export function appliquerPeriode(d: DefinitionRequete, periode: Periode | null): DefinitionRequete {
  if (!periode) return d;
  if (d.sujet === "beneficiaires" && d.decoupage !== "mois") return d;
  return { ...d, periode, comparaison: null };
}

// ─── Droits ───────────────────────────────────────────────────────────────────

export type DroitsDashboard = { voir: boolean; modifier: boolean; supprimer: boolean };

/**
 * Un dashboard partagé est visible de toute l'équipe ; seul son auteur (ou un admin) le modifie.
 * Les dashboards prédéfinis ne se suppriment pas et seul un admin en change la disposition.
 */
export function droitsDashboard(
  d: { predefini: boolean; partage: boolean; creePar: string | null },
  u: { id: string; estAdmin: boolean },
): DroitsDashboard {
  if (d.predefini) return { voir: true, modifier: u.estAdmin, supprimer: false };
  const auteur = d.creePar === u.id;
  const voir = d.partage || auteur;
  return { voir, modifier: voir && (auteur || u.estAdmin), supprimer: voir && (auteur || u.estAdmin) };
}

// ─── Dashboards prédéfinis (E12-US4) ──────────────────────────────────────────

type W = Omit<Widget, "id" | "requete"> & { requete: DefinitionRequete };

const req = (sujet: Sujet, filtres: [ChampId, Filtre["operateur"], string][] = [], decoupage: DecoupageId | null = null, periode: Periode | null = null): DefinitionRequete => ({
  sujet,
  filtres: filtres.map(([champ, operateur, valeur]) => ({ champ, operateur, valeur })),
  decoupage,
  periode,
  comparaison: null,
  graphique: null,
});

const w = (titre: string, type: TypeWidget, requete: DefinitionRequete, x: number, y: number, larg: number, haut: number): W => ({
  titre,
  type,
  requete,
  layout: { x, y, w: larg, h: haut },
});

export type DashboardPredefini = { nom: string; widgets: Widget[] };

export function dashboardsPredefinis(p: { jour: DateISO; campagneCaniculeId: string }): DashboardPredefini[] {
  const douzeMois: Periode = { du: ajouterJours(p.jour, -364), au: p.jour };
  const deuxAns: Periode = { du: ajouterJours(p.jour, -729), au: p.jour };
  const canicule: [ChampId, Filtre["operateur"], string] = ["campagne", "est", p.campagneCaniculeId];

  const population: W[] = [
    w("Bénéficiaires suivis", "chiffre", req("beneficiaires"), 0, 0, 3, 2),
    w("Vivent seuls", "chiffre", req("beneficiaires", [["mode_de_vie", "est", "seul"]]), 3, 0, 3, 2),
    w("Forte difficulté de mobilité", "chiffre", req("beneficiaires", [["mobilite", "est", "forte_difficulte"]]), 6, 0, 3, 2),
    w("Bénéficiaires de l'APA", "chiffre", req("beneficiaires", [["prise_en_charge", "est", "apa"]]), 9, 0, 3, 2),
    w("Par tranche d'âge", "barres", req("beneficiaires", [], "tranche_age"), 0, 2, 6, 4),
    w("Par sexe", "camembert", req("beneficiaires", [], "sexe"), 6, 2, 6, 4),
    w("Mobilité", "barres", req("beneficiaires", [], "mobilite"), 0, 6, 4, 4),
    w("GIR", "barres", req("beneficiaires", [], "gir"), 4, 6, 4, 4),
    w("Prises en charge", "barres", req("beneficiaires", [], "prise_en_charge"), 8, 6, 4, 4),
    w("Densité par quartier", "carte", req("beneficiaires", [], "quartier"), 0, 10, 6, 5),
    w("Évolution des inscriptions", "courbe", req("beneficiaires", [], "mois", deuxAns), 6, 10, 6, 5),
  ];

  const activite: W[] = [
    w("Interactions sur 12 mois", "chiffre", req("interactions", [], null, douzeMois), 0, 0, 3, 2),
    w("Sans contact depuis 3 mois", "chiffre", req("beneficiaires", [["mois_sans_contact", "sup_egal", "3"]]), 3, 0, 3, 2),
    w("Rappels en retard", "chiffre", req("rappels", [["etat_rappel", "est", "en_retard"]]), 6, 0, 3, 2),
    w("Visites à domicile sur 12 mois", "chiffre", req("interactions", [["type_interaction", "est", "visite"]], null, douzeMois), 9, 0, 3, 2),
    w("Interactions par mois", "courbe", req("interactions", [], "mois", douzeMois), 0, 2, 8, 4),
    w("Par type d'interaction", "barres", req("interactions", [], "type_interaction", douzeMois), 8, 2, 4, 4),
    w("Rappels par état", "tableau", req("rappels", [], "etat_rappel"), 0, 6, 6, 4),
    w("Sans contact depuis 3 mois, par quartier", "tableau", req("beneficiaires", [["mois_sans_contact", "sup_egal", "3"]], "quartier"), 6, 6, 6, 4),
  ];

  const campagne: W[] = [
    w("Appels prévus", "chiffre", req("appels_campagne", [canicule]), 0, 0, 3, 2),
    w("Joints", "chiffre", req("appels_campagne", [canicule, ["statut_appel", "est", "joint"]]), 3, 0, 3, 2),
    w("Non joints", "chiffre", req("appels_campagne", [canicule, ["statut_appel", "est", "non_joint"]]), 6, 0, 3, 2),
    w("Couverts par un passage", "chiffre", req("appels_campagne", [canicule, ["statut_appel", "est", "couvert_passage"]]), 9, 0, 3, 2),
    w("Résultats des appels", "barres", req("appels_campagne", [canicule], "statut_appel"), 0, 2, 6, 4),
    w("Humain ou IA", "camembert", req("appels_campagne", [canicule], "canal"), 6, 2, 6, 4),
    w("Besoins détectés", "barres", req("appels_campagne", [canicule, ["statut_appel", "est", "joint_besoin"]], "besoin"), 0, 6, 6, 4),
    w("Appels par jour", "barres", req("appels_campagne", [canicule], "jour"), 6, 6, 6, 4),
    w("Où sont les non joints", "carte", req("appels_campagne", [canicule, ["statut_appel", "est", "non_joint"]], "quartier"), 0, 10, 12, 5),
  ];

  const qualite: W[] = [
    w("Non vérifiées depuis 12 mois", "chiffre", req("beneficiaires", [["mois_depuis_verification", "sup_egal", "12"]]), 0, 0, 4, 2),
    w("Sans téléphone", "chiffre", req("beneficiaires", [["sans_telephone", "est", "oui"]]), 4, 0, 4, 2),
    w("Adresses à vérifier", "chiffre", req("beneficiaires", [["adresse_a_verifier", "est", "oui"]]), 8, 0, 4, 2),
    w("Non vérifiées depuis 12 mois, par quartier", "tableau", req("beneficiaires", [["mois_depuis_verification", "sup_egal", "12"]], "quartier"), 0, 2, 6, 5),
    w("Sans téléphone, par quartier", "tableau", req("beneficiaires", [["sans_telephone", "est", "oui"]], "quartier"), 6, 2, 6, 5),
  ];

  const numeroter = (prefixe: string, ws: W[]): Widget[] => ws.map((x, i) => ({ ...x, id: `${prefixe}-${i + 1}` }));
  return [
    { nom: "Population suivie", widgets: numeroter("pop", population) },
    { nom: "Activité annuelle", widgets: numeroter("act", activite) },
    { nom: "Campagne canicule juillet 2026", widgets: numeroter("can", campagne) },
    { nom: "Qualité des données", widgets: numeroter("qua", qualite) },
  ];
}

/** Requêtes enregistrées livrées avec la démo (la première est le scénario §10.4-2). */
export function requetesPredefinies(): { nom: string; definition: DefinitionRequete }[] {
  return [
    {
      nom: "Hommes de 80 ans et plus, APA, forte difficulté de mobilité",
      definition: req(
        "beneficiaires",
        [
          ["sexe", "est", "M"],
          ["age", "sup_egal", "80"],
          ["prise_en_charge", "est", "apa"],
          ["mobilite", "est", "forte_difficulte"],
        ],
        "tranche_age",
      ),
    },
    { nom: "Personnes vivant seules, par quartier", definition: req("beneficiaires", [["mode_de_vie", "est", "seul"]], "quartier") },
    { nom: "Priorité P1, par tranche d'âge", definition: req("beneficiaires", [["priorite", "est", "P1"]], "tranche_age") },
  ];
}
