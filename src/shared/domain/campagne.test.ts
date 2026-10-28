import { describe, expect, it } from "vitest";
import { comparerOrdreAppel, deciderApresNonReponse, evaluerExclusion, repartir, verrouActif } from "./campagne";
import { calculerAge, jourDeSemaine } from "./dates";

describe("RG-02 ordre d'appel", () => {
  it("trie P1 avant P2, puis score décroissant, puis non joints la veille", () => {
    const liste = [
      { id: "a", niveau: "P2" as const, score: 50, nonJointVeille: false },
      { id: "b", niveau: "P1" as const, score: 61, nonJointVeille: false },
      { id: "c", niveau: "P1" as const, score: 75, nonJointVeille: false },
      { id: "d", niveau: "P2" as const, score: 50, nonJointVeille: true },
    ];
    expect(liste.sort(comparerOrdreAppel).map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("place les escalades en tête (RG-06)", () => {
    const a = { niveau: "P3" as const, score: 0, nonJointVeille: false, escalade: true };
    const b = { niveau: "P1" as const, score: 90, nonJointVeille: false };
    expect(comparerOrdreAppel(a, b)).toBeLessThan(0);
  });
});

describe("RG-04 relances", () => {
  const t0 = new Date("2026-07-06T10:00:00+02:00");
  it("reprogramme la 2e tentative 30 min plus tard, la 3e 2 h plus tard", () => {
    const d1 = deciderApresNonReponse(1, t0);
    expect(d1).toMatchObject({ type: "reprogrammer", tentative: 2 });
    if (d1.type === "reprogrammer") expect(d1.prochaineTentativeAt.getTime() - t0.getTime()).toBe(30 * 60_000);
    const d2 = deciderApresNonReponse(2, t0);
    if (d2.type === "reprogrammer") expect(d2.prochaineTentativeAt.getTime() - t0.getTime()).toBe(120 * 60_000);
  });
  it("escalade vers le cercle puis passe en « à traiter »", () => {
    expect(deciderApresNonReponse(3, t0).type).toBe("escalader_cercle");
    expect(deciderApresNonReponse(3, t0, undefined, true).type).toBe("a_traiter");
  });
});

describe("RG-05 anti-doublon", () => {
  const lundi = "2026-07-06";
  it("exclut une personne avec un passage prévu le jour même", () => {
    const ex = evaluerExclusion(
      { passages: [{ libelle: "ADMR Lomme", joursSemaine: [1, 3], heureDebut: "09:00", exceptions: [] }], indisponibilites: [], statutDuJour: null },
      lundi,
    );
    expect(ex).toMatchObject({ couverture: "passage", statut: "couvert_passage", motif: "Couvert par passage ADMR Lomme à 09h00" });
  });
  it("ignore un passage annulé ce jour (exception)", () => {
    const ex = evaluerExclusion(
      { passages: [{ libelle: "ADMR", joursSemaine: [1], heureDebut: "09:00", exceptions: [lundi] }], indisponibilites: [], statutDuJour: null },
      lundi,
    );
    expect(ex).toBeNull();
  });
  it("donne la priorité à l'absence déclarée", () => {
    const ex = evaluerExclusion(
      { passages: [], indisponibilites: [{ libelle: "Vacances", debut: "2026-07-01", fin: null }], statutDuJour: null },
      lundi,
    );
    expect(ex?.couverture).toBe("absence");
  });
});

describe("utilitaires", () => {
  it("calcule l'âge (RG-08) et le jour de semaine", () => {
    expect(calculerAge("1936-10-29", "2026-10-28")).toBe(89);
    expect(calculerAge("1936-10-29", "2026-10-29")).toBe(90);
    expect(jourDeSemaine("2026-07-06")).toBe(1);
  });
  it("verrouille 10 min puis libère", () => {
    const t = new Date("2026-07-06T10:00:00Z");
    expect(verrouActif(t, new Date("2026-07-06T10:09:00Z"))).toBe(true);
    expect(verrouActif(t, new Date("2026-07-06T10:11:00Z"))).toBe(false);
  });
  it("répartit équitablement en respectant l'ordre", () => {
    expect(repartir([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]]);
  });
});
