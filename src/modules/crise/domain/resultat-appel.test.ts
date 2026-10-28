import { describe, expect, it } from "vitest";
import { RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import { deciderResultatAppel, objetRappelBesoin, type EtatCible } from "./resultat-appel";

const MAINTENANT = new Date("2026-10-28T09:00:00Z");
const neuf: EtatCible = { statut: "a_appeler", nbTentatives: 0, rangCercleEssaye: 0 };

describe("deciderResultatAppel (RG-04)", () => {
  it("1re non-réponse : reprogrammée à +30 min", () => {
    const d = deciderResultatAppel(neuf, { resultat: "ne_repond_pas", nbContactsCercle: 2 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint", nbTentatives: 1, appelerCercle: false, notification: null });
    expect(d.prochaineTentativeAt?.toISOString()).toBe("2026-10-28T09:30:00.000Z");
  });

  it("2e non-réponse : reprogrammée à +2 h", () => {
    const d = deciderResultatAppel({ ...neuf, statut: "non_joint", nbTentatives: 1 }, { resultat: "messagerie", nbContactsCercle: 2 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "messagerie", nbTentatives: 2 });
    expect(d.prochaineTentativeAt?.toISOString()).toBe("2026-10-28T11:00:00.000Z");
  });

  it("3e non-réponse : escalade vers le cercle", () => {
    const d = deciderResultatAppel({ ...neuf, statut: "non_joint", nbTentatives: 2 }, { resultat: "ne_repond_pas", nbContactsCercle: 2 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint", nbTentatives: 3, appelerCercle: true, prochaineTentativeAt: null, notification: null });
  });

  it("3e non-réponse sans cercle : non joint à traiter + notification", () => {
    const d = deciderResultatAppel({ ...neuf, nbTentatives: 2 }, { resultat: "ne_repond_pas", nbContactsCercle: 0 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint_a_traiter", notification: "escalade" });
  });

  it("cercle : rang 1 ne répond pas → rang suivant ; dernier rang → à traiter", () => {
    const etat = { statut: "non_joint" as const, nbTentatives: 3, rangCercleEssaye: 0 };
    const d1 = deciderResultatAppel(etat, { resultat: "proche_ne_repond_pas", rangCercle: 1, nbContactsCercle: 2 }, MAINTENANT);
    expect(d1).toMatchObject({ statut: "non_joint", rangCercleEssaye: 1, appelerCercle: true });
    const d2 = deciderResultatAppel({ ...etat, rangCercleEssaye: 1 }, { resultat: "proche_ne_repond_pas", rangCercle: 2, nbContactsCercle: 2 }, MAINTENANT);
    expect(d2).toMatchObject({ statut: "non_joint_a_traiter", rangCercleEssaye: 2, notification: "escalade" });
  });

  it("un proche confirme : couvert par un proche (terminal)", () => {
    const d = deciderResultatAppel({ ...neuf, nbTentatives: 3 }, { resultat: "couvert_proche", rangCercle: 1, nbContactsCercle: 2 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "couvert_proche", couverture: "proche", nbTentatives: 3 });
  });

  it("joint avec besoin : crée un rappel", () => {
    const d = deciderResultatAppel(neuf, { resultat: "joint_besoin", nbContactsCercle: 0 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "joint_besoin", couverture: "appel", creerRappelBesoin: true, nbTentatives: 1 });
  });

  it("absent du domicile : couvert par l'absence", () => {
    expect(deciderResultatAppel(neuf, { resultat: "absent", nbContactsCercle: 2 }, MAINTENANT)).toMatchObject({
      statut: "absent",
      couverture: "absence",
      nbTentatives: 1,
      appelerCercle: false,
    });
  });

  it("3e non-réponse, cercle partiellement essayé avant : rang suivant", () => {
    const d = deciderResultatAppel({ ...neuf, statut: "non_joint", nbTentatives: 2, rangCercleEssaye: 1 }, { resultat: "ne_repond_pas", nbContactsCercle: 2 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint", appelerCercle: true, notification: null });
  });

  it("3e non-réponse, cercle déjà épuisé : à traiter", () => {
    const d = deciderResultatAppel({ ...neuf, statut: "non_joint", nbTentatives: 2, rangCercleEssaye: 1 }, { resultat: "ne_repond_pas", nbContactsCercle: 1 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint_a_traiter", notification: "escalade", appelerCercle: false });
  });

  it("escalade cercle désactivée : à traiter directement après la dernière tentative", () => {
    const relance = { ...RELANCE_PAR_DEFAUT, escaladeCercle: false };
    const d = deciderResultatAppel({ ...neuf, nbTentatives: 2 }, { resultat: "ne_repond_pas", nbContactsCercle: 2 }, MAINTENANT, relance);
    expect(d).toMatchObject({ statut: "non_joint_a_traiter", notification: "escalade" });
  });

  it("proche ne répond pas avant la dernière tentative : statut et relance conservés (E10-US5, cercle en parallèle)", () => {
    const relance = new Date("2026-10-28T09:30:00Z");
    const etat: EtatCible = { statut: "non_joint", nbTentatives: 1, rangCercleEssaye: 0, prochaineTentativeAt: relance };
    const suivant = deciderResultatAppel(etat, { resultat: "proche_ne_repond_pas", rangCercle: 1, nbContactsCercle: 2 }, MAINTENANT);
    expect(suivant).toMatchObject({ statut: "non_joint", nbTentatives: 1, rangCercleEssaye: 1, appelerCercle: true, prochaineTentativeAt: relance });
    const epuise = deciderResultatAppel(etat, { resultat: "proche_ne_repond_pas", rangCercle: 1, nbContactsCercle: 1 }, MAINTENANT);
    expect(epuise).toMatchObject({ statut: "non_joint", rangCercleEssaye: 1, appelerCercle: false, notification: null, prochaineTentativeAt: relance });
  });

  it("un proche confirme dès la 1re tentative : couvert, relance annulée", () => {
    const etat: EtatCible = { statut: "non_joint", nbTentatives: 1, rangCercleEssaye: 0, prochaineTentativeAt: new Date("2026-10-28T09:30:00Z") };
    expect(deciderResultatAppel(etat, { resultat: "couvert_proche", rangCercle: 1, nbContactsCercle: 2 }, MAINTENANT)).toMatchObject({
      statut: "couvert_proche",
      couverture: "proche",
      rangCercleEssaye: 1,
      prochaineTentativeAt: null,
    });
  });

  it("danger et évacuation : notification immédiate", () => {
    expect(deciderResultatAppel(neuf, { resultat: "danger", nbContactsCercle: 0 }, MAINTENANT).notification).toBe("danger");
    expect(deciderResultatAppel(neuf, { resultat: "evacuation", nbContactsCercle: 0 }, MAINTENANT)).toMatchObject({ statut: "evacuation", notification: "danger" });
  });

  it("numéro invalide : pas de relance, passage direct au cercle, fiche à vérifier", () => {
    const d = deciderResultatAppel(neuf, { resultat: "numero_invalide", nbContactsCercle: 1 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "numero_invalide", appelerCercle: true, prochaineTentativeAt: null, creerRappelVerification: true });
  });

  it("numéro invalide sans cercle : à traiter tout de suite", () => {
    const d = deciderResultatAppel(neuf, { resultat: "numero_invalide", nbContactsCercle: 0 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint_a_traiter", notification: "escalade", creerRappelVerification: true });
  });

  it("numéro invalide puis dernier proche injoignable : à traiter (pas de relance possible)", () => {
    const etat: EtatCible = { statut: "numero_invalide", nbTentatives: 1, rangCercleEssaye: 0 };
    const d = deciderResultatAppel(etat, { resultat: "proche_ne_repond_pas", rangCercle: 1, nbContactsCercle: 1 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "non_joint_a_traiter", notification: "escalade" });
  });

  it("objet de la tâche de besoin : besoins, précision, campagne en suffixe (compté par le rapport)", () => {
    expect(objetRappelBesoin("Mme Simone Dupont", ["eau", "medicaments"], "Canicule juillet", "pack de 6")).toBe(
      "Besoin signalé (Eau, Médicaments) : Mme Simone Dupont (pack de 6) – Canicule juillet",
    );
    expect(objetRappelBesoin("M. André Martin", [], "Canicule juillet")).toBe("Besoin signalé (à préciser) : M. André Martin – Canicule juillet");
  });

  it("joint RAS : couvert par appel", () => {
    expect(deciderResultatAppel(neuf, { resultat: "joint_ras", nbContactsCercle: 0 }, MAINTENANT)).toMatchObject({ statut: "joint_ras", couverture: "appel" });
  });
});
