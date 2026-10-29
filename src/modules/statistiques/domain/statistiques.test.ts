import { describe, expect, it } from "vitest";
import { analyserQuestion, QUESTIONS_SUGGEREES } from "./analyseur";
import { developperMobilite, developperStatutAppel, trancheAge } from "./catalogue";
import { nomFichierCsv, versCsv } from "./csv";
import { changerSujet, decrireFiltres, definitionVide, schemaDefinition, type DefinitionRequete, type Referentiels } from "./requete";
import {
  construireResultat,
  evolution,
  graphiqueAdapte,
  graphiquesPossibles,
  memePeriodeAnneePrecedente,
  moisEntre,
  regrouper,
} from "./resultat";
import { appliquerSecret, formaterEffectif, masquerEffectif, secretApplicable } from "./secret";

const REF: Referentiels = {
  quartiers: ["Bourg", "Marais", "Délivrance"],
  campagnes: [{ id: "0b5a3c9e-1111-4222-8333-444455556666", nom: "Canicule juillet 2026" }],
};

const scenario: DefinitionRequete = {
  ...definitionVide(),
  filtres: [
    { champ: "sexe", operateur: "est", valeur: "M" },
    { champ: "age", operateur: "sup_egal", valeur: "80" },
    { champ: "prise_en_charge", operateur: "est", valeur: "apa" },
    { champ: "mobilite", operateur: "est", valeur: "forte_difficulte" },
  ],
};

describe("E12-US1 définition de requête", () => {
  it("valide le scénario de démo §10.4-2", () => {
    expect(schemaDefinition.safeParse(scenario).success).toBe(true);
  });

  it("décrit les filtres en phrase lisible", () => {
    expect(decrireFiltres(scenario, REF)).toBe(
      "Sexe = Homme et Âge ≥ 80 ans et Prise en charge = APA et Mobilité = Forte difficulté (déambulateur, fauteuil, immobilisé)",
    );
  });

  it("refuse un filtre qui ne s'applique pas au sujet", () => {
    const d = { ...definitionVide("inscriptions"), filtres: [{ champ: "sexe", operateur: "est", valeur: "M" }] };
    expect(schemaDefinition.safeParse(d).success).toBe(false);
  });

  it("refuse une valeur inconnue, un opérateur interdit, un âge non numérique", () => {
    const avec = (champ: string, operateur: string, valeur: string) => schemaDefinition.safeParse({ ...definitionVide(), filtres: [{ champ, operateur, valeur }] }).success;
    expect(avec("sexe", "est", "X")).toBe(false);
    expect(avec("sexe", "sup_egal", "M")).toBe(false);
    expect(avec("age", "sup_egal", "quatre-vingts")).toBe(false);
    expect(avec("age", "sup_egal", "999")).toBe(false);
    expect(avec("campagne", "est", "pas-un-uuid")).toBe(false);
  });

  it("refuse une comparaison sans période et une période inversée", () => {
    expect(schemaDefinition.safeParse({ ...definitionVide(), comparaison: { du: "2025-01-01", au: "2025-12-31" } }).success).toBe(false);
    expect(schemaDefinition.safeParse({ ...definitionVide(), periode: { du: "2026-02-01", au: "2026-01-01" } }).success).toBe(false);
  });

  it("change de sujet en ne gardant que ce qui s'applique", () => {
    const d = changerSujet({ ...scenario, decoupage: "tranche_age" }, "inscriptions");
    expect(d.filtres).toEqual([]);
    expect(d.decoupage).toBeNull();
    const i = changerSujet({ ...scenario, decoupage: "quartier" }, "interactions");
    expect(i.filtres).toHaveLength(4);
    expect(i.decoupage).toBe("quartier");
  });
});

describe("regroupements", () => {
  it("« forte difficulté » regroupe déambulateur, fauteuil et immobilisé", () => {
    expect(developperMobilite("forte_difficulte")).toEqual(["deambulateur", "fauteuil", "immobilise"]);
    expect(developperMobilite("canne")).toEqual(["canne"]);
    expect(developperMobilite("inconnu")).toEqual([]);
  });

  it("regroupe les statuts d'appel", () => {
    expect(developperStatutAppel("joint")).toEqual(["joint_ras", "joint_besoin"]);
    expect(developperStatutAppel("danger")).toEqual(["danger"]);
  });

  it("place les âges dans les bonnes tranches", () => {
    expect(trancheAge(59).cle).toBe("moins_60");
    expect(trancheAge(80).cle).toBe("80_89");
    expect(trancheAge(89).cle).toBe("80_89");
    expect(trancheAge(101).cle).toBe("90_plus");
  });

  it("additionne les âges bruts par tranche, dans l'ordre naturel", () => {
    const lignes = regrouper("tranche_age", [{ cle: "92", n: 2 }, { cle: "81", n: 3 }, { cle: "85", n: 1 }, { cle: "72", n: 4 }], REF);
    expect(lignes.map((l) => [l.libelle, l.n])).toEqual([
      ["70 à 79 ans", 4],
      ["80 à 89 ans", 4],
      ["90 ans et plus", 2],
    ]);
  });

  it("regroupe les statuts d'appel et met « non renseigné » en dernier", () => {
    const lignes = regrouper("statut_appel", [{ cle: "joint_ras", n: 10 }, { cle: "messagerie", n: 2 }, { cle: "joint_besoin", n: 3 }, { cle: "danger", n: 1 }], REF);
    expect(lignes.map((l) => [l.cle, l.n])).toEqual([["joint", 13], ["non_joint", 2], ["urgence", 1]]);
    const q = regrouper("quartier", [{ cle: null, n: 9 }, { cle: "Bourg", n: 1 }, { cle: "Marais", n: 5 }], REF);
    expect(q.map((l) => l.libelle)).toEqual(["Marais", "Bourg", "Non renseigné"]);
  });

  it("complète les mois sans donnée", () => {
    expect(moisEntre("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    const r = construireResultat({ ...definitionVide("interactions"), decoupage: "mois" }, { total: 5, lignes: [{ cle: "2026-01", n: 2 }, { cle: "2026-03", n: 3 }] }, null, REF);
    expect(r.lignes.map((l) => [l.libelle, l.n])).toEqual([["janv. 2026", 2], ["févr. 2026", 0], ["mars 2026", 3]]);
  });
});

describe("E12-US5 comparaison de périodes", () => {
  it("propose la même période un an plus tôt", () => {
    expect(memePeriodeAnneePrecedente({ du: "2026-07-01", au: "2026-07-31" })).toEqual({ du: "2025-07-01", au: "2025-07-31" });
    expect(memePeriodeAnneePrecedente({ du: "2028-02-29", au: "2028-03-01" })).toEqual({ du: "2027-02-28", au: "2027-03-01" });
  });

  it("compare catégorie par catégorie", () => {
    const d: DefinitionRequete = { ...definitionVide("interactions"), decoupage: "type_interaction", periode: { du: "2026-01-01", au: "2026-06-30" }, comparaison: { du: "2025-01-01", au: "2025-06-30" } };
    const r = construireResultat(d, { total: 7, lignes: [{ cle: "visite", n: 7 }] }, { total: 4, lignes: [{ cle: "visite", n: 1 }, { cle: "sms", n: 3 }] }, REF);
    expect(r.totalComparaison).toBe(4);
    expect(r.lignes).toEqual([
      { cle: "visite", libelle: "Visite à domicile", n: 7, nComparaison: 1 },
      { cle: "sms", libelle: "SMS", n: 0, nComparaison: 3 },
    ]);
  });

  it("compare dans le temps rang à rang", () => {
    const d: DefinitionRequete = { ...definitionVide("interactions"), decoupage: "mois", periode: { du: "2026-01-01", au: "2026-02-28" }, comparaison: { du: "2025-01-01", au: "2025-02-28" } };
    const r = construireResultat(d, { total: 3, lignes: [{ cle: "2026-02", n: 3 }] }, { total: 1, lignes: [{ cle: "2025-01", n: 1 }] }, REF);
    expect(r.lignes.map((l) => [l.libelle, l.n, l.libelleComparaison, l.nComparaison])).toEqual([
      ["janv. 2026", 0, "janv. 2025", 1],
      ["févr. 2026", 3, "févr. 2025", 0],
    ]);
  });

  it("calcule l'évolution en pourcentage", () => {
    expect(evolution(120, 100)).toBe(20);
    expect(evolution(5, 0)).toBeNull();
  });
});

describe("graphique adapté", () => {
  it("courbe dans le temps, camembert limité à 5 catégories, carte par quartier", () => {
    expect(graphiquesPossibles("mois", 12)).toEqual(["courbe", "barres"]);
    expect(graphiquesPossibles("sexe", 2)).toEqual(["barres", "camembert"]);
    expect(graphiquesPossibles("quartier", 6)).toEqual(["barres", "carte"]);
    expect(graphiquesPossibles("prise_en_charge", 3)).toEqual(["barres"]);
    expect(graphiqueAdapte("sexe", 2, null)).toBe("camembert");
    expect(graphiqueAdapte("tranche_age", 5, "camembert")).toBe("camembert");
    expect(graphiqueAdapte("tranche_age", 6, "camembert")).toBe("barres");
    expect(graphiqueAdapte(null, 0, "barres")).toBeNull();
  });
});

describe("E12-US7 secret statistique", () => {
  it("masque de 1 à 4, garde 0 et 5", () => {
    expect([0, 1, 4, 5, 12].map((n) => masquerEffectif(n, true))).toEqual([0, null, null, 5, 12]);
    expect(masquerEffectif(2, false)).toBe(2);
    expect(formaterEffectif(null)).toBe("< 5");
    expect(formaterEffectif(1234)).toBe((1234).toLocaleString("fr-FR"));
  });

  it("s'impose sans droit nominatif", () => {
    expect(secretApplicable(false, false)).toBe(true);
    expect(secretApplicable(true, false)).toBe(false);
    expect(secretApplicable(true, true)).toBe(true);
  });

  it("masque le total, les lignes et la comparaison", () => {
    const r = appliquerSecret({ total: 2, totalComparaison: 7, decoupage: "sexe", lignes: [{ cle: "M", libelle: "Homme", n: 2, nComparaison: 3 }] }, true);
    expect(r.total).toBeNull();
    expect(r.totalComparaison).toBe(7);
    expect(r.lignes[0]).toMatchObject({ n: null, nComparaison: null });
  });
});

describe("E12-US2 analyseur de questions", () => {
  it("traduit la question du scénario en 4 filtres affichés", () => {
    const a = analyserQuestion("Combien d'hommes de plus de 80 ans touchent l'APA et ont un gros problème de mobilité ?", REF);
    expect(a.definition.sujet).toBe("beneficiaires");
    expect(a.definition.filtres).toEqual(scenario.filtres);
    expect(a.vide).toBe(false);
    expect(a.compris.length).toBeGreaterThanOrEqual(4);
  });

  it("reconnaît le sujet, le découpage et un quartier", () => {
    const a = analyserQuestion("Combien d'appels de campagne non joints par besoin ?", REF);
    expect(a.definition.sujet).toBe("appels_campagne");
    expect(a.definition.filtres).toEqual([{ champ: "statut_appel", operateur: "est", valeur: "non_joint" }]);
    expect(a.definition.decoupage).toBe("besoin");
    const q = analyserQuestion("Femmes qui vivent seules dans le quartier Délivrance", REF);
    expect(q.definition.filtres).toContainEqual({ champ: "quartier", operateur: "est", valeur: "Délivrance" });
    expect(q.definition.filtres).toContainEqual({ champ: "mode_de_vie", operateur: "est", valeur: "seul" });
  });

  it("produit toujours une définition valide pour les questions suggérées", () => {
    for (const question of QUESTIONS_SUGGEREES) {
      const a = analyserQuestion(question, REF);
      expect(schemaDefinition.safeParse(a.definition).success, question).toBe(true);
      expect(a.vide, question).toBe(false);
    }
  });

  it("signale une question incomprise", () => {
    expect(analyserQuestion("Quel temps fera-t-il demain ?", REF).vide).toBe(true);
  });
});

describe("E12-US6 export CSV", () => {
  it("échappe et sépare par point-virgule", () => {
    expect(versCsv(["Quartier", "Effectif"], [["Marais; nord", 3], ['Dit "le Bourg"', null], ["Total", 1.5]])).toBe(
      '﻿Quartier;Effectif\r\n"Marais; nord";3\r\n"Dit ""le Bourg""";\r\nTotal;1,5',
    );
    expect(nomFichierCsv("Population suivie : âge")).toBe("population-suivie-age.csv");
  });
});
