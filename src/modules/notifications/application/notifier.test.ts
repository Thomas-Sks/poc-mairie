import { describe, expect, it } from "vitest";
import type { Contexte } from "@/shared/application/contexte";
import type { NotificationRepository, NouvelleNotification } from "./ports";
import { notifier } from "./notifier";

const ctx: Contexte = {
  utilisateur: { id: "julie", prenom: "Julie", nom: "Moreau", role: "agent", communeId: "c" },
  commune: { id: "c", nom: "Lomme", structureNom: "", structureTelephone: "" },
  maintenant: new Date(),
};

function depot() {
  const crees: NouvelleNotification[] = [];
  const repo: NotificationRepository = {
    lister: async () => [],
    compterNonLues: async () => 0,
    marquerLue: async () => {},
    marquerToutesLues: async () => {},
    creer: async (_c, n) => void crees.push(...n),
    equipe: async () => [
      { id: "sophie", role: "admin", actif: true },
      { id: "julie", role: "agent", actif: true },
      { id: "karim", role: "agent", actif: true },
    ],
  };
  return { repo, crees };
}

describe("notifier", () => {
  it("notifie les rôles demandés, avec un lien interne", async () => {
    const { repo, crees } = depot();
    const n = await notifier({ notifications: repo }, ctx, { roles: ["admin"], type: "inscription", titre: "Nouvelle inscription", lien: "/inscriptions" });
    expect(n).toBe(1);
    expect(crees).toEqual([{ destinataireId: "sophie", type: "inscription", titre: "Nouvelle inscription", message: null, lien: "/inscriptions" }]);
  });

  it("peut exclure l'auteur et écarte les liens externes", async () => {
    const { repo, crees } = depot();
    await notifier({ notifications: repo }, ctx, { roles: ["agent"], type: "escalade", titre: "Escalade", lien: "https://ailleurs.example", exclureAuteur: true });
    expect(crees.map((c) => [c.destinataireId, c.lien])).toEqual([["karim", null]]);
  });

  it("ne crée rien sans destinataire", async () => {
    const { repo, crees } = depot();
    expect(await notifier({ notifications: repo }, ctx, { destinataires: ["inconnu"], type: "info", titre: "x" })).toBe(0);
    expect(crees).toHaveLength(0);
  });
});
