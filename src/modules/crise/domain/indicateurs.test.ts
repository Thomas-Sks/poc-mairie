import { describe, expect, it } from "vitest";
import { compterCouverture, progressionParAppelant, situationsPrioritaires } from "./tableau-de-bord";
import { correspondAuFiltre, decrireFiltre } from "./filtre-geographique";
import { versCsv } from "./export-csv";
import { calculerStatistiques } from "./rapport";

describe("Couverture du jour (E6-US4)", () => {
  it("range chaque statut dans une des six catégories", () => {
    const r = compterCouverture(
      (["couvert_passage", "joint_ras", "joint_besoin", "couvert_proche", "absent", "a_appeler", "en_cours", "non_joint", "messagerie", "danger", "evacuation"] as const).map((statut) => ({ statut })),
    );
    expect(r).toEqual({ passage: 1, appel: 3, absent: 1, a_appeler: 2, non_joint: 2, danger: 2 });
  });
});

describe("situationsPrioritaires", () => {
  it("met le danger en tête, puis évacuation, escalade, non joint à traiter", () => {
    const r = situationsPrioritaires(
      (["joint_ras", "non_joint_a_traiter", "escalade_humain", "danger", "evacuation"] as const).map((statut) => ({ statut })),
    );
    expect(r.map((c) => c.statut)).toEqual(["danger", "evacuation", "escalade_humain", "non_joint_a_traiter"]);
  });
});

describe("progressionParAppelant", () => {
  it("compte les cibles humaines assignées, traitées ou non", () => {
    const r = progressionParAppelant([
      { statut: "joint_ras", exclue: false, canal: "humain", assigneA: "julie" },
      { statut: "a_appeler", exclue: false, canal: "humain", assigneA: "julie" },
      { statut: "a_appeler", exclue: false, canal: "ia", assigneA: "julie" },
      { statut: "couvert_passage", exclue: true, canal: "humain", assigneA: "julie" },
      { statut: "danger", exclue: false, canal: "humain", assigneA: "marc" },
    ]);
    expect(r).toEqual([
      { utilisateurId: "julie", total: 2, traitees: 1, aTraiter: 1 },
      { utilisateurId: "marc", total: 1, traitees: 1, aTraiter: 0 },
    ]);
  });
});

describe("filtre géographique", () => {
  const filtre = { voie: "Rue du Marais", numeroMin: 1, numeroMax: 41, parite: "impair" as const };
  it("rue du Marais, n° impairs 1 à 41", () => {
    expect(correspondAuFiltre({ voie: "Rue du Marais", numero: 23, quartier: "Kiener" }, filtre)).toBe(true);
    expect(correspondAuFiltre({ voie: "rue du marais", numero: 41, quartier: null }, filtre)).toBe(true);
    expect(correspondAuFiltre({ voie: "Rue du Marais", numero: 22, quartier: null }, filtre)).toBe(false);
    expect(correspondAuFiltre({ voie: "Rue du Marais", numero: 43, quartier: null }, filtre)).toBe(false);
    expect(correspondAuFiltre({ voie: "Rue de la Mitterie", numero: 3, quartier: null }, filtre)).toBe(false);
    expect(correspondAuFiltre({ voie: "Rue du Marais", numero: null, quartier: null }, filtre)).toBe(false);
  });
  it("quartier seul", () => {
    expect(correspondAuFiltre({ voie: "X", numero: null, quartier: "Délivrance" }, { quartier: "delivrance" })).toBe(true);
  });
  it("décrit le filtre en français", () => {
    expect(decrireFiltre(filtre)).toBe("Rue du Marais, n° impairs 1 à 41");
  });
});

describe("export CSV (NF-07)", () => {
  it("échappe les séparateurs et ajoute le BOM", () => {
    const csv = versCsv(["Nom", "Note"], [{ Nom: "Dupont", Note: 'Dit "ça va"; RAS' }]);
    expect(csv).toBe('﻿Nom;Note\r\nDupont;"Dit ""ça va""; RAS"\r\n');
  });
});

describe("rapport de campagne (E9-US7)", () => {
  it("calcule les statistiques par vague", () => {
    const s = calculerStatistiques([
      { beneficiaireId: "a", vagueDate: "2026-07-06", statut: "joint_ras", exclue: false, canal: "humain", nbTentatives: 1, besoins: [] },
      { beneficiaireId: "b", vagueDate: "2026-07-06", statut: "danger", exclue: false, canal: "humain", nbTentatives: 2, besoins: [] },
      { beneficiaireId: "a", vagueDate: "2026-07-07", statut: "joint_besoin", exclue: false, canal: "ia", nbTentatives: 1, besoins: ["eau"] },
      { beneficiaireId: "b", vagueDate: "2026-07-07", statut: "couvert_passage", exclue: true, canal: "humain", nbTentatives: 0, besoins: [] },
    ]);
    expect(s).toMatchObject({ personnes: 2, contactsPrevus: 4, appelsPasses: 4, joints: 2, dangers: 1, besoins: 1, appelsIa: 1, tauxCouverture: 75 });
    expect(s.besoinsParType).toEqual({ eau: 1 });
    expect(s.parVague).toEqual([
      { vague: "2026-07-06", total: 2, couverts: 1, signales: 1 },
      { vague: "2026-07-07", total: 2, couverts: 2, signales: 1 },
    ]);
  });
});
