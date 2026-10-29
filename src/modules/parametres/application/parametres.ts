import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import type { GrilleScore } from "@/shared/domain/priorite";
import { ParametresInvalides, verifierGrille, type ParametresCommune } from "../domain/parametres";
import type { ParametresRepository } from "./ports";

type Deps = { parametres: ParametresRepository };

export async function lireParametres(deps: Deps, ctx: Contexte): Promise<{ parametres: ParametresCommune }> {
  exiger(ctx.utilisateur.role, "parametres.gerer");
  return { parametres: await deps.parametres.lire(ctx.commune.id) };
}

async function modifier(deps: Deps, ctx: Contexte, changement: (p: ParametresCommune) => ParametresCommune) {
  exiger(ctx.utilisateur.role, "parametres.gerer");
  const actuels = await deps.parametres.lire(ctx.commune.id);
  await deps.parametres.enregistrer(ctx.commune.id, changement(actuels));
}

/** E13-US6 / RG-01 : pondérations et seuils de la grille de score. */
export async function modifierGrilleScore(deps: Deps, ctx: Contexte, grille: GrilleScore) {
  const erreurs = verifierGrille(grille);
  if (erreurs.length) throw new ParametresInvalides(erreurs);
  await modifier(deps, ctx, (p) => ({ ...p, grilleScore: grille }));
}
