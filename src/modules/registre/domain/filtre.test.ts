import { describe, expect, it } from "vitest";
import {
  basculerValeur,
  bornesNaissance,
  decrireFiltre,
  deserialiserFiltre,
  distanceMetres,
  estFiltreVide,
  FILTRE_VIDE,
  libelleRue,
  normaliserFiltre,
  numeroCorrespond,
  pointDansPolygone,
  pointDansZone,
  rectangleEnglobant,
  retirerCritere,
  serialiserFiltre,
  validerFiltre,
  type Filtre,
} from "./filtre";

const marais: Filtre = {
  version: 1,
  rues: [{ voie: "Rue du Marais", numeroMin: 1, numeroMax: 41, cote: "impair" }],
};

describe("sérialisation du filtre", () => {
  it("fait l'aller-retour JSON sans perte", () => {
    const filtre: Filtre = {
      version: 1,
      recherche: "dupont",
      age: { min: 80 },
      sexes: ["M"],
      apa: true,
      deplacements: ["fauteuil", "immobilise"],
      niveaux: ["P1"],
      rues: marais.rues,
      zone: { type: "cercle", centre: [50.64, 2.99], rayonMetres: 300 },
    };
    expect(deserialiserFiltre(serialiserFiltre(filtre))).toEqual(normaliserFiltre(filtre));
  });

  it("produit la même chaîne pour deux filtres équivalents", () => {
    const a: Filtre = { version: 1, niveaux: ["P2", "P1"], sexes: [], recherche: "  " };
    const b: Filtre = { version: 1, niveaux: ["P1", "P2", "P1"] };
    expect(serialiserFiltre(a)).toBe(serialiserFiltre(b));
  });

  it("retire les critères vides", () => {
    expect(normaliserFiltre({ version: 1, tags: [], age: {}, recherche: "" })).toEqual(FILTRE_VIDE);
    expect(estFiltreVide({ version: 1, quartiers: [] })).toBe(true);
    expect(estFiltreVide(marais)).toBe(false);
  });

  it("accepte un filtre stocké sans version (rétrocompatibilité)", () => {
    const r = validerFiltre({ niveaux: ["P1"] });
    expect(r).toEqual({ ok: true, filtre: { version: 1, niveaux: ["P1"] } });
  });

  it("lève une erreur sur un JSON illisible", () => {
    expect(() => deserialiserFiltre("{pas du json")).toThrow(/illisible/);
  });
});

describe("validation du filtre", () => {
  it("refuse une plage d'âge inversée", () => {
    const r = validerFiltre({ version: 1, age: { min: 90, max: 80 } });
    expect(r.ok).toBe(false);
  });

  it("refuse une plage de numéros inversée", () => {
    expect(validerFiltre({ rues: [{ voie: "Rue du Marais", numeroMin: 41, numeroMax: 1, cote: "tous" }] }).ok).toBe(false);
  });

  it("refuse des valeurs hors vocabulaire", () => {
    expect(validerFiltre({ niveaux: ["P4"] }).ok).toBe(false);
    expect(validerFiltre({ girs: [7] }).ok).toBe(false);
    expect(validerFiltre({ sexes: ["X"] }).ok).toBe(false);
  });

  it("refuse un polygone de moins de 3 points", () => {
    expect(validerFiltre({ zone: { type: "polygone", points: [[50, 3], [50.1, 3]] } }).ok).toBe(false);
  });

  it("applique le côté « tous » par défaut", () => {
    const r = validerFiltre({ rues: [{ voie: "Rue du Marais" }] });
    expect(r.ok && r.filtre.rues?.[0].cote).toBe("tous");
  });
});

describe("règles de filtrage", () => {
  it("traduit une plage d'âge en bornes de naissance", () => {
    expect(bornesNaissance({ min: 80 }, "2026-10-28")).toEqual({ neAvantLe: "1946-10-28" });
    // 85 ans au plus : né après le 28/10/1940 (celui né le 28/10/1940 a 86 ans)
    expect(bornesNaissance({ max: 85 }, "2026-10-28")).toEqual({ neApres: "1940-10-28" });
    expect(bornesNaissance({ min: 1 }, "2028-02-29")).toEqual({ neAvantLe: "2027-02-28" });
  });

  it("filtre une plage de numéros d'un côté de la rue", () => {
    const rue = marais.rues![0];
    expect(numeroCorrespond(rue, 1)).toBe(true);
    expect(numeroCorrespond(rue, 41)).toBe(true);
    expect(numeroCorrespond(rue, 2)).toBe(false);
    expect(numeroCorrespond(rue, 43)).toBe(false);
    expect(numeroCorrespond(rue, null)).toBe(false);
    expect(numeroCorrespond({ voie: "Rue du Marais", cote: "tous" }, null)).toBe(true);
    expect(numeroCorrespond({ voie: "Rue du Marais", cote: "pair", numeroMin: 2, numeroMax: 40 }, 40)).toBe(true);
  });
});

describe("géométrie", () => {
  const carre: [number, number][] = [
    [50.63, 2.98],
    [50.63, 3.0],
    [50.65, 3.0],
    [50.65, 2.98],
  ];

  it("détecte un point dans un polygone", () => {
    expect(pointDansPolygone([50.64, 2.99], carre)).toBe(true);
    expect(pointDansPolygone([50.66, 2.99], carre)).toBe(false);
  });

  it("mesure une distance en mètres", () => {
    // 0,001° de latitude ≈ 111 m
    expect(distanceMetres([50.64, 2.99], [50.641, 2.99])).toBeCloseTo(111.2, 0);
  });

  it("détecte un point dans un cercle", () => {
    const zone = { type: "cercle" as const, centre: [50.64, 2.99] as [number, number], rayonMetres: 150 };
    expect(pointDansZone([50.641, 2.99], zone)).toBe(true);
    expect(pointDansZone([50.642, 2.99], zone)).toBe(false);
  });

  it("calcule un rectangle englobant qui contient le cercle", () => {
    const zone = { type: "cercle" as const, centre: [50.64, 2.99] as [number, number], rayonMetres: 1000 };
    const [latMin, lonMin, latMax, lonMax] = rectangleEnglobant(zone);
    expect(latMin).toBeLessThan(50.64 - 0.0089);
    expect(latMax).toBeGreaterThan(50.64 + 0.0089);
    expect(lonMax - lonMin).toBeGreaterThan(latMax - latMin); // plus large en longitude à cette latitude
  });
});

describe("puces de filtres actifs", () => {
  it("décrit une rue avec plage et côté", () => {
    expect(libelleRue(marais.rues![0])).toBe("Rue du Marais, impairs 1 à 41");
    expect(libelleRue({ voie: "Rue Kiener", cote: "pair" })).toBe("Rue Kiener, pairs");
    expect(libelleRue({ voie: "Rue Kiener", cote: "tous", numeroMin: 10 })).toBe("Rue Kiener, n° à partir du 10");
  });

  it("produit une puce par critère, et une par rue", () => {
    const f: Filtre = {
      ...marais,
      rues: [...marais.rues!, { voie: "Rue Kiener", cote: "tous" }],
      age: { min: 80 },
      apa: true,
      assignesA: ["11111111-1111-4111-8111-111111111111"],
    };
    const puces = decrireFiltre(f, { utilisateurs: { "11111111-1111-4111-8111-111111111111": "Julie Moreau" } });
    expect(puces.map((p) => p.libelle)).toEqual([
      "80 ans et plus",
      "Bénéficie de l'APA",
      "Assigné à Julie Moreau",
      "Rue du Marais, impairs 1 à 41",
      "Rue Kiener",
    ]);
  });

  it("retire un critère ou une rue précise", () => {
    const f: Filtre = { ...marais, rues: [...marais.rues!, { voie: "Rue Kiener", cote: "tous" }], apa: false };
    expect(retirerCritere(f, "apa").apa).toBeUndefined();
    expect(retirerCritere(f, "rues.0").rues).toEqual([{ voie: "Rue Kiener", cote: "tous" }]);
    expect(retirerCritere(retirerCritere(f, "rues.0"), "rues.0").rues).toBeUndefined();
  });

  it("bascule une valeur d'un critère multiple", () => {
    const f = basculerValeur(FILTRE_VIDE, "niveaux", "P1");
    expect(f.niveaux).toEqual(["P1"]);
    expect(basculerValeur(f, "niveaux", "P1").niveaux).toBeUndefined();
  });
});
