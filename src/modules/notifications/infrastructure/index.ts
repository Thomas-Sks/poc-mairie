import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import { notifier as notifierCas, type EntreeNotifier } from "../application/notifier";
import { marquerNotificationLue, marquerToutesNotificationsLues, mesNotifications } from "../application/consulter";
import { notificationRepositoryDrizzle } from "./notification-repository-drizzle";

const deps = { notifications: notificationRepositoryDrizzle };

/**
 * Point d'entrée pour les autres modules :
 *   import { notifier } from "@/modules/notifications/infrastructure";
 *   await notifier(ctx, { roles: ["admin"], type: "inscription", titre: "Nouvelle inscription à valider", lien: "/inscriptions" });
 */
export const notifier = (ctx: Contexte, e: EntreeNotifier) => notifierCas(deps, ctx, e);

export const casDUsage = {
  notifier,
  mesNotifications: (ctx: Contexte) => mesNotifications(deps, ctx),
  marquerNotificationLue: (ctx: Contexte, e: { id: string }) => marquerNotificationLue(deps, ctx, e),
  marquerToutesNotificationsLues: (ctx: Contexte) => marquerToutesNotificationsLues(deps, ctx),
};
