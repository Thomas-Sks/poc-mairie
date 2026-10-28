import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import { ParametresInvalides } from "../domain/parametres";
import type { DemoPort, MembreEquipe, ParametresRepository } from "./ports";

/**
 * E13-US1 (simplifié) : création d'un compte bénévole. L'envoi du lien d'invitation est simulé par l'interface.
 */
export async function inviterBenevole(
  deps: { parametres: ParametresRepository },
  ctx: Contexte,
  entree: { prenom: string; nom: string; telephone: string | null; email: string },
): Promise<MembreEquipe> {
  exiger(ctx.utilisateur.role, "utilisateurs.gerer");
  const email = entree.email.trim().toLowerCase();
  if (await deps.parametres.emailUtilise(email)) throw new ParametresInvalides(["Un compte existe déjà avec cette adresse e-mail."]);
  return deps.parametres.creerMembre(ctx.commune.id, {
    prenom: entree.prenom.trim(),
    nom: entree.nom.trim().toUpperCase(),
    telephone: entree.telephone?.trim() || null,
    email,
    role: "benevole",
  });
}

/** §10.2 : recharge le jeu de démonstration (efface toutes les données saisies). */
export async function reinitialiserDemo(deps: { demo: DemoPort }, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "demo.reinitialiser");
  await deps.demo.reinitialiser();
}
