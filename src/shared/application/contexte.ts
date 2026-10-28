/**
 * Contexte d'exécution d'un cas d'usage : qui agit, pour quelle commune (tenant).
 * Construit par l'adaptateur entrant (Next.js) et passé explicitement aux cas d'usage.
 */
import type { Role } from "@/shared/domain/vocabulaire";

export type UtilisateurCourant = {
  id: string;
  prenom: string;
  nom: string;
  role: Role;
  communeId: string;
};

export type CommuneCourante = {
  id: string;
  nom: string;
  structureNom: string;
  structureTelephone: string;
};

export type Contexte = {
  utilisateur: UtilisateurCourant;
  commune: CommuneCourante;
  maintenant: Date;
};
