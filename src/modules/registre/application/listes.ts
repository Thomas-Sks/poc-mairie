/**
 * E8-US5 — Listes enregistrées : dynamiques (filtre réévalué) ou figées (snapshot des ids).
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import type { Filtre } from "../domain/filtre";
import type { Liste, ListesRepository, RegistreRepository } from "./ports";
import { ErreurMetier } from "./actions-groupees";
import { filtresAvecListe, ListeIntrouvable } from "./rechercher-beneficiaire-ids";

export type ResumeListe = Liste & { nb: number };

export async function listerListes(deps: { registre: RegistreRepository; listes: ListesRepository }, ctx: Contexte): Promise<ResumeListe[]> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const listes = await deps.listes.lister(ctx.commune.id);
  const jour = aujourdhui(ctx.maintenant);
  return Promise.all(
    listes.map(async (l) => ({
      ...l,
      nb: l.type === "figee" ? l.beneficiaireIds.length : (await deps.registre.rechercherIds(ctx.commune.id, [l.filtre], jour)).length,
    })),
  );
}

export async function consulterListe(deps: { listes: ListesRepository }, ctx: Contexte, id: string): Promise<Liste> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const liste = await deps.listes.trouver(ctx.commune.id, id);
  if (!liste) throw new ListeIntrouvable();
  return liste;
}

/**
 * Enregistre le résultat d'un filtre. Une liste figée prend un instantané des personnes
 * (la sélection si elle est fournie, sinon tout le résultat du filtre).
 */
export async function creerListe(
  deps: { registre: RegistreRepository; listes: ListesRepository },
  ctx: Contexte,
  entree: { nom: string; type: "dynamique" | "figee"; filtre: Filtre; listeId?: string; ids?: string[] },
): Promise<string> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const nom = entree.nom.trim();
  if (!nom) throw new ErreurMetier("Donnez un nom à la liste.");
  if (entree.type === "dynamique") {
    if (entree.listeId || (entree.ids && entree.ids.length > 0)) {
      throw new ErreurMetier("Une liste dynamique enregistre un filtre : utilisez une liste figée pour une sélection.");
    }
    return deps.listes.creer(ctx.commune.id, { nom, type: "dynamique", filtre: entree.filtre, beneficiaireIds: [], creePar: ctx.utilisateur.id });
  }
  const filtres = await filtresAvecListe(deps, ctx, entree.filtre, entree.listeId);
  const ids =
    entree.ids && entree.ids.length > 0
      ? await deps.registre.ordonnerParPriorite(ctx.commune.id, entree.ids)
      : await deps.registre.rechercherIds(ctx.commune.id, filtres, aujourdhui(ctx.maintenant));
  if (ids.length === 0) throw new ErreurMetier("La liste est vide : aucune personne ne correspond.");
  return deps.listes.creer(ctx.commune.id, { nom, type: "figee", filtre: entree.filtre, beneficiaireIds: ids, creePar: ctx.utilisateur.id });
}

export async function supprimerListe(deps: { listes: ListesRepository }, ctx: Contexte, id: string) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  await deps.listes.supprimer(ctx.commune.id, id);
}

export async function renommerListe(deps: { listes: ListesRepository }, ctx: Contexte, entree: { id: string; nom: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  if (!entree.nom.trim()) throw new ErreurMetier("Donnez un nom à la liste.");
  await deps.listes.renommer(ctx.commune.id, entree.id, entree.nom.trim());
}
