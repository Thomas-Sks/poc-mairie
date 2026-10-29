import { describe, expect, it } from "vitest";
import type { Contexte } from "@/shared/application/contexte";
import { AccesRefuse } from "@/shared/domain/permissions";
import { GRILLE_PAR_DEFAUT } from "@/shared/domain/priorite";
import type { Role } from "@/shared/domain/vocabulaire";
import type { ParametresCommune } from "../domain/parametres";
import type { FichePourScore, ParametresRepository } from "./ports";
import { recalculerScores } from "./recalculer-scores";

const ctx = (role: Role): Contexte => ({
  utilisateur: { id: "u", prenom: "Sophie", nom: "Lambert", role, communeId: "c" },
  commune: { id: "c", nom: "Lomme", structureNom: "", structureTelephone: "" },
  maintenant: new Date("2026-10-28T10:00:00Z"),
});

const fiche = (id: string, modeDeVie: "seul" | "couple", niveauForce: FichePourScore["niveauForce"] = null): FichePourScore => ({
  id,
  score: 0,
  niveauPriorite: "P3",
  niveauForce,
  faits: {
    beneficiaire: { dateNaissance: "1936-01-01", modeDeVie, deplacement: "seul", protection: "non", troublesCognitifs: false, pasDeTelephone: false, retourHospitalisationLe: null, gir: null, aideCaisseRetraite: false },
    foyer: { sousLesToits: false, pieceFraiche: true, etage: 2, typeLogement: "appartement" },
    cercle: [{ relation: "enfant", possedeCles: true, ville: "Lomme", telephone: "06" }],
    prisesEnCharge: [{ type: "aide_domicile", possedeCles: false, dateFin: null, gir: null }],
  },
});

function depot(fiches: FichePourScore[], grille = GRILLE_PAR_DEFAUT) {
  const enregistres: { id: string; score: number; niveauPriorite: string }[] = [];
  const parametres: ParametresCommune = {
    grilleScore: grille,
  };
  const repo: ParametresRepository = {
    lire: async () => parametres,
    enregistrer: async () => {},
    fichesActivesPourScore: async () => fiches,
    enregistrerScores: async (_c, s) => void enregistres.push(...s),
    equipe: async () => [],
  };
  return { repo, enregistres };
}

describe("recalculerScores", () => {
  it("recalcule avec la grille de la commune et respecte un niveau forcé", async () => {
    // 90 ans : 15 pts ; seul : +20 → 35 (P2 avec la grille par défaut).
    const grille = { ...GRILLE_PAR_DEFAUT, seuilP1: 30, seuilP2: 10 };
    const { repo, enregistres } = depot([fiche("seule", "seul"), fiche("couple", "couple"), fiche("forcee", "seul", "P3")], grille);
    const bilan = await recalculerScores({ parametres: repo }, ctx("admin"));
    expect(bilan.fiches).toBe(3);
    expect(enregistres).toEqual([
      { id: "seule", score: 35, niveauPriorite: "P1" },
      { id: "couple", score: 15, niveauPriorite: "P2" },
      { id: "forcee", score: 35, niveauPriorite: "P3" },
    ]);
    expect(bilan.niveauxModifies).toBe(2);
  });

  it("est réservé à l'administrateur", async () => {
    const { repo } = depot([]);
    await expect(recalculerScores({ parametres: repo }, ctx("agent"))).rejects.toBeInstanceOf(AccesRefuse);
  });
});
