import { describe, expect, it } from "vitest";
import { deciderResultatAppel, type EtatCible } from "./resultat-appel";

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
    const d = deciderResultatAppel(neuf, { resultat: "joint_besoin", besoins: ["eau"], nbContactsCercle: 0 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "joint_besoin", couverture: "appel", creerRappelBesoin: true, nbTentatives: 1 });
  });

  it("danger et évacuation : notification immédiate", () => {
    expect(deciderResultatAppel(neuf, { resultat: "danger", nbContactsCercle: 0 }, MAINTENANT).notification).toBe("danger");
    expect(deciderResultatAppel(neuf, { resultat: "evacuation", nbContactsCercle: 0 }, MAINTENANT)).toMatchObject({ statut: "evacuation", notification: "danger" });
  });

  it("numéro invalide : pas de relance, passage direct au cercle", () => {
    const d = deciderResultatAppel(neuf, { resultat: "numero_invalide", nbContactsCercle: 1 }, MAINTENANT);
    expect(d).toMatchObject({ statut: "numero_invalide", appelerCercle: true, prochaineTentativeAt: null });
  });

  it("joint RAS : couvert par appel", () => {
    expect(deciderResultatAppel(neuf, { resultat: "joint_ras", nbContactsCercle: 0 }, MAINTENANT)).toMatchObject({ statut: "joint_ras", couverture: "appel" });
  });
});
