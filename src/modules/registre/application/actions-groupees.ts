/**
 * E8-US6 / E8-US8 / E8-US9 — Actions groupées : assigner, ajouter un tag, changer le statut, exporter.
 */
import type { Contexte } from "@/shared/application/contexte";
import { repartir } from "@/shared/domain/campagne";
import { aujourdhui } from "@/shared/domain/dates";
import { AccesRefuse, exiger, peut } from "@/shared/domain/permissions";
import type { MotifArchivage } from "@/shared/domain/vocabulaire";
import type { Filtre } from "../domain/filtre";
import { contientDonneesSante, genererCsv, type Colonne, type StatutGroupe } from "../domain/tableau";
import type { ActionsRepository, ListesRepository, ReferentielsRepository, RegistreRepository } from "./ports";
import { filtresAvecListe } from "./rechercher-beneficiaire-ids";

export class ErreurMetier extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurMetier";
  }
}

type DepsAssigner = { registre: RegistreRepository; referentiels: ReferentielsRepository; actions: ActionsRepository };

export async function assigner(
  deps: DepsAssigner,
  ctx: Contexte,
  entree: { ids: string[]; utilisateurIds: string[]; repartirAutomatiquement: boolean; remplacer: boolean },
): Promise<{ nbFiches: number; parPersonne: { utilisateurId: string; nb: number }[] }> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const ids = await deps.registre.idsDeLaCommune(ctx.commune.id, entree.ids);
  if (ids.length === 0) throw new ErreurMetier("Aucune personne sélectionnée.");
  const equipe = await deps.referentiels.equipe(ctx.commune.id);
  const personnes = [...new Set(entree.utilisateurIds)].filter((id) => equipe.some((m) => m.id === id));
  if (personnes.length === 0) throw new ErreurMetier("Choisissez au moins une personne de l'équipe.");

  let affectations: { beneficiaireId: string; utilisateurId: string }[];
  if (entree.repartirAutomatiquement && personnes.length > 1) {
    // E8-US6 : répartition équitable, dans l'ordre de priorité (les P1 sont distribués en premier).
    const ordonnes = await deps.registre.ordonnerParPriorite(ctx.commune.id, ids);
    const lots = repartir(ordonnes, personnes.length);
    affectations = lots.flatMap((lot, i) => lot.map((beneficiaireId) => ({ beneficiaireId, utilisateurId: personnes[i] })));
  } else {
    affectations = ids.flatMap((beneficiaireId) => personnes.map((utilisateurId) => ({ beneficiaireId, utilisateurId })));
  }

  await deps.actions.assigner(ctx.commune.id, affectations, { remplacer: entree.remplacer, beneficiaireIds: ids });

  const parPersonne = personnes.map((utilisateurId) => ({ utilisateurId, nb: affectations.filter((a) => a.utilisateurId === utilisateurId).length }));
  for (const { utilisateurId, nb } of parPersonne) {
    if (utilisateurId === ctx.utilisateur.id || nb === 0) continue;
    await deps.actions.notifier(
      ctx.commune.id,
      utilisateurId,
      `${ctx.utilisateur.prenom} vous a assigné ${nb} personne${nb > 1 ? "s" : ""}`,
      "Retrouvez-les dans le tableau des bénéficiaires, filtre « Assigné à ».",
      "/beneficiaires",
    );
  }
  return { nbFiches: ids.length, parPersonne };
}

export async function retirerAssignations(
  deps: { registre: RegistreRepository; actions: ActionsRepository },
  ctx: Contexte,
  entree: { ids: string[] },
): Promise<number> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const ids = await deps.registre.idsDeLaCommune(ctx.commune.id, entree.ids);
  await deps.actions.retirerAssignations(ids);
  return ids.length;
}

export async function ajouterTag(
  deps: { registre: RegistreRepository; actions: ActionsRepository },
  ctx: Contexte,
  entree: { ids: string[]; tag: string },
): Promise<number> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const tag = entree.tag.trim();
  if (!tag) throw new ErreurMetier("Indiquez un tag.");
  const ids = await deps.registre.idsDeLaCommune(ctx.commune.id, entree.ids);
  return deps.actions.ajouterTag(ctx.commune.id, ids, tag, ctx.utilisateur.id);
}

export async function changerStatut(
  deps: { registre: RegistreRepository; actions: ActionsRepository },
  ctx: Contexte,
  entree: { ids: string[]; statut: StatutGroupe; motifArchivage?: MotifArchivage; motif?: string },
): Promise<number> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  if (entree.statut === "archivee") {
    exiger(ctx.utilisateur.role, "fiches.archiver");
    if (!entree.motifArchivage) throw new ErreurMetier("Indiquez le motif d'archivage.");
  }
  if (entree.statut === "suspendue" && !entree.motif?.trim()) throw new ErreurMetier("Indiquez le motif de la suspension.");
  const ids = await deps.registre.idsDeLaCommune(ctx.commune.id, entree.ids);
  return deps.actions.changerStatut(
    ctx.commune.id,
    ids,
    entree.statut,
    { motifArchivage: entree.statut === "archivee" ? entree.motifArchivage : undefined, motifStatut: entree.motif?.trim() || undefined },
    ctx.utilisateur.id,
  );
}

/**
 * E8-US9 — Export CSV : admin uniquement, colonnes au choix, confirmation explicite pour les
 * colonnes de santé, tracé dans le journal d'audit (E13).
 */
export async function exporterCsv(
  deps: { registre: RegistreRepository; listes: ListesRepository; referentiels: ReferentielsRepository; actions: ActionsRepository },
  ctx: Contexte,
  entree: { filtre: Filtre; listeId?: string; ids?: string[]; colonnes: Colonne[]; confirmationSante: boolean },
): Promise<{ csv: string; nomFichier: string; nb: number }> {
  exiger(ctx.utilisateur.role, "export");
  if (entree.colonnes.length === 0) throw new ErreurMetier("Choisissez au moins une colonne.");
  const sante = contientDonneesSante(entree.colonnes);
  if (sante && !peut(ctx.utilisateur.role, "fiches.sante")) throw new AccesRefuse("fiches.sante");
  if (sante && !entree.confirmationSante) throw new ErreurMetier("Confirmez l'export des données de santé.");

  const filtres = await filtresAvecListe(deps, ctx, entree.filtre, entree.listeId);
  if (entree.ids && entree.ids.length > 0) filtres.push({ version: 1, ids: entree.ids });
  const jour = aujourdhui(ctx.maintenant);
  const lignes = await deps.registre.lignes(ctx.commune.id, filtres, jour);
  const equipe = await deps.referentiels.equipe(ctx.commune.id);
  const noms = Object.fromEntries(equipe.map((m) => [m.id, `${m.prenom} ${m.nom}`]));

  await deps.actions.journaliser(ctx.commune.id, ctx.utilisateur.id, "export_csv", "beneficiaires", {
    nbLignes: lignes.length,
    colonnes: entree.colonnes,
    donneesSante: sante,
    filtre: entree.filtre,
    listeId: entree.listeId ?? null,
    selection: entree.ids?.length ?? null,
  });

  return { csv: genererCsv(lignes, entree.colonnes, noms), nomFichier: `beneficiaires-${jour}.csv`, nb: lignes.length };
}
