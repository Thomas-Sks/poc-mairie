/**
 * E8-US1 / E8-US4 — Consultation du tableau et de la carte (filtrage et tri côté serveur).
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import type { Filtre } from "../domain/filtre";
import type { LigneBeneficiaire, RequeteTableau, ResultatTableau } from "../domain/tableau";
import type { ListesRepository, PointCarte, ReferentielsRepository, RegistreRepository } from "./ports";
import { filtresAvecListe } from "./rechercher-beneficiaire-ids";

type Deps = { registre: RegistreRepository; listes: ListesRepository };

/** Masque les données de santé si l'utilisateur n'y a pas droit (RG-07, E13). */
export function masquerSante(ctx: Contexte, lignes: LigneBeneficiaire[]): LigneBeneficiaire[] {
  if (peut(ctx.utilisateur.role, "fiches.sante")) return lignes;
  return lignes.map((l) => ({ ...l, deplacement: null, gir: null, handicap: null, apa: false }));
}

export async function consulterTableau(deps: Deps, ctx: Contexte, requete: RequeteTableau): Promise<ResultatTableau> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const filtres = await filtresAvecListe(deps, ctx, requete.filtre, requete.listeId);
  const r = await deps.registre.rechercher(ctx.commune.id, filtres, {
    tri: requete.tri,
    page: requete.page,
    taillePage: requete.taillePage,
    jour: aujourdhui(ctx.maintenant),
  });
  return { total: r.total, lignes: masquerSante(ctx, r.lignes) };
}

export async function consulterCarte(deps: Deps, ctx: Contexte, entree: { filtre: Filtre; listeId?: string }): Promise<PointCarte[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const filtres = await filtresAvecListe(deps, ctx, entree.filtre, entree.listeId);
  return deps.registre.pointsCarte(ctx.commune.id, filtres, aujourdhui(ctx.maintenant));
}

/** « Tout sélectionner » : tous les résultats du filtre, pas seulement la page affichée. */
export async function toutSelectionner(deps: Deps, ctx: Contexte, entree: { filtre: Filtre; listeId?: string }): Promise<string[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const filtres = await filtresAvecListe(deps, ctx, entree.filtre, entree.listeId);
  return deps.registre.rechercherIds(ctx.commune.id, filtres, aujourdhui(ctx.maintenant));
}

export async function suggererVoies(deps: { referentiels: ReferentielsRepository }, ctx: Contexte, recherche: string): Promise<string[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return deps.referentiels.voies(ctx.commune.id, recherche.trim(), 12);
}

/** Données de référence pour construire les filtres (quartiers, tags, équipe). */
export async function chargerReferentiels(deps: { referentiels: ReferentielsRepository }, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const [quartiers, tags, equipe] = await Promise.all([
    deps.referentiels.quartiers(ctx.commune.id),
    deps.referentiels.tags(ctx.commune.id),
    deps.referentiels.equipe(ctx.commune.id),
  ]);
  return { quartiers, tags, equipe };
}
