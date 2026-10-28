/**
 * Cas d'usage exposés aux autres modules (Alertes / Crise) :
 * - `rechercherBeneficiaireIds` : ids des fiches correspondant à un filtre (campagne « à partir d'un filtre ») ;
 * - `resoudreListe` : ids d'une liste enregistrée (dynamique : filtre réévalué ; figée : snapshot).
 * Les ids sont renvoyés dans l'ordre de priorité (RG-02 : P1, puis score décroissant).
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import { lireFiltre, type Filtre } from "../domain/filtre";
import type { Filtres, ListesRepository, RegistreRepository } from "./ports";

export async function rechercherBeneficiaireIds(
  deps: { registre: RegistreRepository },
  ctx: Contexte,
  filtre: Filtre | Record<string, unknown>,
): Promise<string[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.registre.rechercherIds(ctx.commune.id, [lireFiltre(filtre)], aujourdhui(ctx.maintenant));
}

export class ListeIntrouvable extends Error {
  constructor() {
    super("Liste introuvable");
    this.name = "ListeIntrouvable";
  }
}

/** Filtres effectifs : filtre de base de la liste (le cas échéant) ET filtre saisi. */
export async function filtresAvecListe(deps: { listes: ListesRepository }, ctx: Contexte, filtre: Filtre, listeId?: string): Promise<Filtres> {
  if (!listeId) return [filtre];
  const liste = await deps.listes.trouver(ctx.commune.id, listeId);
  if (!liste) throw new ListeIntrouvable();
  const base: Filtre = liste.type === "figee" ? { version: 1, ids: liste.beneficiaireIds } : liste.filtre;
  return [base, filtre];
}

export async function resoudreListe(
  deps: { registre: RegistreRepository; listes: ListesRepository },
  ctx: Contexte,
  listeId: string,
): Promise<string[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const liste = await deps.listes.trouver(ctx.commune.id, listeId);
  if (!liste) throw new ListeIntrouvable();
  if (liste.type === "figee") return deps.registre.ordonnerParPriorite(ctx.commune.id, liste.beneficiaireIds);
  return deps.registre.rechercherIds(ctx.commune.id, [liste.filtre], aujourdhui(ctx.maintenant));
}
