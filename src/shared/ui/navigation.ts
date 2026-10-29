import type { Role } from "@/shared/domain/vocabulaire";

export type EntreeNavigation = { href: string; libelle: string; roles: Role[] };

/** Navigation principale CCAS. Le bénévole n'a pas de menu (E10-US8). */
export const NAVIGATION: EntreeNavigation[] = [
  { href: "/beneficiaires", libelle: "Bénéficiaires", roles: ["admin", "agent"] },
  { href: "/listes", libelle: "Listes", roles: ["admin", "agent"] },
  { href: "/alertes", libelle: "Alertes", roles: ["admin", "agent"] },
  { href: "/benevoles", libelle: "Bénévoles", roles: ["admin", "agent"] },
  { href: "/inscriptions", libelle: "Inscriptions", roles: ["admin"] },
  { href: "/parametres", libelle: "Paramètres", roles: ["admin"] },
];

export const navigationPour = (role: Role) => NAVIGATION.filter((e) => e.roles.includes(role));

export const accueilPour = (role: Role) => (role === "benevole" ? "/benevole" : "/beneficiaires");
