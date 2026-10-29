import "server-only";
import { moteurStatistiquesDrizzle } from "@/modules/statistiques/infrastructure/moteur-drizzle";
import type { Contexte } from "@/shared/application/contexte";
import { exporterPersonnes, repondre } from "../application/repondre";
import { annuaireDrizzle, interpretationsDrizzle, journalExportsDrizzle } from "./depots-drizzle";
import { creerInterpreteur } from "./interpreteur-claude";

const deps = {
  moteur: moteurStatistiquesDrizzle,
  interpretations: interpretationsDrizzle,
  interpreteur: creerInterpreteur(),
  annuaire: annuaireDrizzle,
  journal: journalExportsDrizzle,
};

export const casDUsageAssistant = {
  repondre: (ctx: Contexte, question: string) => repondre(deps, ctx, { question }),
  exporterPersonnes: (ctx: Contexte, question: string) => exporterPersonnes(deps, ctx, { question }),
  /** L'IA est-elle branchée ? (sinon : analyseur de mots-clés seul) */
  iaActive: () => deps.interpreteur !== null,
};
