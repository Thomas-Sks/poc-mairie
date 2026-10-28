import { describe, expect, it } from "vitest";
import { cleTexte, formaterNom, formaterPrenom, normaliserDate, normaliserTelephone } from "./normalisation";

describe("normaliserDate", () => {
  it.each([
    ["12/03/1938", "1938-03-12"],
    ["12-3-1938", "1938-03-12"],
    ["12.03.38", "1938-03-12"],
    ["1/2/41", "1941-02-01"],
    ["1938-03-12", "1938-03-12"],
    ["12 mars 1938", "1938-03-12"],
    ["1er août 1940", "1940-08-01"],
    ["12031938", "1938-03-12"],
  ])("lit « %s »", (saisie, attendu) => {
    expect(normaliserDate(saisie, 2026)).toBe(attendu);
  });

  it("lit un numéro de série Excel", () => {
    expect(normaliserDate(14317)).toBe("1939-03-13");
    expect(normaliserDate("14317")).toBe("1939-03-13");
  });

  it("refuse les dates impossibles ou vides", () => {
    expect(normaliserDate("31/02/1940")).toBeNull();
    expect(normaliserDate("13/13/1940")).toBeNull();
    expect(normaliserDate("")).toBeNull();
    expect(normaliserDate("inconnue")).toBeNull();
    expect(normaliserDate(null)).toBeNull();
  });

  it("une année sur 2 chiffres postérieure à l'année courante appartient au siècle précédent", () => {
    expect(normaliserDate("01/01/20", 2026)).toBe("2020-01-01");
    expect(normaliserDate("01/01/30", 2026)).toBe("1930-01-01");
  });
});

describe("normaliserTelephone", () => {
  it.each([
    ["0639981234", "06 39 98 12 34"],
    ["06.39.98.12.34", "06 39 98 12 34"],
    ["06-39-98-12-34", "06 39 98 12 34"],
    ["+33 6 39 98 12 34", "06 39 98 12 34"],
    ["+33 (0)6 39 98 12 34", "06 39 98 12 34"],
    ["0033639981234", "06 39 98 12 34"],
    ["199001234", "01 99 00 12 34"],
  ])("normalise « %s »", (saisie, attendu) => {
    expect(normaliserTelephone(saisie)).toBe(attendu);
  });

  it("accepte un nombre (zéro initial perdu par Excel)", () => {
    expect(normaliserTelephone(639981234)).toBe("06 39 98 12 34");
  });

  it("refuse un numéro incomplet ou étranger", () => {
    expect(normaliserTelephone("06 39 98")).toBeNull();
    expect(normaliserTelephone("+32 470 12 34 56")).toBeNull();
    expect(normaliserTelephone("")).toBeNull();
  });
});

describe("noms", () => {
  it("met le nom en capitales et le prénom en casse de titre", () => {
    expect(formaterNom("  le  febvre ")).toBe("LE FEBVRE");
    expect(formaterPrenom("JEAN-PIERRE")).toBe("Jean-Pierre");
    expect(formaterPrenom("élodie")).toBe("Élodie");
  });

  it("produit une clé comparable sans accents", () => {
    expect(cleTexte("Date de naiss.")).toBe("date de naiss");
    expect(cleTexte("Téléphone")).toBe("telephone");
  });
});
