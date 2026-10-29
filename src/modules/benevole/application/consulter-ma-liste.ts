import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import { personneSuivante, trierMaListe } from "../domain/ma-liste";
import { exigerBenevole, jourDe } from "./acces";
import type { LectureBenevole, PersonneDeMaListe } from "./ports";

export type VueMaListe =
  | { etape: "engagement" }
  | { etape: "liste"; aFaire: PersonneDeMaListe[]; faits: PersonneDeMaListe[]; suivanteId: string | null; nbPersonnesConfiees: number };

/** E10-US2 / E10-US3 : premier lancement (engagement) ou « Ma liste ». */
export async function consulterMaListe(deps: { lecture: LectureBenevole }, ctx: Contexte): Promise<VueMaListe> {
  exiger(ctx.utilisateur.role, "appel.benevole");
  if (!(await deps.lecture.engagementAccepteLe(ctx.utilisateur.id))) return { etape: "engagement" };
  const [elements, nbPersonnesConfiees] = await Promise.all([
    deps.lecture.maListe(ctx.commune.id, ctx.utilisateur.id, jourDe(ctx), ctx.maintenant),
    deps.lecture.nbPersonnesConfiees(ctx.commune.id, ctx.utilisateur.id),
  ]);
  const { aFaire, faits } = trierMaListe(elements);
  return { etape: "liste", aFaire, faits, suivanteId: personneSuivante(elements, ctx.maintenant)?.id ?? null, nbPersonnesConfiees };
}

/** Bouton « Personne suivante ». */
export async function trouverPersonneSuivante(deps: { lecture: LectureBenevole }, ctx: Contexte): Promise<string | null> {
  await exigerBenevole(deps.lecture, ctx);
  const elements = await deps.lecture.maListe(ctx.commune.id, ctx.utilisateur.id, jourDe(ctx), ctx.maintenant);
  return personneSuivante(elements, ctx.maintenant)?.id ?? null;
}
