/**
 * E14-US1 — Notifications in-app (fonctions pures).
 */
import type { Role } from "@/shared/domain/vocabulaire";

export const TYPES_NOTIFICATION = ["inscription", "assignation", "escalade", "danger", "rappel", "info"] as const;
export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];

export type Notification = {
  id: string;
  type: TypeNotification;
  titre: string;
  message: string | null;
  lien: string | null;
  lue: boolean;
  createdAt: Date;
};

/** Destinataires : des utilisateurs nommés et/ou tous les utilisateurs actifs de certains rôles. */
export type Destinataires = { destinataires?: string[]; roles?: Role[] };

export type MembreEquipe = { id: string; role: Role; actif: boolean };

/**
 * Résout la liste des destinataires (sans doublon), en ne gardant que des membres actifs de l'équipe
 * (un identifiant inconnu, d'une autre commune, est ignoré). `exclure` retire l'auteur si besoin.
 */
export function resoudreDestinataires(cible: Destinataires, equipe: MembreEquipe[], exclure?: string): string[] {
  const actifs = equipe.filter((m) => m.actif);
  const ids = new Set<string>();
  const parId = new Set(cible.destinataires ?? []);
  const roles = new Set(cible.roles ?? []);
  for (const m of actifs) {
    if (parId.has(m.id) || roles.has(m.role)) ids.add(m.id);
  }
  if (exclure) ids.delete(exclure);
  return [...ids];
}

/** Lien interne uniquement (pas de redirection vers un site externe). */
export function lienInterne(lien: string | null | undefined): string | null {
  if (!lien) return null;
  return lien.startsWith("/") && !lien.startsWith("//") ? lien : null;
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 j » */
export function ilYA(date: Date, maintenant: Date): string {
  const minutes = Math.max(0, Math.floor((maintenant.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return `il y a ${Math.floor(heures / 24)} j`;
}
