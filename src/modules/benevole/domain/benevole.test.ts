import { describe, expect, it } from "vitest";
import { RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import { deciderResultatAppel, type EtatCible } from "@/modules/crise/domain/resultat-appel";
import { SCRIPT_CANICULE, SCRIPT_GRAND_FROID, SCRIPT_INONDATION } from "@/modules/crise/domain/scripts-par-defaut";
import { besoinsPreselectionnes } from "./besoins";
import { ajouterALaFile, lireFile, messageFile, retirerDeLaFile, synchroniserFile, type ElementFile } from "./file-hors-ligne";
import { personneSuivante, trierMaListe, type ElementListe } from "./ma-liste";
import { evaluerReponses, filtrerReponses } from "./questions";
import {
  precisionProche,
  RESULTATS_APPEL,
  RESULTATS_PROCHE,
  resultatCampagne,
  resultatCampagneProche,
  type ResultatAppel,
  type ResultatProche,
} from "./resultats";
import { nomPrononce, rendreTexte } from "./script";

const VARIABLES = {
  civilite: "Mme",
  nom: "Dupont",
  prenom: "Simone",
  prenomAppelant: "Marc",
  structure: "Maison des seniors de Lomme",
  commune: "Lomme",
};

describe("E10-US4 bis : rendu du script", () => {
  it("injecte civilité, nom, prénom de l'appelant et structure", () => {
    expect(rendreTexte(SCRIPT_CANICULE.introduction, VARIABLES)).toMatch(
      /^Bonjour Mme Dupont, je suis Marc de Maison des seniors de Lomme\. Comme vous/,
    );
    expect(rendreTexte(SCRIPT_CANICULE.conclusion, VARIABLES)).toContain("contacter Maison des seniors de Lomme si besoin");
  });

  it("remplace toutes les occurrences et laisse une variable inconnue visible", () => {
    expect(rendreTexte("{nom} {nom} {inconnue} {commune}", VARIABLES)).toBe("Dupont Dupont {inconnue} Lomme");
  });

  it("ne remplace pas les propriétés héritées de l'objet", () => {
    expect(rendreTexte("{constructor}", VARIABLES)).toBe("{constructor}");
  });

  it("met le nom en forme pour la lecture", () => {
    expect(nomPrononce("DUPONT")).toBe("Dupont");
    expect(nomPrononce("LE GALL-MÉNARD")).toBe("Le Gall-Ménard");
    expect(nomPrononce("D'ARTOIS")).toBe("D'Artois");
  });
});

describe("E10-US4 : questions et consignes conditionnelles", () => {
  it("ne signale rien quand tout va bien", () => {
    const e = evaluerReponses(SCRIPT_CANICULE.questions, { q1: "oui", q2: "oui", q3: "oui" });
    expect(e).toEqual({ preoccupantes: [], consignes: [], afficherEncart: false, statutPropose: null, besoins: [], tags: [] });
  });

  it("canicule Q1 « non » : conseil à lire et statut « besoin signalé » proposé", () => {
    const e = evaluerReponses(SCRIPT_CANICULE.questions, { q1: "non" });
    expect(e.consignes).toEqual([{ questionId: "q1", texte: expect.stringContaining("buvez de l'eau") }]);
    expect(e.statutPropose).toBe("joint_besoin");
  });

  it("canicule Q2 « non » : tag isolement ; Q3 « non » : encart des recommandations", () => {
    const e = evaluerReponses(SCRIPT_CANICULE.questions, { q2: "non", q3: "non" });
    expect(e.tags).toEqual(["isolement"]);
    expect(e.afficherEncart).toBe(true);
    expect(e.statutPropose).toBeNull();
  });

  it("sans réponse, la question n'est pas préoccupante", () => {
    expect(evaluerReponses(SCRIPT_CANICULE.questions, {}).preoccupantes).toEqual([]);
  });

  it("le statut le plus grave l'emporte (inondation : danger avant relogement et besoin)", () => {
    const e = evaluerReponses(SCRIPT_INONDATION.questions, { q1: "non", q3: "non", q4: "non" });
    expect(e.statutPropose).toBe("danger");
    expect(evaluerReponses(SCRIPT_INONDATION.questions, { q3: "non", q4: "non" }).statutPropose).toBe("evacuation");
  });

  it("une réponse préoccupante « oui » (inondation Q2 : l'eau est entrée) affiche l'encart", () => {
    const e = evaluerReponses(SCRIPT_INONDATION.questions, { q2: "oui" });
    expect(e.afficherEncart).toBe(true);
    expect(e.besoins).toEqual(["logement"]);
  });

  it("dédoublonne besoins et tags (grand froid)", () => {
    const e = evaluerReponses(SCRIPT_GRAND_FROID.questions, { q2: "non", q3: "non", q4: "non" });
    expect(e.besoins).toEqual(["chauffage", "isolement", "courses"]);
    expect(e.tags).toEqual(["isolement"]);
  });

  it("filtre les réponses venant du navigateur", () => {
    expect(filtrerReponses(SCRIPT_CANICULE.questions, { q1: "non", q9: "oui", q2: "peut-être", q3: "oui" })).toEqual({
      q1: "non",
      q3: "oui",
    });
  });
});

describe("Boutons bénévole → décision de campagne (RG-03, RG-04, E10-US5) : règles du module Crise", () => {
  const t0 = new Date("2026-07-06T10:00:00+02:00");
  const neuf: EtatCible = { statut: "a_appeler", nbTentatives: 0, rangCercleEssaye: 0 };
  const bouton = (r: ResultatAppel, etat: EtatCible = neuf, nbContactsCercle = 1) =>
    deciderResultatAppel(etat, { resultat: resultatCampagne(r), nbContactsCercle }, t0, RELANCE_PAR_DEFAUT);
  const proche = (r: ResultatProche, etat: EtatCible, rangCercle: number, nbContactsCercle: number) =>
    deciderResultatAppel(etat, { resultat: resultatCampagneProche(r), rangCercle, nbContactsCercle }, t0, RELANCE_PAR_DEFAUT);

  it("chaque bouton a son résultat de campagne", () => {
    expect(RESULTATS_APPEL.map(resultatCampagne)).toEqual(["joint_ras", "joint_besoin", "ne_repond_pas", "numero_invalide", "absent", "danger", "evacuation"]);
    expect(RESULTATS_PROCHE.map(resultatCampagneProche)).toEqual(["couvert_proche", "couvert_proche", "proche_ne_repond_pas"]);
    expect(precisionProche("va_passer")).toBe("Le proche va passer");
    expect(precisionProche("confirme")).toBeNull();
  });

  it("« tout va bien » : joint RAS, couvert par l'appel", () => {
    expect(bouton("tout_va_bien")).toMatchObject({ statut: "joint_ras", nbTentatives: 1, couverture: "appel", notification: null });
  });

  it("« danger » prévient le CCAS immédiatement", () => {
    expect(bouton("danger")).toMatchObject({ statut: "danger", notification: "danger" });
  });

  it("1re non-réponse : reprogrammée 30 minutes plus tard", () => {
    const m = bouton("ne_repond_pas");
    expect(m).toMatchObject({ statut: "non_joint", nbTentatives: 1 });
    expect(m.prochaineTentativeAt?.getTime()).toBe(t0.getTime() + 30 * 60_000);
  });

  it("dernière tentative, cercle pas encore essayé : on appelle le cercle", () => {
    expect(bouton("ne_repond_pas", { ...neuf, nbTentatives: 2 })).toMatchObject({
      statut: "non_joint",
      prochaineTentativeAt: null,
      appelerCercle: true,
      notification: null,
    });
  });

  it("dernière tentative, cercle déjà essayé ou injoignable : transmis au CCAS", () => {
    expect(bouton("ne_repond_pas", { ...neuf, nbTentatives: 2, rangCercleEssaye: 1 })).toMatchObject({
      statut: "non_joint_a_traiter",
      notification: "escalade",
    });
    expect(bouton("ne_repond_pas", { ...neuf, nbTentatives: 2 }, 0).statut).toBe("non_joint_a_traiter");
  });

  it("le proche confirme ou va passer : couvert par un proche", () => {
    for (const r of ["confirme", "va_passer"] as const) {
      expect(proche(r, { statut: "non_joint", nbTentatives: 1, rangCercleEssaye: 0 }, 1, 2)).toMatchObject({
        statut: "couvert_proche",
        couverture: "proche",
      });
    }
  });

  it("le proche ne répond pas : contact suivant, puis CCAS si plus aucune tentative", () => {
    const relance = new Date("2026-07-06T10:30:00+02:00");
    const apres1 = { statut: "non_joint" as const, nbTentatives: 1, rangCercleEssaye: 0, prochaineTentativeAt: relance };
    // Proche suivant : la personne reste non jointe, sa relance est conservée.
    expect(proche("ne_repond_pas", apres1, 1, 2)).toMatchObject({ statut: "non_joint", appelerCercle: true, rangCercleEssaye: 1, prochaineTentativeAt: relance });
    // Plus personne mais des tentatives restent : on attend la relance, sans alerter.
    expect(proche("ne_repond_pas", apres1, 1, 1)).toMatchObject({ statut: "non_joint", appelerCercle: false, notification: null, prochaineTentativeAt: relance });
    // Plus personne et toutes les tentatives faites : le CCAS prend le relais.
    expect(proche("ne_repond_pas", { ...apres1, nbTentatives: 3, prochaineTentativeAt: null }, 1, 1)).toMatchObject({
      statut: "non_joint_a_traiter",
      notification: "escalade",
    });
  });
});

describe("E10-US3 Ma liste", () => {
  const maintenant = new Date("2026-07-06T10:00:00+02:00");
  const el = (id: string, x: Partial<ElementListe>): ElementListe & { id: string } => ({
    id,
    statut: "a_appeler",
    niveau: "P2",
    score: 40,
    prochaineTentativeAt: null,
    verrouilleParAutre: false,
    ...x,
  });

  it("trie par priorité puis heure de rappel et sépare ce qui est fait", () => {
    const liste = [
      el("p3", { niveau: "P3", score: 10 }),
      el("rappel", { niveau: "P1", score: 70, statut: "non_joint", prochaineTentativeAt: new Date("2026-07-06T10:30:00+02:00") }),
      el("p1", { niveau: "P1", score: 70 }),
      el("fait", { niveau: "P1", score: 90, statut: "joint_ras" }),
    ];
    const { aFaire, faits } = trierMaListe(liste);
    expect(aFaire.map((e) => e.id)).toEqual(["p1", "rappel", "p3"]);
    expect(faits.map((e) => e.id)).toEqual(["fait"]);
  });

  it("personne suivante : ignore les rappels pas encore dus et les personnes déjà en ligne avec un autre", () => {
    const liste = [
      el("plus-tard", { niveau: "P1", statut: "non_joint", prochaineTentativeAt: new Date("2026-07-06T10:30:00+02:00") }),
      el("verrou", { niveau: "P1", verrouilleParAutre: true }),
      el("ok", { niveau: "P2" }),
    ];
    expect(personneSuivante(liste, maintenant)?.id).toBe("ok");
    expect(personneSuivante([liste[0]], new Date("2026-07-06T10:31:00+02:00"))?.id).toBe("plus-tard");
    expect(personneSuivante([el("fait", { statut: "joint_ras" })], maintenant)).toBeNull();
  });
});

describe("E10-US7 besoins", () => {
  it("ne présélectionne que les choix rapides", () => {
    expect(besoinsPreselectionnes(["isolement", "courses", "eau"])).toEqual(["courses", "eau"]);
  });
});

describe("E10-US8 file hors connexion", () => {
  const a: ElementFile<string> = { id: "a", creeLe: "2026-07-06T10:00:00Z", operation: "A" };
  const b: ElementFile<string> = { id: "b", creeLe: "2026-07-06T10:01:00Z", operation: "B" };
  const c: ElementFile<string> = { id: "c", creeLe: "2026-07-06T10:02:00Z", operation: "C" };

  it("ajoute sans doublon et retire", () => {
    const file = ajouterALaFile(ajouterALaFile([a], b), a);
    expect(file.map((e) => e.id)).toEqual(["a", "b"]);
    expect(retirerDeLaFile(file, "a").map((e) => e.id)).toEqual(["b"]);
  });

  it("renvoie dans l'ordre et s'arrête à la première coupure réseau", async () => {
    const envoyes: string[] = [];
    const r = await synchroniserFile([a, b, c], async (op) => {
      if (op === "B") throw new Error("réseau");
      envoyes.push(op);
      return "accepte";
    });
    expect(envoyes).toEqual(["A"]);
    expect(r.restante.map((e) => e.id)).toEqual(["b", "c"]);
    expect(r.envoyes).toBe(1);
  });

  it("retire un élément refusé définitivement", async () => {
    const r = await synchroniserFile([a, b], async (op) => (op === "A" ? "refuse" : "accepte"));
    expect(r).toEqual({ restante: [], envoyes: 1, refuses: 1 });
  });

  it("lit un stockage vide ou corrompu sans planter", () => {
    expect(lireFile(null)).toEqual([]);
    expect(lireFile("{pas du json")).toEqual([]);
    expect(lireFile(JSON.stringify([a, { id: 3 }]))).toEqual([a]);
  });

  it("affiche l'indication discrète", () => {
    expect(messageFile(2, false)).toBe("Hors connexion – 2 résultats en attente");
    expect(messageFile(1, true)).toBe("Envoi en cours – 1 résultat en attente");
    expect(messageFile(0, false)).toBe("Hors connexion");
    expect(messageFile(0, true)).toBeNull();
  });
});
