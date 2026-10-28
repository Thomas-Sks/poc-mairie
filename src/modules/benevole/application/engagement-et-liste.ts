import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import { exigerBenevole, jourDe } from "./acces";
import type { Engagements, JournalAppels, LectureBenevole } from "./ports";

/** E10-US2 : engagement de confidentialité horodaté. */
export async function accepterEngagement(deps: { engagements: Engagements }, ctx: Contexte): Promise<void> {
  exiger(ctx.utilisateur.role, "appel.benevole");
  await deps.engagements.accepter(ctx.commune.id, ctx.utilisateur.id, ctx.maintenant);
}

/** E10-US9 « Je n'ai plus de temps » : les personnes non traitées retournent dans le pot commun. */
export async function rendreMaListe(deps: { lecture: LectureBenevole; journal: JournalAppels }, ctx: Contexte): Promise<number> {
  await exigerBenevole(deps.lecture, ctx);
  return deps.journal.rendreListe(ctx, jourDe(ctx));
}
