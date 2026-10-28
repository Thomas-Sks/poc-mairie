import { obtenirContexte } from "@/shared/infrastructure/session";
import { casDUsage } from "@/modules/notifications/infrastructure";

/** E14-US1 — notifications de l'utilisateur courant (polling léger par la cloche). */
export async function GET() {
  const ctx = await obtenirContexte();
  const r = await casDUsage.mesNotifications(ctx);
  return Response.json({
    nonLues: r.nonLues,
    notifications: r.notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}
