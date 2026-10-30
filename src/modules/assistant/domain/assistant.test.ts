import { describe, expect, it } from "vitest";
import { QUESTIONS_SUGGEREES } from "@/modules/statistiques/domain/analyseur";
import { definitionVide, type Referentiels } from "@/modules/statistiques/domain/requete";
import { appliquerSecret } from "@/modules/statistiques/domain/secret";
import type { Contexte } from "@/shared/application/contexte";
import { interpreter } from "../application/repondre";
import type { InterpretationsRepository, Interpreteur } from "../application/ports";
import { appelDepuisAnalyseur, cleQuestion, lireAppel } from "./appel";
import { chiffrer, decrireCompris, reponseChiffre, reponsePersonnes } from "./reponse";

const REF: Referentiels = { quartiers: ["Bourg", "Marais", "Délivrance"], campagnes: [] };

const ctx: Contexte = {
  utilisateur: { id: "u", prenom: "Julie", nom: "MOREAU", role: "agent", communeId: "c" },
  commune: { id: "c", nom: "Lomme", structureNom: "Maison des seniors", structureTelephone: "" },
  maintenant: new Date("2026-10-29T10:00:00Z"),
};

function memoire(): InterpretationsRepository & { nb: () => number } {
  const m = new Map<string, { appel: unknown; source: "ia" | "analyseur" }>();
  return {
    trouver: async (_c, cle) => m.get(cle) ?? null,
    enregistrer: async (_c, cle, appel, source) => void (m.has(cle) || m.set(cle, { appel, source })),
    nb: () => m.size,
  };
}

describe("clé d'une question", () => {
  it("ignore la casse, les accents, la ponctuation et les espaces", () => {
    expect(cleQuestion("  Combien de FEMMES âgées ?! ")).toBe(cleQuestion("combien de femmes agees"));
  });
});

describe("interprétation sans IA (analyseur)", () => {
  it("compte quand on demande « combien »", () => {
    const a = appelDepuisAnalyseur("Combien d'hommes de plus de 80 ans touchent l'APA ?", REF);
    expect(a.outil).toBe("compter");
  });

  it("liste quand on demande une liste, sans découpage", () => {
    const a = appelDepuisAnalyseur("Liste des personnes P1 qui vivent seules, par quartier", REF);
    expect(a).toMatchObject({ outil: "lister_personnes", definition: { sujet: "beneficiaires", decoupage: null } });
    if (a.outil === "lister_personnes") expect(a.definition.filtres).toContainEqual({ champ: "priorite", operateur: "est", valeur: "P1" });
  });

  it("cherche une fiche par le nom", () => {
    expect(appelDepuisAnalyseur("Fiche de Mme Vasseur", REF)).toEqual({ outil: "chercher_personne", texte: "vasseur" });
  });

  it("ne comprend pas une question hors du registre", () => {
    expect(appelDepuisAnalyseur("Quel temps fera-t-il demain ?", REF)).toEqual({ outil: "inconnu" });
  });

  it("comprend toutes les questions suggérées", () => {
    for (const q of QUESTIONS_SUGGEREES) expect(appelDepuisAnalyseur(q, REF).outil, q).not.toBe("inconnu");
  });
});

describe("validation des appels (réponse de l'IA)", () => {
  it("refuse un champ inconnu ou une valeur hors liste", () => {
    const appel = (champ: string, valeur: string) => ({
      outil: "compter",
      definition: { ...definitionVide(), filtres: [{ champ, operateur: "est", valeur }] },
    });
    expect(lireAppel(appel("sexe", "M"))).not.toBeNull();
    expect(lireAppel(appel("salaire", "1000"))).toBeNull();
    expect(lireAppel(appel("sexe", "X"))).toBeNull();
    expect(lireAppel({ outil: "supprimer_tout" })).toBeNull();
  });
});

describe("déterminisme", () => {
  it("rejoue l'appel enregistré : l'IA n'est interrogée qu'une fois par question", async () => {
    let appelsIa = 0;
    const ia: Interpreteur = {
      interpreter: async () => {
        appelsIa++;
        return { outil: "compter", definition: { ...definitionVide(), filtres: [{ champ: "sexe", operateur: "est", valeur: "F" }] } };
      },
    };
    const interpretations = memoire();
    const a = await interpreter({ interpretations, interpreteur: ia }, ctx, "Combien de femmes ?", REF);
    const b = await interpreter({ interpretations, interpreteur: ia }, ctx, "combien de FEMMES", REF);
    expect(b.appel).toEqual(a.appel);
    expect(appelsIa).toBe(1);
  });

  it("se rabat sur l'analyseur si l'IA échoue, et ne fige pas une incompréhension", async () => {
    const enPanne: Interpreteur = {
      interpreter: async () => {
        throw new Error("hors service");
      },
    };
    const interpretations = memoire();
    const r = await interpreter({ interpretations, interpreteur: enPanne }, ctx, "Combien de personnes vivent seules ?", REF);
    expect(r).toMatchObject({ source: "analyseur", appel: { outil: "compter" } });
    await interpreter({ interpretations, interpreteur: null }, ctx, "Bonjour", REF);
    expect(interpretations.nb()).toBe(1);
  });

  it("rejette un appel invalide de l'IA et utilise l'analyseur", async () => {
    const fantaisiste: Interpreteur = { interpreter: async () => ({ outil: "compter", definition: { sujet: "chats" } }) };
    const r = await interpreter({ interpretations: memoire(), interpreteur: fantaisiste }, ctx, "Combien de femmes ?", REF);
    expect(r.source).toBe("analyseur");
  });
});

describe("gabarits de réponse", () => {
  const d = { ...definitionVide(), filtres: [{ champ: "mode_de_vie" as const, operateur: "est" as const, valeur: "seul" }], decoupage: "quartier" as const };

  it("décrit ce qui a été compris en mots simples", () => {
    expect(decrireCompris(d, REF)).toEqual(["Mode de vie = Vit seul(e)", "Par quartier"]);
  });

  it("formule le total et les lignes, secret statistique compris", () => {
    const r = appliquerSecret({ total: 12, totalComparaison: null, decoupage: "quartier", lignes: [
      { cle: "Bourg", libelle: "Bourg", n: 9, nComparaison: null },
      { cle: "Marais", libelle: "Marais", n: 3, nComparaison: null },
    ] }, true);
    expect(chiffrer(d, r)).toEqual({
      phrase: "12 personnes",
      lignes: [
        { libelle: "Bourg", effectif: "9", part: 1 },
        { libelle: "Marais", effectif: "< 5", part: 0 },
      ],
    });
    expect(chiffrer(d, { ...r, total: 1 }).phrase).toBe("1 personne");
    expect(chiffrer(d, { ...r, total: 0, lignes: [] }).phrase).toBe("0 personne");
  });

  it("filtre le tableau sur les personnes, ou répond en une ligne pour les autres sujets", () => {
    const r = appliquerSecret({ total: 2, totalComparaison: null, decoupage: null, lignes: [] }, false);
    expect(reponsePersonnes(d, r, ["a", "b"], REF)).toMatchObject({ type: "personnes", ids: ["a", "b"], phrase: "2 personnes" });
    const appels = { ...definitionVide("appels_campagne"), filtres: [] };
    expect(reponseChiffre(appels, r, REF)).toMatchObject({ type: "chiffre", phrase: "2 appels", compris: ["Appels de campagne"] });
  });
});
