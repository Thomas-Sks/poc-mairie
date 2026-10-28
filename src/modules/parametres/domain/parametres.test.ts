import { describe, expect, it } from "vitest";
import { GRILLE_PAR_DEFAUT } from "@/shared/domain/priorite";
import { RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import { ajusterDelais, niveauRetenu, verifierGrille, verifierRelance } from "./parametres";

describe("verifierGrille", () => {
  it("accepte la grille par défaut", () => {
    expect(verifierGrille(GRILLE_PAR_DEFAUT)).toEqual([]);
  });

  it("refuse un seuil P1 inférieur ou égal au seuil P2", () => {
    expect(verifierGrille({ ...GRILLE_PAR_DEFAUT, seuilP1: 30, seuilP2: 30 })).toContain("Le seuil P1 doit être supérieur au seuil P2.");
  });

  it("refuse des points négatifs ou non entiers", () => {
    expect(verifierGrille({ ...GRILLE_PAR_DEFAUT, vitSeul: -5 })).toHaveLength(1);
    expect(verifierGrille({ ...GRILLE_PAR_DEFAUT, deplacement: { ...GRILLE_PAR_DEFAUT.deplacement, canne: 2.5 } })).toHaveLength(1);
  });
});

describe("ajusterDelais", () => {
  it("complète avec le dernier délai ou tronque", () => {
    expect(ajusterDelais(4, [30, 120])).toEqual([30, 120, 120]);
    expect(ajusterDelais(2, [30, 120])).toEqual([30]);
    expect(ajusterDelais(1, [30])).toEqual([]);
  });
});

describe("verifierRelance", () => {
  it("accepte les paramètres par défaut", () => {
    expect(verifierRelance(RELANCE_PAR_DEFAUT, 3, 12)).toEqual([]);
  });

  it("signale une plage horaire inversée et des délais incohérents", () => {
    const erreurs = verifierRelance({ ...RELANCE_PAR_DEFAUT, plageDebut: "19:00", plageFin: "09:00", nbTentatives: 4 }, 3, 12);
    expect(erreurs).toContain("La plage horaire d'appel doit commencer avant de finir.");
    expect(erreurs).toContain("Indiquez un délai avant chaque nouvelle tentative.");
  });

  it("borne les rappels d'anniversaire et la revérification", () => {
    expect(verifierRelance(RELANCE_PAR_DEFAUT, 45, 0)).toHaveLength(2);
  });
});

describe("niveauRetenu", () => {
  it("garde le niveau forcé s'il existe", () => {
    expect(niveauRetenu("P3", "P1")).toBe("P1");
    expect(niveauRetenu("P2", null)).toBe("P2");
  });
});
