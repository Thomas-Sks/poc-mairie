import { describe, expect, it } from "vitest";
import { calculerScore, type FaitsPriorite } from "./priorite";

const base: FaitsPriorite = {
  age: 70,
  modeDeVie: "couple",
  deplacement: "seul",
  protection: "non",
  troublesCognitifs: false,
  quelquUnPossedeLesCles: true,
  aUnProcheJoignable: true,
  sousLesToits: false,
  pieceFraiche: true,
  rezDeChaussee: false,
  nbPrisesEnChargeADomicile: 1,
  retourHospitalisationRecent: false,
  pasDeTelephone: false,
};

describe("RG-01 score de priorité", () => {
  it("donne P3 et 0 point à une personne sans facteur de risque", () => {
    expect(calculerScore(base)).toMatchObject({ score: 0, niveau: "P3" });
  });

  it("cumule les critères de la grille par défaut", () => {
    const r = calculerScore({ ...base, age: 88, modeDeVie: "seul", deplacement: "fauteuil", sousLesToits: true, nbPrisesEnChargeADomicile: 0 });
    // 20 (seul) + 15 (≥85) + 15 (fauteuil) + 10 (logement chaud) + 10 (aucune aide)
    expect(r.score).toBe(70);
    expect(r.niveau).toBe("P1");
  });

  it("ne compte le logement sous les toits qu'en canicule et le rez-de-chaussée qu'en inondation", () => {
    const faits = { ...base, sousLesToits: true, rezDeChaussee: true };
    expect(calculerScore(faits, undefined, "canicule").score).toBe(10);
    expect(calculerScore(faits, undefined, "inondation").score).toBe(10);
    expect(calculerScore(faits, undefined, "grand_froid").score).toBe(0);
  });

  it("plafonne le score à 100", () => {
    const r = calculerScore({
      ...base,
      age: 95,
      modeDeVie: "seul",
      deplacement: "immobilise",
      protection: "tutelle",
      troublesCognitifs: true,
      quelquUnPossedeLesCles: false,
      aUnProcheJoignable: false,
      sousLesToits: true,
      nbPrisesEnChargeADomicile: 0,
      retourHospitalisationRecent: true,
      pasDeTelephone: true,
    });
    expect(r.score).toBe(100);
  });
});
