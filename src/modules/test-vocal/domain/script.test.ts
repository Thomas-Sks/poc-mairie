import { describe, expect, it } from "vitest";
import { CONCLUSION, DUREE_MAX_SECONDES, PREMIER_MESSAGE, QUESTIONS, consignesAgent, variablesConversation } from "./script";

describe("script du test vocal", () => {
  it("décroche par « Allô ? » et dure 5 minutes au plus", () => {
    expect(PREMIER_MESSAGE).toBe("Allô ?");
    expect(DUREE_MAX_SECONDES).toBe(300);
  });

  it("pose les trois questions dans l'ordre, puis conclut", () => {
    const consignes = consignesAgent();
    const positions = [...QUESTIONS, CONCLUSION].map((t) => consignes.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("se présente comme une IA et ne coupe pas la parole", () => {
    const consignes = consignesAgent();
    expect(consignes).toContain("intelligence artificielle");
    expect(consignes).toContain("Ne coupe jamais la parole");
    expect(consignes).toContain("répète calmement");
  });

  it("fait prononcer C.C.A.S. lettre par lettre", () => {
    expect(consignesAgent()).not.toMatch(/\bCCAS de/);
    expect(consignesAgent()).toContain("assistant vocal du C.C.A.S. de {{commune}}");
  });

  it("injecte la commune et la structure", () => {
    expect(variablesConversation({ nom: "Lomme", structureNom: "Maison des seniors de Lomme" })).toEqual({
      commune: "Lomme",
      structure: "Maison des seniors de Lomme",
    });
  });
});
