/**
 * E9-US7 : rapport de campagne (statistiques, situations signalées). Fonction pure.
 */
import type { Besoin, StatutCible } from "@/shared/domain/vocabulaire";
import type { DateISO } from "@/shared/domain/dates";

export type CibleRapport = {
  beneficiaireId: string;
  vagueDate: DateISO;
  statut: StatutCible;
  exclue: boolean;
  canal: "humain" | "ia";
  nbTentatives: number;
  besoins: Besoin[];
};

/** Statuts qui constituent une « situation signalée » dans le rapport. */
export const STATUTS_SIGNALES: ReadonlySet<StatutCible> = new Set([
  "danger",
  "evacuation",
  "joint_besoin",
  "escalade_humain",
  "non_joint_a_traiter",
]);

export type StatistiquesRapport = {
  personnes: number;
  vagues: DateISO[];
  contactsPrevus: number;
  appelsPasses: number;
  joints: number;
  couvertsPassage: number;
  couvertsProche: number;
  absents: number;
  besoins: number;
  dangers: number;
  evacuations: number;
  nonJointsATraiter: number;
  appelsIa: number;
  tauxCouverture: number;
  besoinsParType: Partial<Record<Besoin, number>>;
  parVague: { vague: DateISO; total: number; couverts: number; signales: number }[];
};

const COUVERTS: ReadonlySet<StatutCible> = new Set(["joint_ras", "joint_besoin", "couvert_proche", "couvert_passage", "absent"]);

export function calculerStatistiques(cibles: CibleRapport[]): StatistiquesRapport {
  const vagues = [...new Set(cibles.map((c) => c.vagueDate))].sort();
  const compter = (s: StatutCible) => cibles.filter((c) => c.statut === s).length;
  const besoinsParType: Partial<Record<Besoin, number>> = {};
  for (const c of cibles) for (const b of c.besoins) besoinsParType[b] = (besoinsParType[b] ?? 0) + 1;
  const couverts = cibles.filter((c) => COUVERTS.has(c.statut)).length;
  return {
    personnes: new Set(cibles.map((c) => c.beneficiaireId)).size,
    vagues,
    contactsPrevus: cibles.length,
    appelsPasses: cibles.reduce((n, c) => n + c.nbTentatives, 0),
    joints: compter("joint_ras") + compter("joint_besoin"),
    couvertsPassage: compter("couvert_passage"),
    couvertsProche: compter("couvert_proche"),
    absents: compter("absent"),
    besoins: compter("joint_besoin"),
    dangers: compter("danger"),
    evacuations: compter("evacuation"),
    nonJointsATraiter: compter("non_joint_a_traiter"),
    appelsIa: cibles.filter((c) => c.canal === "ia" && c.nbTentatives > 0).length,
    tauxCouverture: cibles.length ? Math.round((couverts / cibles.length) * 100) : 0,
    besoinsParType,
    parVague: vagues.map((v) => {
      const duJour = cibles.filter((c) => c.vagueDate === v);
      return {
        vague: v,
        total: duJour.length,
        couverts: duJour.filter((c) => COUVERTS.has(c.statut)).length,
        signales: duJour.filter((c) => STATUTS_SIGNALES.has(c.statut)).length,
      };
    }),
  };
}
