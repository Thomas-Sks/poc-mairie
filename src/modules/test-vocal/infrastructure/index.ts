import "server-only";
import type { Contexte } from "@/shared/application/contexte";
import { demarrerTestVocal } from "../application/demarrer-test";
import { creerAgentElevenLabs } from "./agent-elevenlabs";

const deps = { agent: creerAgentElevenLabs() };

export const casDUsageTestVocal = {
  demarrer: (ctx: Contexte) => demarrerTestVocal(deps, ctx),
  /** La clé ElevenLabs est-elle renseignée ? */
  voixActive: () => deps.agent !== null,
};
