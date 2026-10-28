import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import type { FicheAppel, LectureBenevole } from "./ports";

/** La personne n'est pas (ou plus) dans la liste de ce bénévole aujourd'hui. */
export class PersonneInaccessible extends Error {
  constructor() {
    super("Cette personne n'est pas dans votre liste du jour.");
    this.name = "PersonneInaccessible";
  }
}

export class EngagementRequis extends Error {
  constructor() {
    super("L'engagement de confidentialité doit être accepté.");
    this.name = "EngagementRequis";
  }
}

export const jourDe = (ctx: Contexte) => aujourdhui(ctx.maintenant);

/** Garde commune à tous les cas d'usage : rôle bénévole + engagement accepté. */
export async function exigerBenevole(lecture: LectureBenevole, ctx: Contexte): Promise<void> {
  exiger(ctx.utilisateur.role, "appel.benevole");
  if (!(await lecture.engagementAccepteLe(ctx.utilisateur.id))) throw new EngagementRequis();
}

/** RG-07 : uniquement une personne assignée au bénévole, dans la vague du jour d'une campagne active. */
export async function ficheAccessible(lecture: LectureBenevole, ctx: Contexte, cibleId: string): Promise<FicheAppel> {
  await exigerBenevole(lecture, ctx);
  const fiche = await lecture.ficheAppel(ctx.commune.id, ctx.utilisateur.id, cibleId, jourDe(ctx), ctx.maintenant);
  if (!fiche) throw new PersonneInaccessible();
  return fiche;
}
