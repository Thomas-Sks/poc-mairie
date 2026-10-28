import { describe, expect, it } from "vitest";
import {
  anniversairesAVenir,
  contactsDus,
  fichesAReverifier,
  libelleRetard,
  nouvelleEcheance,
  retirerMois,
  selectionnerRappels,
  selectionnerTachesDuJour,
  type PersonneSuivie,
  type Rappel,
} from "./taches-du-jour";

const JOUR = "2026-10-28";

const rappel = (r: Partial<Rappel>): Rappel => ({
  id: r.id ?? "r",
  objet: r.objet ?? "Appeler",
  type: "manuel",
  echeance: JOUR,
  urgent: false,
  faitLe: null,
  assigneA: null,
  beneficiaire: null,
  ...r,
});

const personne = (p: Partial<PersonneSuivie>): PersonneSuivie => ({
  id: p.id ?? "p",
  nom: p.nom ?? "Mme Test",
  dateNaissance: "1950-01-15",
  dateInscription: "2024-01-01",
  dateDerniereVerification: "2026-06-01",
  frequenceContactJours: null,
  dernierContact: null,
  ...p,
});

describe("selectionnerRappels", () => {
  it("garde les rappels du jour et en retard non faits, sans les rappels futurs", () => {
    const res = selectionnerRappels(
      [
        rappel({ id: "jour", echeance: JOUR }),
        rappel({ id: "retard", echeance: "2026-10-23" }),
        rappel({ id: "futur", echeance: "2026-11-01" }),
        rappel({ id: "fait", echeance: "2026-10-27", faitLe: new Date() }),
      ],
      JOUR,
    );
    expect(res.map((r) => r.id)).toEqual(["retard", "jour"]);
    expect(res[0].joursDeRetard).toBe(5);
    expect(res[1].joursDeRetard).toBe(0);
  });

  it("place les rappels urgents en tête", () => {
    const res = selectionnerRappels([rappel({ id: "retard", echeance: "2026-10-20" }), rappel({ id: "urgent", urgent: true })], JOUR);
    expect(res.map((r) => r.id)).toEqual(["urgent", "retard"]);
  });
});

describe("nouvelleEcheance", () => {
  it("reporte à demain, dans 3 jours ou dans une semaine", () => {
    expect(nouvelleEcheance("demain", JOUR)).toBe("2026-10-29");
    expect(nouvelleEcheance("trois_jours", JOUR)).toBe("2026-10-31");
    expect(nouvelleEcheance("semaine", JOUR)).toBe("2026-11-04");
  });
});

describe("anniversairesAVenir", () => {
  it("retient les anniversaires dans la fenêtre et signale les anniversaires ronds", () => {
    const res = anniversairesAVenir(
      [
        personne({ id: "simone", dateNaissance: "1936-10-29" }), // 90 ans demain
        personne({ id: "j3", dateNaissance: "1941-10-31" }), // 85 ans dans 3 jours
        personne({ id: "j4", dateNaissance: "1941-11-01" }), // hors fenêtre
        personne({ id: "jour", dateNaissance: "1946-10-28" }), // 80 ans aujourd'hui
      ],
      JOUR,
      3,
    );
    expect(res.map((a) => [a.personne.id, a.age, a.dansJours, a.rond])).toEqual([
      ["jour", 80, 0, true],
      ["simone", 90, 1, true],
      ["j3", 85, 3, false],
    ]);
  });

  it("passe l'année quand l'anniversaire est en début d'année suivante", () => {
    const res = anniversairesAVenir([personne({ dateNaissance: "1930-01-01" })], "2026-12-30", 3);
    expect(res[0]).toMatchObject({ date: "2027-01-01", age: 97, dansJours: 2 });
  });
});

describe("retirerMois", () => {
  it("retire des mois en gérant les fins de mois et les années", () => {
    expect(retirerMois("2026-10-28", 12)).toBe("2025-10-28");
    expect(retirerMois("2026-03-31", 1)).toBe("2026-02-28");
    expect(retirerMois("2026-01-15", 2)).toBe("2025-11-15");
  });
});

describe("fichesAReverifier", () => {
  it("retient les fiches non vérifiées depuis plus de N mois, les plus anciennes d'abord", () => {
    const res = fichesAReverifier(
      [
        personne({ id: "recente", dateDerniereVerification: "2026-01-10" }),
        personne({ id: "ancienne", dateDerniereVerification: "2024-05-01" }),
        personne({ id: "limite", dateDerniereVerification: "2025-10-28" }),
        personne({ id: "jamais", dateDerniereVerification: null, dateInscription: "2025-02-01" }),
      ],
      JOUR,
      12,
    );
    expect(res.map((f) => f.personne.id)).toEqual(["ancienne", "jamais"]);
    expect(res[1].depuis).toBe("2025-02-01");
  });
});

describe("contactsDus", () => {
  it("retient les personnes dont le dernier contact dépasse la fréquence cible", () => {
    const res = contactsDus(
      [
        personne({ id: "sans-frequence", dernierContact: "2026-01-01" }),
        personne({ id: "a-jour", frequenceContactJours: 14, dernierContact: "2026-10-20" }),
        personne({ id: "du", frequenceContactJours: 14, dernierContact: "2026-10-14" }),
        personne({ id: "tres-en-retard", frequenceContactJours: 14, dernierContact: "2026-09-01" }),
        personne({ id: "jamais", frequenceContactJours: 30, dernierContact: null, dateInscription: "2026-10-10" }),
      ],
      JOUR,
    );
    expect(res.map((c) => c.personne.id)).toEqual(["tres-en-retard", "du"]);
    expect(res[1]).toMatchObject({ joursSansContact: 14, retard: 0 });
  });

  it("compte depuis l'inscription quand aucun contact n'est enregistré", () => {
    const res = contactsDus([personne({ frequenceContactJours: 30, dernierContact: null, dateInscription: "2026-08-01" })], JOUR);
    expect(res[0]).toMatchObject({ joursSansContact: null, retard: 58 });
  });
});

describe("selectionnerTachesDuJour", () => {
  it("assemble les quatre familles de tâches", () => {
    const res = selectionnerTachesDuJour(
      {
        rappels: [rappel({})],
        personnes: [personne({ dateNaissance: "1936-10-29", dateDerniereVerification: "2020-01-01" })],
        parametres: { anniversaireJoursAvant: 3, verificationMois: 12 },
      },
      JOUR,
    );
    expect(res.rappels).toHaveLength(1);
    expect(res.anniversaires).toHaveLength(1);
    expect(res.fichesAReverifier).toHaveLength(1);
    expect(res.contactsDus).toHaveLength(0);
  });
});

describe("libelleRetard", () => {
  it("formule le retard", () => {
    expect(libelleRetard(0)).toBe("Aujourd'hui");
    expect(libelleRetard(1)).toBe("En retard d'1 jour");
    expect(libelleRetard(4)).toBe("En retard de 4 jours");
  });
});
