import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import type { GestionBenevoles } from "./ports";

type Deps = { gestion: GestionBenevoles };

export class BenevoleInvalide extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenevoleInvalide";
  }
}

export class BenevoleIntrouvable extends Error {
  constructor() {
    super("Bénévole introuvable.");
    this.name = "BenevoleIntrouvable";
  }
}

/** Écran « Bénévoles » : chaque bénévole et le nombre de personnes qui lui sont confiées. */
export async function listerBenevoles(deps: Deps, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "benevoles.gerer");
  return deps.gestion.lister(ctx.commune.id);
}

export async function consulterBenevole(deps: Deps, ctx: Contexte, benevoleId: string) {
  exiger(ctx.utilisateur.role, "benevoles.gerer");
  const benevole = await deps.gestion.obtenir(ctx.commune.id, benevoleId);
  if (!benevole) throw new BenevoleIntrouvable();
  const personnes = await deps.gestion.personnesConfiees(ctx.commune.id, benevoleId, aujourdhui(ctx.maintenant));
  return { benevole, personnes };
}

/** Ajout d'un bénévole : compte créé tout de suite, l'invitation par e-mail est simulée. */
export async function ajouterBenevole(
  deps: Deps,
  ctx: Contexte,
  entree: { prenom: string; nom: string; telephone: string | null; email: string },
): Promise<string> {
  exiger(ctx.utilisateur.role, "benevoles.gerer");
  const email = entree.email.trim().toLowerCase();
  if (await deps.gestion.emailUtilise(email)) throw new BenevoleInvalide("Un compte existe déjà avec cette adresse e-mail.");
  return deps.gestion.creer(ctx.commune.id, {
    prenom: entree.prenom.trim(),
    nom: entree.nom.trim().toUpperCase(),
    telephone: entree.telephone?.trim() || null,
    email,
  });
}

export async function rechercherPersonnes(deps: Deps, ctx: Contexte, entree: { benevoleId: string; texte: string }) {
  exiger(ctx.utilisateur.role, "benevoles.gerer");
  const texte = entree.texte.trim();
  if (texte.length < 2) return [];
  return deps.gestion.rechercher(ctx.commune.id, entree.benevoleId, texte, aujourdhui(ctx.maintenant));
}

/** Confie des personnes : pendant une alerte, elles arrivent directement dans la liste d'appels du bénévole. */
export async function confierPersonnes(deps: Deps, ctx: Contexte, entree: { benevoleId: string; beneficiaireIds: string[] }) {
  exiger(ctx.utilisateur.role, "benevoles.gerer");
  if (entree.beneficiaireIds.length === 0) return 0;
  if (!(await deps.gestion.obtenir(ctx.commune.id, entree.benevoleId))) throw new BenevoleIntrouvable();
  return deps.gestion.confier(ctx.commune.id, entree.benevoleId, entree.beneficiaireIds);
}

export async function retirerPersonne(deps: Deps, ctx: Contexte, entree: { benevoleId: string; beneficiaireId: string }) {
  exiger(ctx.utilisateur.role, "benevoles.gerer");
  await deps.gestion.retirer(ctx.commune.id, entree.benevoleId, entree.beneficiaireId);
}
