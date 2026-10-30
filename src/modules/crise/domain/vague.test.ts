import { describe, expect, it } from "vitest";
import { appelantInitial, appelantsHabituels, genererVague, vagueDueLe, type BeneficiaireVague } from "./vague";

const JOUR = "2026-10-28"; // mercredi (3)

const benef = (id: string, extra: Partial<BeneficiaireVague> = {}): BeneficiaireVague => ({
  id,
  niveau: "P2",
  score: 40,
  consentementIa: false,
  iaActivee: false,
  nonJointVeille: false,
  faits: { passages: [], indisponibilites: [], statutDuJour: null },
  ...extra,
});

describe("genererVague", () => {
  it("trie selon RG-02 : P1 avant P2, score décroissant, non joints la veille d'abord", () => {
    const vague = genererVague(
      [
        benef("p3", { niveau: "P3", score: 10 }),
        benef("p2-faible", { score: 35 }),
        benef("p2-fort", { score: 55 }),
        benef("p2-veille", { score: 35, nonJointVeille: true }),
        benef("p1", { niveau: "P1", score: 70 }),
      ],
      JOUR,
      "humain",
    );
    expect(vague.map((c) => c.beneficiaireId)).toEqual(["p1", "p2-fort", "p2-veille", "p2-faible", "p3"]);
    expect(vague.map((c) => c.rang)).toEqual([1, 2, 3, 4, 5]);
  });

  it("exclut (RG-05) les personnes couvertes par un passage le jour même, avec le motif", () => {
    const [c] = genererVague(
      [benef("a", { faits: { passages: [{ libelle: "ADMR Lomme", joursSemaine: [1, 3, 5], heureDebut: "09:00", exceptions: [] }], indisponibilites: [], statutDuJour: null } })],
      JOUR,
      "humain",
    );
    expect(c).toMatchObject({ exclue: true, statut: "couvert_passage", couverture: "passage", motifExclusion: "Couvert par passage ADMR Lomme à 09h00" });
  });

  it("en inondation ou tempête, un passage prévu n'exclut pas la personne (elle reste à appeler)", () => {
    const faits = { passages: [{ libelle: "ADMR Lomme", joursSemaine: [3], heureDebut: "09:00", exceptions: [] }], indisponibilites: [], statutDuJour: null };
    for (const type of ["inondation", "tempete"] as const) {
      const [c] = genererVague([benef("a", { faits })], JOUR, "humain", type);
      expect(c).toMatchObject({ exclue: false, statut: "a_appeler", couverture: null });
    }
    expect(genererVague([benef("a", { faits })], JOUR, "humain", "grand_froid")[0].exclue).toBe(true);
  });

  it("en inondation, une absence déclarée exclut toujours", () => {
    const [c] = genererVague(
      [benef("a", { faits: { passages: [], indisponibilites: [{ libelle: "Vacances", debut: "2026-10-20", fin: null }], statutDuJour: null } })],
      JOUR,
      "humain",
      "inondation",
    );
    expect(c).toMatchObject({ exclue: true, couverture: "absence" });
  });

  it("n'exclut pas un passage prévu un autre jour", () => {
    const [c] = genererVague(
      [benef("a", { faits: { passages: [{ libelle: "ADMR", joursSemaine: [2, 4], heureDebut: "09:00", exceptions: [] }], indisponibilites: [], statutDuJour: null } })],
      JOUR,
      "humain",
    );
    expect(c).toMatchObject({ exclue: false, statut: "a_appeler" });
  });

  it("exclut (E5-US2) les personnes en indisponibilité active", () => {
    const [c] = genererVague(
      [benef("a", { faits: { passages: [], indisponibilites: [{ libelle: "Vacances", debut: "2026-10-25", fin: "2026-11-02" }], statutDuJour: null } })],
      JOUR,
      "humain",
    );
    expect(c).toMatchObject({ exclue: true, statut: "absent", couverture: "absence", motifExclusion: "Absent : Vacances" });
  });

  it("exclut une personne déjà jointe aujourd'hui (statut terminal)", () => {
    const [c] = genererVague([benef("a", { faits: { passages: [], indisponibilites: [], statutDuJour: "joint_ras" } })], JOUR, "humain");
    expect(c).toMatchObject({ exclue: true, motifExclusion: "Déjà joint aujourd'hui" });
  });

  it("canal humain : aucune cible IA", () => {
    const vague = genererVague([benef("a", { consentementIa: true, iaActivee: true })], JOUR, "humain");
    expect(vague[0].canal).toBe("humain");
  });

  it("canal mixte : l'IA ne prend que des éligibles (consentement, IA activée, pas P1), une sur deux, et la première est l'escalade « vertiges »", () => {
    const eligibles = ["e1", "e2", "e3", "e4"].map((id, i) => benef(id, { consentementIa: true, iaActivee: true, score: 50 - i }));
    const vague = genererVague(
      [
        ...eligibles,
        benef("sans-consentement", { iaActivee: true, score: 45 }),
        benef("p1", { niveau: "P1", score: 80, consentementIa: true, iaActivee: true }),
      ],
      JOUR,
      "mixte",
    );
    const ia = vague.filter((c) => c.canal === "ia");
    expect(ia.map((c) => c.beneficiaireId)).toEqual(["e1", "e3"]);
    expect(ia[0]).toMatchObject({ statut: "escalade_humain" });
    expect(ia[0].maquetteIa?.detail?.resume).toContain("vertiges");
    expect(vague.find((c) => c.beneficiaireId === "p1")?.canal).toBe("humain");
    expect(vague.find((c) => c.beneficiaireId === "sans-consentement")?.canal).toBe("humain");
  });

  it("est déterministe", () => {
    const liste = ["a", "b", "c", "d", "e", "f"].map((id) => benef(id, { consentementIa: true, iaActivee: true }));
    expect(genererVague(liste, JOUR, "mixte")).toEqual(genererVague(liste, JOUR, "mixte"));
  });
});

describe("vagueDueLe", () => {
  const campagne = { frequence: "quotidienne" as const, frequenceJours: null, dateDebut: "2026-10-26", dateFin: "2026-10-30", statut: "active" as const };

  it("quotidienne : chaque jour de la période", () => {
    expect(vagueDueLe(campagne, "2026-10-26")).toBe(true);
    expect(vagueDueLe(campagne, "2026-10-28")).toBe(true);
    expect(vagueDueLe(campagne, "2026-10-31")).toBe(false);
    expect(vagueDueLe(campagne, "2026-10-25")).toBe(false);
  });

  it("unique : seulement le premier jour", () => {
    expect(vagueDueLe({ ...campagne, frequence: "unique" }, "2026-10-26")).toBe(true);
    expect(vagueDueLe({ ...campagne, frequence: "unique" }, "2026-10-27")).toBe(false);
  });

  it("tous les N jours", () => {
    const c = { ...campagne, frequence: "tous_n_jours" as const, frequenceJours: 2 };
    expect(vagueDueLe(c, "2026-10-27")).toBe(false);
    expect(vagueDueLe(c, "2026-10-28")).toBe(true);
  });

  it("jamais pour une campagne clôturée", () => {
    expect(vagueDueLe({ ...campagne, statut: "cloturee" }, "2026-10-28")).toBe(false);
  });
});

describe("appelant habituel (personnes confiées à un bénévole)", () => {
  const habituels = appelantsHabituels([
    { beneficiaireId: "a", benevoleId: "lucie", confieeLe: new Date("2026-10-02") },
    { beneficiaireId: "a", benevoleId: "marc", confieeLe: new Date("2026-10-01") },
    { beneficiaireId: "b", benevoleId: "lucie", confieeLe: new Date("2026-10-03") },
  ]);

  it("garde le premier bénévole à qui la personne a été confiée", () => {
    expect(habituels.get("a")).toBe("marc");
    expect(habituels.get("b")).toBe("lucie");
  });

  it("n'assigne que les cibles appelées par un humain et non exclues", () => {
    expect(appelantInitial({ beneficiaireId: "a", canal: "humain", exclue: false }, habituels)).toBe("marc");
    expect(appelantInitial({ beneficiaireId: "a", canal: "humain", exclue: true }, habituels)).toBeNull();
    expect(appelantInitial({ beneficiaireId: "b", canal: "ia", exclue: false }, habituels)).toBeNull();
    expect(appelantInitial({ beneficiaireId: "c", canal: "humain", exclue: false }, habituels)).toBeNull();
  });
});
