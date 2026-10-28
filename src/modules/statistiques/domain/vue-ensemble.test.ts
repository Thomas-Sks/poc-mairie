import { describe, expect, it } from "vitest";
import { assemblerVueEnsemble, completerMois, douzeDerniersMois, pourcentage, type IndicateursBruts } from "./vue-ensemble";

const bruts: IndicateursBruts = {
  actifs: 150,
  parNiveau: { P1: 18, P2: 70, P3: 62 },
  inscritsSurPeriode: 20,
  fragilites: { vitSeul: 70, age85: 40, mobiliteReduite: 45, troublesCognitifs: 12, sansAideADomicile: 60, sansTelephone: 3 },
  suivi: { contactes90j: 96, sansContact6Mois: 22, rappelsEnRetard: 2 },
  contactsParMois: [{ mois: "2026-10", appels: 40, appelsAlerte: 0, visites: 5 }],
  quartiers: [
    { nom: "Bourg", total: 20, p1: 2 },
    { nom: "Marais", total: 35, p1: 6 },
  ],
  p1SansContact: [],
  qualite: { aReverifier: 9, adresseAVerifier: 1, inscriptionsEnAttente: 3 },
  derniereAlerte: {
    campagneId: "c",
    nom: "Canicule juillet 2026",
    debut: "2026-07-06",
    fin: "2026-07-09",
    personnes: 140,
    vagues: 4,
    cibles: 560,
    jointesOuCouvertes: 500,
    couvertesParPassage: 60,
    situationsSignalees: 50,
    parIa: 28,
  },
};

describe("vue d'ensemble des statistiques", () => {
  it("calcule des pourcentages entiers, nuls si le total est nul", () => {
    expect(pourcentage(18, 150)).toBe(12);
    expect(pourcentage(1, 3)).toBe(33);
    expect(pourcentage(3, 0)).toBeNull();
  });

  it("produit 12 mois glissants complétés à zéro", () => {
    const mois = douzeDerniersMois("2026-10-28");
    expect(mois).toHaveLength(12);
    expect(mois[0]).toBe("2025-11");
    expect(mois[11]).toBe("2026-10");
    const serie = completerMois([{ mois: "2026-10", appels: 4, appelsAlerte: 2, visites: 1 }], "2026-10-28");
    expect(serie[11]).toEqual({ mois: "2026-10", libelle: "oct. 26", appels: 4, appelsAlerte: 2, visites: 1 });
    expect(serie[0].appels).toBe(0);
  });

  it("assemble les indicateurs : parts, fragilités triées, quartiers triés, taux d'alerte", () => {
    const v = assemblerVueEnsemble(bruts, "2026-10-28");
    expect(v.population.p1).toEqual({ valeur: 18, part: 12 });
    expect(v.suivi.contactes90j.part).toBe(64);
    expect(v.fragilites[0]).toMatchObject({ libelle: "Vivent seules", n: 70, part: 47 });
    expect(v.quartiers.map((q) => q.nom)).toEqual(["Marais", "Bourg"]);
    expect(v.derniereAlerte?.tauxJointesOuCouvertes).toBe(89);
    expect(v.derniereAlerte?.tauxIa).toBe(5);
    expect(v.qualite.sansTelephone).toBe(3);
  });
});
