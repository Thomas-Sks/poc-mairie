import "server-only";
import { moteurStatistiquesDrizzle } from "@/modules/statistiques/infrastructure/moteur-drizzle";
import type { Contexte } from "@/shared/application/contexte";
import { interrogerRegistre } from "../application/repondre";
import { interpretationsDrizzle } from "./depots-drizzle";
import { creerInterpreteur } from "./interpreteur-claude";

const deps = {
  moteur: moteurStatistiquesDrizzle,
  interpretations: interpretationsDrizzle,
  interpreteur: creerInterpreteur(),
};

export const casDUsageAssistant = {
  interrogerRegistre: (ctx: Contexte, question: string) => interrogerRegistre(deps, ctx, { question }),
  /** L'IA est-elle branchée ? (sinon : analyseur de mots-clés seul) */
  iaActive: () => deps.interpreteur !== null,
};
