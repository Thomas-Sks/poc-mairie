import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { selectionnerTachesDuJour, type RappelDuJour, type TachesDuJour } from "../domain/taches-du-jour";
import type { InscriptionEnAttente, TachesRepository } from "./ports";

export type RappelVue = RappelDuJour & { assigneNom: string | null };

export type VueTaches = Omit<TachesDuJour, "rappels"> & {
  rappels: RappelVue[];
  /** null quand l'utilisateur n'a pas le droit de valider les inscriptions. */
  inscriptions: InscriptionEnAttente[] | null;
  vueEquipe: boolean;
  peutVoirEquipe: boolean;
};

/**
 * E4-US3 — « Mes tâches du jour ». L'agent voit ses rappels ; l'admin peut afficher ceux de toute l'équipe.
 * Les inscriptions en attente ne sont listées que pour qui peut les valider.
 */
export async function obtenirTachesDuJour(
  deps: { taches: TachesRepository },
  ctx: Contexte,
  entree: { equipe: boolean },
): Promise<VueTaches> {
  exiger(ctx.utilisateur.role, "fiches.lire");
  const jour = aujourdhui(ctx.maintenant);
  const communeId = ctx.commune.id;
  const peutVoirEquipe = peut(ctx.utilisateur.role, "utilisateurs.gerer");
  const vueEquipe = entree.equipe && peutVoirEquipe;
  const peutValider = peut(ctx.utilisateur.role, "inscriptions.valider");

  const [rappels, personnes, inscriptions] = await Promise.all([
    deps.taches.rappelsOuverts(communeId, { jusquAu: jour, assigneA: vueEquipe ? undefined : ctx.utilisateur.id }),
    deps.taches.personnesActives(communeId),
    peutValider ? deps.taches.inscriptionsEnAttente(communeId) : Promise.resolve(null),
  ]);

  const selection = selectionnerTachesDuJour({ rappels, personnes }, jour);
  const nomAssigne = new Map(rappels.map((r) => [r.id, r.assigneNom]));

  return {
    ...selection,
    rappels: selection.rappels.map((r) => ({ ...r, assigneNom: nomAssigne.get(r.id) ?? null })),
    inscriptions,
    vueEquipe,
    peutVoirEquipe,
  };
}
