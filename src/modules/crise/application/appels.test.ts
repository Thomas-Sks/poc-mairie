import { describe, expect, it } from "vitest";
import type { Contexte } from "@/shared/application/contexte";
import { RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import { AccesRefuse } from "@/shared/domain/permissions";
import { enregistrerResultatAppel, VerrouPris } from "./appels";
import type { CibleAppel, DepotCrise, MiseAJourCible, NouvelleInteraction, Notifieur } from "./ports";

const MAINTENANT = new Date("2026-10-28T09:00:00Z");

const ctxDe = (role: "agent" | "benevole", id: string): Contexte => ({
  utilisateur: { id, prenom: role === "agent" ? "Julie" : "Marc", nom: "Test", role, communeId: "c" },
  commune: { id: "c", nom: "Lomme", structureNom: "", structureTelephone: "" },
  maintenant: MAINTENANT,
});
const julie = ctxDe("agent", "julie");
const marc = ctxDe("benevole", "marc");

function monter(cible: Partial<CibleAppel> = {}) {
  const etat: CibleAppel = {
    id: "cible",
    campagneId: "camp",
    communeId: "c",
    campagneStatut: "active",
    campagneNom: "Canicule",
    relance: RELANCE_PAR_DEFAUT,
    beneficiaireId: "b",
    beneficiaireNom: "Mme Simone Dupont",
    vagueDate: "2026-10-28",
    statut: "a_appeler",
    nbTentatives: 0,
    prochaineTentativeAt: null,
    rangCercleEssaye: 0,
    assigneA: "marc",
    verrouPar: null,
    verrouAt: null,
    besoins: [],
    nbContactsCercle: 2,
    ...cible,
  };
  const majs: MiseAJourCible[] = [];
  const interactions: NouvelleInteraction[] = [];
  const rappels: { type: string; objet: string; urgent: boolean }[] = [];
  const notifications: Parameters<Notifieur>[1][] = [];
  const depot = {
    obtenirCible: async () => etat,
    obtenirFicheAppel: async () => ({
      beneficiaireId: "b",
      civilite: "Mme",
      nom: "Dupont",
      prenom: "Simone",
      telephoneFixe: null,
      telephoneMobile: null,
      adresse: "",
      infoPrioritaire: null,
      cercle: [
        { id: "fille", rang: 1, relation: "Fille", nom: "Claire", telephone: "06", possedeCles: true },
        { id: "voisin", rang: 2, relation: "Voisin", nom: "Paul", telephone: "06", possedeCles: false },
      ],
    }),
    mettreAJourCible: async (_id: string, m: MiseAJourCible) => void majs.push(m),
    creerInteraction: async (_c: string, i: NouvelleInteraction) => (interactions.push(i), "i"),
    creerRappel: async (_c: string, r: { type: string; objet: string; urgent: boolean }) => void rappels.push(r),
    listerMembres: async () => [{ id: "julie", prenom: "Julie", nom: "Moreau", role: "agent" as const, telephone: "06 00" }],
  } as unknown as DepotCrise;
  const notifier: Notifieur = async (_ctx, n) => (notifications.push(n), 1);
  return { deps: { depot, notifier }, majs, interactions, rappels, notifications };
}

describe("enregistrerResultatAppel (cas d'usage commun agent / bénévole)", () => {
  it("danger : notification via notifier aux admin et agents, SMS simulé, verrou libéré", async () => {
    const m = monter();
    const r = await enregistrerResultatAppel(m.deps, marc, { cibleId: "cible", resultat: "danger", note: "Chute dans la cuisine" });
    expect(r.statut).toBe("danger");
    expect(m.notifications).toEqual([
      expect.objectContaining({ roles: ["admin", "agent"], type: "danger", titre: "Danger – urgence : Mme Simone Dupont", lien: "/campagnes/camp" }),
    ]);
    expect(r.smsSimules).toHaveLength(1);
    expect(m.majs[0]).toMatchObject({ statut: "danger", verrouPar: null, note: "Danger – urgence. Chute dans la cuisine" });
  });

  it("3e non-réponse : l'appelant garde le verrou pour appeler le cercle, sans notification", async () => {
    const m = monter({ statut: "non_joint", nbTentatives: 2 });
    await enregistrerResultatAppel(m.deps, marc, { cibleId: "cible", resultat: "ne_repond_pas" });
    expect(m.majs[0]).toMatchObject({ statut: "non_joint", nbTentatives: 3, verrouPar: "marc", verrouAt: MAINTENANT });
    expect(m.notifications).toEqual([]);
  });

  it("proche : le rang vient du cercle joignable, l'interaction cite le proche", async () => {
    const m = monter({ statut: "non_joint", nbTentatives: 3, rangCercleEssaye: 1 });
    const r = await enregistrerResultatAppel(m.deps, marc, { cibleId: "cible", resultat: "proche_ne_repond_pas", contactId: "voisin" });
    expect(r.statut).toBe("non_joint_a_traiter");
    expect(m.majs[0]).toMatchObject({ rangCercleEssaye: 2, verrouPar: null });
    expect(m.interactions[0]).toMatchObject({ interlocuteurContactId: "voisin", compteRendu: "Le proche ne répond pas (Voisin, Paul)" });
    expect(m.notifications).toEqual([expect.objectContaining({ type: "escalade", titre: "Non joint – à traiter : Mme Simone Dupont" })]);
  });

  it("besoin : tâche du jour suffixée par la campagne ; numéro invalide : tâche de vérification", async () => {
    const m = monter();
    await enregistrerResultatAppel(m.deps, julie, { cibleId: "cible", resultat: "joint_besoin", besoins: ["eau", "eau"] });
    await enregistrerResultatAppel(m.deps, julie, { cibleId: "cible", resultat: "numero_invalide" });
    expect(m.rappels).toEqual([
      expect.objectContaining({ type: "besoin", objet: "Besoin signalé (Eau) : Mme Simone Dupont – Canicule", urgent: true }),
      expect.objectContaining({ type: "verification", objet: "Numéro de téléphone à vérifier : Mme Simone Dupont – Canicule" }),
    ]);
  });

  it("refuse un bénévole à qui la personne n'est pas assignée, et un verrou détenu par un autre", async () => {
    await expect(enregistrerResultatAppel(monter({ assigneA: "lucie" }).deps, marc, { cibleId: "cible", resultat: "joint_ras" })).rejects.toBeInstanceOf(AccesRefuse);
    const verrouillee = monter({ verrouPar: "julie", verrouAt: new Date(MAINTENANT.getTime() - 60_000) });
    await expect(enregistrerResultatAppel(verrouillee.deps, marc, { cibleId: "cible", resultat: "joint_ras" })).rejects.toBeInstanceOf(VerrouPris);
  });
});
