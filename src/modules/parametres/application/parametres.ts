import type { Contexte } from "@/shared/application/contexte";
import type { ParametresRelance } from "@/shared/domain/campagne";
import { exiger } from "@/shared/domain/permissions";
import type { GrilleScore } from "@/shared/domain/priorite";
import { ParametresInvalides, verifierGrille, verifierRelance, type ParametresCommune, type TextesRgpd } from "../domain/parametres";
import type { MembreEquipe, ParametresRepository } from "./ports";

type Deps = { parametres: ParametresRepository };

export async function lireParametres(deps: Deps, ctx: Contexte): Promise<{ parametres: ParametresCommune; equipe: MembreEquipe[] }> {
  exiger(ctx.utilisateur.role, "parametres.gerer");
  const [parametres, equipe] = await Promise.all([deps.parametres.lire(ctx.commune.id), deps.parametres.equipe(ctx.commune.id)]);
  return { parametres, equipe };
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

/** RG-04, E4-US1, E1-US5 : relances, rappels d'anniversaire et revérification des fiches. */
export async function modifierRelancesEtRappels(
  deps: Deps,
  ctx: Contexte,
  entree: { relance: ParametresRelance; anniversaireJoursAvant: number; verificationMois: number },
) {
  const erreurs = verifierRelance(entree.relance, entree.anniversaireJoursAvant, entree.verificationMois);
  if (erreurs.length) throw new ParametresInvalides(erreurs);
  await modifier(deps, ctx, (p) => ({ ...p, ...entree }));
}

export async function modifierTextesRgpd(deps: Deps, ctx: Contexte, rgpd: TextesRgpd) {
  const erreurs = Object.values(rgpd).some((t) => t.trim() === "") ? ["Tous les textes RGPD doivent être renseignés."] : [];
  if (erreurs.length) throw new ParametresInvalides(erreurs);
  await modifier(deps, ctx, (p) => ({ ...p, rgpd }));
}
