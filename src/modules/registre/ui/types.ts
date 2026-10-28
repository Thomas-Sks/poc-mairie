import type { Membre, PointCarte } from "../application/ports";

export type { Membre, PointCarte };

export type Referentiels = { quartiers: string[]; tags: string[]; equipe: Membre[] };

/** Droits de l'utilisateur courant (l'UI s'adapte ; le serveur revérifie toujours). */
export type Droits = { ecrire: boolean; exporter: boolean; sante: boolean; archiver: boolean };

export const nomMembre = (m: Pick<Membre, "prenom" | "nom">) => `${m.prenom} ${m.nom}`;
