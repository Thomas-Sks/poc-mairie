import { describe, expect, it } from "vitest";
import { ilYA, lienInterne, resoudreDestinataires, type MembreEquipe } from "./notification";

const equipe: MembreEquipe[] = [
  { id: "sophie", role: "admin", actif: true },
  { id: "julie", role: "agent", actif: true },
  { id: "karim", role: "agent", actif: true },
  { id: "ancien", role: "agent", actif: false },
  { id: "marc", role: "benevole", actif: true },
];

describe("resoudreDestinataires", () => {
  it("combine destinataires nommés et rôles, sans doublon", () => {
    expect(resoudreDestinataires({ destinataires: ["julie", "marc"], roles: ["admin", "agent"] }, equipe).sort()).toEqual(["julie", "karim", "marc", "sophie"]);
  });

  it("ignore les inactifs et les identifiants hors équipe", () => {
    expect(resoudreDestinataires({ destinataires: ["ancien", "inconnu"], roles: ["agent"] }, equipe).sort()).toEqual(["julie", "karim"]);
  });

  it("peut exclure l'auteur", () => {
    expect(resoudreDestinataires({ roles: ["agent"] }, equipe, "julie")).toEqual(["karim"]);
  });

  it("renvoie une liste vide sans cible", () => {
    expect(resoudreDestinataires({}, equipe)).toEqual([]);
  });
});

describe("lienInterne", () => {
  it("n'accepte que des chemins internes", () => {
    expect(lienInterne("/inscriptions")).toBe("/inscriptions");
    expect(lienInterne("https://exemple.org")).toBeNull();
    expect(lienInterne("//exemple.org")).toBeNull();
    expect(lienInterne(null)).toBeNull();
  });
});

describe("ilYA", () => {
  const maintenant = new Date("2026-10-28T10:00:00Z");
  it("formule l'ancienneté", () => {
    expect(ilYA(new Date("2026-10-28T09:59:40Z"), maintenant)).toBe("à l'instant");
    expect(ilYA(new Date("2026-10-28T09:45:00Z"), maintenant)).toBe("il y a 15 min");
    expect(ilYA(new Date("2026-10-28T07:00:00Z"), maintenant)).toBe("il y a 3 h");
    expect(ilYA(new Date("2026-10-26T10:00:00Z"), maintenant)).toBe("il y a 2 j");
  });
});
