import type { Contexte } from "@/shared/application/contexte";
import { lienInterne, resoudreDestinataires, type Destinataires, type TypeNotification } from "../domain/notification";
import type { NotificationRepository } from "./ports";

export type EntreeNotifier = Destinataires & {
  type: TypeNotification;
  titre: string;
  message?: string | null;
  /** Chemin interne vers l'objet concerné, ex. `/beneficiaires/<id>` ou `/inscriptions`. */
  lien?: string | null;
  /** Ne pas notifier l'utilisateur qui déclenche l'action (défaut : false). */
  exclureAuteur?: boolean;
};

/**
 * E14-US1 — Crée une notification in-app pour des utilisateurs nommés et/ou des rôles de la commune courante.
 * Appelable par tout module (inscription reçue, assignation, escalade IA, danger, rappel…).
 * Aucun droit particulier : notifier est un effet de bord d'une action déjà autorisée.
 * Renvoie le nombre de notifications créées.
 */
export async function notifier(deps: { notifications: NotificationRepository }, ctx: Contexte, entree: EntreeNotifier): Promise<number> {
  const equipe = await deps.notifications.equipe(ctx.commune.id);
  const ids = resoudreDestinataires(entree, equipe, entree.exclureAuteur ? ctx.utilisateur.id : undefined);
  if (ids.length === 0) return 0;
  await deps.notifications.creer(
    ctx.commune.id,
    ids.map((destinataireId) => ({
      destinataireId,
      type: entree.type,
      titre: entree.titre,
      message: entree.message ?? null,
      lien: lienInterne(entree.lien),
    })),
  );
  return ids.length;
}
