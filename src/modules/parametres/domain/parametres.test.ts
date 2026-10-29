import { describe, expect, it } from "vitest";
import { GRILLE_PAR_DEFAUT } from "@/shared/domain/priorite";
import { niveauRetenu, verifierGrille } from "./parametres";

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

describe("niveauRetenu", () => {
  it("garde le niveau forcé s'il existe", () => {
    expect(niveauRetenu("P3", "P1")).toBe("P1");
    expect(niveauRetenu("P2", null)).toBe("P2");
  });
});
