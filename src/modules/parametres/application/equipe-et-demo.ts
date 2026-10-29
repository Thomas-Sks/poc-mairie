import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import type { DemoPort } from "./ports";

/** §10.2 : recharge le jeu de démonstration (efface toutes les données saisies). */
export async function reinitialiserDemo(deps: { demo: DemoPort }, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "demo.reinitialiser");
  await deps.demo.reinitialiser();
}
