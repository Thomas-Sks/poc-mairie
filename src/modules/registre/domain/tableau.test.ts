import { describe, expect, it } from "vitest";
import { repartir } from "@/shared/domain/campagne";
import {
  colonnesAutorisees,
  comparerPriorite,
  contientDonneesSante,
  genererCsv,
  lireRequeteTableau,
  type LigneBeneficiaire,
} from "./tableau";

const ligne = (p: Partial<LigneBeneficiaire>): LigneBeneficiaire => ({
  id: "00000000-0000-4000-8000-000000000001",
  civilite: "Mme",
  nom: "DUPONT",
  prenom: "Simone",
  dateNaissance: "1936-10-29",
  age: 89,
  sexe: "F",
  niveau: "P1",
  score: 72,
  statut: "active",
  telephone: "01 99 00 00 01",
  telephoneMobile: null,
  numero: 23,
  rep: null,
  voie: "Rue du Marais",
  quartier: "Marais",
  modeDeVie: "seul",
  deplacement: "canne",
  gir: 4,
  handicap: null,
  apa: true,
  tags: [],
  dernierContact: "2026-10-20T09:30:00.000Z",
  indisponible: false,
  assignes: [],
  lat: 50.64,
  lon: 2.99,
  ...p,
});

describe("requête du tableau", () => {
  it("applique les valeurs par défaut", () => {
    const r = lireRequeteTableau({});
    expect(r).toEqual({ filtre: { version: 1 }, tri: [{ colonne: "priorite", sens: "asc" }], page: 0, taillePage: 50 });
  });

  it("ignore les tris sur des colonnes non triables et les doublons", () => {
    const r = lireRequeteTableau({
      tri: [
        { colonne: "tags", sens: "asc" },
        { colonne: "age", sens: "desc" },
        { colonne: "age", sens: "asc" },
      ],
    });
    expect(r.tri).toEqual([{ colonne: "age", sens: "desc" }]);
  });

  it("refuse une taille de page excessive", () => {
    expect(() => lireRequeteTableau({ taillePage: 100_000 })).toThrow();
  });
});

describe("ordre de priorité et répartition (E8-US6)", () => {
  it("trie P1 avant P2 avant P3, puis par score décroissant", () => {
    const personnes = [
      { id: "a", niveau: "P3" as const, score: 10 },
      { id: "b", niveau: "P1" as const, score: 61 },
      { id: "c", niveau: "P2" as const, score: 45 },
      { id: "d", niveau: "P1" as const, score: 80 },
    ];
    expect([...personnes].sort(comparerPriorite).map((p) => p.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("répartit équitablement en respectant l'ordre de priorité", () => {
    const lots = repartir(["d", "b", "c", "a", "e"], 2);
    expect(lots).toEqual([["d", "c", "e"], ["b", "a"]]);
  });
});

describe("colonnes de santé", () => {
  it("détecte les colonnes de santé", () => {
    expect(contientDonneesSante(["nom", "age"])).toBe(false);
    expect(contientDonneesSante(["nom", "gir"])).toBe(true);
  });

  it("retire les colonnes de santé sans le droit", () => {
    expect(colonnesAutorisees(["nom", "deplacement", "apa", "age"], false)).toEqual(["nom", "age"]);
    expect(colonnesAutorisees(["nom", "deplacement"], true)).toEqual(["nom", "deplacement"]);
  });
});

describe("export CSV", () => {
  it("produit un CSV Excel (BOM, « ; », CRLF) avec les colonnes choisies", () => {
    const csv = genererCsv([ligne({}), ligne({ nom: "MARTIN", prenom: "Jean; dit \"Jeannot\"", civilite: "M." })], ["nom", "age", "adresse"]);
    expect(csv.startsWith("﻿Nom;Âge;Adresse\r\n")).toBe(true);
    expect(csv).toContain("Mme DUPONT Simone;89;23 Rue du Marais\r\n");
    expect(csv).toContain('"M. MARTIN Jean; dit ""Jeannot""";89;');
  });

  it("neutralise les formules", () => {
    const csv = genererCsv([ligne({ nom: "=HYPERLINK()" })], ["nom"]);
    expect(csv).not.toContain(";=");
    expect(csv).toContain("Mme =HYPERLINK() Simone"); // la cellule ne commence pas par « = »
    expect(genererCsv([ligne({ tags: ["=1+1"] })], ["tags"])).toContain("'=1+1");
  });

  it("affiche les noms des personnes assignées et « Jamais » sans contact", () => {
    const csv = genererCsv([ligne({ assignes: ["u1"], dernierContact: null })], ["assignes", "dernierContact"], { u1: "Julie Moreau" });
    expect(csv).toContain("Julie Moreau;Jamais");
  });
});
