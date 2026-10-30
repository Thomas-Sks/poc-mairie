/**
 * Droits par rôle (§1 des specs). Vérifiés côté serveur dans chaque cas d'usage.
 */
import type { Role } from "./vocabulaire";

export const PERMISSIONS = [
  "fiches.lire",
  "fiches.ecrire",
  "fiches.sante", // données de santé (accès restreint)
  "fiches.archiver",
  "inscriptions.valider",
  "utilisateurs.gerer",
  "benevoles.gerer",
  "alertes.declencher",
  "campagnes.gerer",
  "statistiques.lire",
  "statistiques.nominatif",
  "export",
  "parametres.gerer",
  "demo.reinitialiser",
  "appel.benevole",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRICE: Record<Role, readonly Permission[]> = {
  super_admin: ["utilisateurs.gerer", "parametres.gerer"],
  admin: PERMISSIONS.filter((p) => p !== "appel.benevole"),
  agent: [
    "benevoles.gerer",
    "fiches.lire",
    "fiches.ecrire",
    "fiches.sante",
    "campagnes.gerer",
    "statistiques.lire",
    "statistiques.nominatif",
    // Télécharger les listes du registre (CSV).
    "export",
  ],
  benevole: ["appel.benevole"],
};

export function peut(role: Role, permission: Permission): boolean {
  return MATRICE[role].includes(permission);
}

export class AccesRefuse extends Error {
  constructor(public readonly permission: Permission) {
    super(`Accès refusé : ${permission}`);
    this.name = "AccesRefuse";
  }
}

export function exiger(role: Role, permission: Permission): void {
  if (!peut(role, permission)) throw new AccesRefuse(permission);
}
