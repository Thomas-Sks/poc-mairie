import type { Contexte } from "@/shared/application/contexte";
import type { Notification } from "../domain/notification";
import type { NotificationRepository } from "./ports";

const LIMITE = 20;

export type MesNotifications = { nonLues: number; notifications: Notification[] };

/** Chacun ne voit que ses propres notifications, dans sa commune. */
export async function mesNotifications(deps: { notifications: NotificationRepository }, ctx: Contexte): Promise<MesNotifications> {
  const [nonLues, notifications] = await Promise.all([
    deps.notifications.compterNonLues(ctx.commune.id, ctx.utilisateur.id),
    deps.notifications.lister(ctx.commune.id, ctx.utilisateur.id, LIMITE),
  ]);
  return { nonLues, notifications };
}

export async function marquerNotificationLue(deps: { notifications: NotificationRepository }, ctx: Contexte, entree: { id: string }) {
  await deps.notifications.marquerLue(ctx.commune.id, ctx.utilisateur.id, entree.id);
}

export async function marquerToutesNotificationsLues(deps: { notifications: NotificationRepository }, ctx: Contexte) {
  await deps.notifications.marquerToutesLues(ctx.commune.id, ctx.utilisateur.id);
}
