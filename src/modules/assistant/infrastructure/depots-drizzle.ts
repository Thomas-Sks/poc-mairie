import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { interpretationsAssistant } from "@/shared/infrastructure/db/schema";
import type { InterpretationsRepository } from "../application/ports";

export const interpretationsDrizzle: InterpretationsRepository = {
  async trouver(communeId, cle) {
    const [l] = await db
      .select({ appel: interpretationsAssistant.appel, source: interpretationsAssistant.source })
      .from(interpretationsAssistant)
      .where(and(eq(interpretationsAssistant.communeId, communeId), eq(interpretationsAssistant.questionNormalisee, cle)));
    return l ?? null;
  },

  async enregistrer(communeId, cle, appel, source) {
    // La première interprétation l'emporte : deux écrans qui posent la même question au même moment obtiennent la même réponse.
    await db
      .insert(interpretationsAssistant)
      .values({ communeId, questionNormalisee: cle, appel: appel as Record<string, unknown>, source })
      .onConflictDoNothing();
  },
};
