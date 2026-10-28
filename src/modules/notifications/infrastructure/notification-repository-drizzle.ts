import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { notifications, utilisateurs } from "@/shared/infrastructure/db/schema";
import type { NotificationRepository } from "../application/ports";

const pour = (communeId: string, destinataireId: string) =>
  and(eq(notifications.communeId, communeId), eq(notifications.destinataireId, destinataireId));

export const notificationRepositoryDrizzle: NotificationRepository = {
  async lister(communeId, destinataireId, limite) {
    return db
      .select({
        id: notifications.id,
        type: notifications.type,
        titre: notifications.titre,
        message: notifications.message,
        lien: notifications.lien,
        lue: notifications.lue,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(pour(communeId, destinataireId))
      .orderBy(desc(notifications.createdAt))
      .limit(limite);
  },

  async compterNonLues(communeId, destinataireId) {
    const [r] = await db.select({ n: count() }).from(notifications).where(and(pour(communeId, destinataireId), eq(notifications.lue, false)));
    return r?.n ?? 0;
  },

  async marquerLue(communeId, destinataireId, id) {
    await db.update(notifications).set({ lue: true }).where(and(pour(communeId, destinataireId), eq(notifications.id, id)));
  },

  async marquerToutesLues(communeId, destinataireId) {
    await db.update(notifications).set({ lue: true }).where(and(pour(communeId, destinataireId), eq(notifications.lue, false)));
  },

  async creer(communeId, nouvelles) {
    if (nouvelles.length === 0) return;
    await db.insert(notifications).values(nouvelles.map((n) => ({ ...n, communeId })));
  },

  async equipe(communeId) {
    return db
      .select({ id: utilisateurs.id, role: utilisateurs.role, actif: utilisateurs.actif })
      .from(utilisateurs)
      .where(eq(utilisateurs.communeId, communeId));
  },
};
