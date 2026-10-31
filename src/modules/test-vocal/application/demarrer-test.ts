import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import {
  DUREE_MAX_SECONDES,
  MESSAGE_FIN_DUREE,
  PREMIER_MESSAGE,
  consignesAgent,
  variablesConversation,
  type VariablesConversation,
} from "../domain/script";
import type { AgentVocal } from "./ports";

export class VoixNonConfiguree extends Error {
  constructor() {
    super("Clé ElevenLabs absente (ELEVENLABS_API_KEY).");
    this.name = "VoixNonConfiguree";
  }
}

export type ConversationOuverte = { jeton: string; variables: VariablesConversation };

export async function demarrerTestVocal(deps: { agent: AgentVocal | null }, ctx: Contexte): Promise<ConversationOuverte> {
  exiger(ctx.utilisateur.role, "vocal.tester");
  if (!deps.agent) throw new VoixNonConfiguree();
  const { jeton } = await deps.agent.ouvrirConversation({
    consignes: consignesAgent(),
    premierMessage: PREMIER_MESSAGE,
    dureeMaxSecondes: DUREE_MAX_SECONDES,
    messageFinDuree: MESSAGE_FIN_DUREE,
  });
  return { jeton, variables: variablesConversation(ctx.commune) };
}
