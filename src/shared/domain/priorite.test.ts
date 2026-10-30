import { describe, expect, it } from "vitest";
import { calculerScore, completerGrille, GRILLE_PAR_DEFAUT, type FaitsPriorite, type GrilleScore } from "./priorite";

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
  apa: null,
  pch: false,
  aideCaisseRetraite: false,
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

  it("ajoute les aides du décret 2026-590 : APA selon le GIR, PCH, caisse de retraite", () => {
    const criteres = (f: Partial<FaitsPriorite>) => calculerScore({ ...base, ...f }).criteres;
    expect(criteres({ apa: { gir: 2 } })).toEqual([{ critere: "APA, GIR 1 ou 2", points: 15 }]);
    expect(criteres({ apa: { gir: 4 } })).toEqual([{ critere: "APA, GIR 3 ou 4", points: 10 }]);
    expect(criteres({ apa: { gir: null } })).toEqual([{ critere: "APA, GIR 5-6 ou non précisé", points: 5 }]);
    expect(calculerScore({ ...base, pch: true, aideCaisseRetraite: true }).score).toBe(15);
  });

  it("complète une grille enregistrée avant l'ajout des nouveaux critères", () => {
    const ancienne: Partial<GrilleScore> = { vitSeul: 30, seuilP1: 70, seuilP2: 30 };
    const g = completerGrille(ancienne);
    expect(g.vitSeul).toBe(30);
    expect(g.apaGir12).toBe(GRILLE_PAR_DEFAUT.apaGir12);
    expect(g.deplacement).toEqual(GRILLE_PAR_DEFAUT.deplacement);
  });
});
