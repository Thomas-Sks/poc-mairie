import "server-only";
import type { AgentVocal, ConfigurationAgent } from "../application/ports";

/**
 * Adaptateur ElevenLabs Agents. L'agent est retrouvé par son nom (ou créé), puis mis à jour avec la
 * configuration du code à chaque démarrage du serveur : le script fait foi, pas le tableau de bord ElevenLabs.
 */
const API = "https://api.elevenlabs.io/v1/convai";
const NOM_AGENT = "POC CCAS – Test vocal";
const VOIX_ID = "GoEy5CmodqJy0T9AxjLk";

async function appeler<T>(cle: string, chemin: string, init?: { method: string; body: unknown }): Promise<T> {
  const res = await fetch(`${API}${chemin}`, {
    method: init?.method ?? "GET",
    headers: { "xi-api-key": cle, "Content-Type": "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ElevenLabs ${init?.method ?? "GET"} ${chemin} : ${res.status} ${(await res.text()).slice(0, 500)}`);
  return (await res.json()) as T;
}

function corpsAgent(config: ConfigurationAgent) {
  return {
    name: NOM_AGENT,
    conversation_config: {
      agent: {
        language: "fr",
        first_message: config.premierMessage,
        max_conversation_duration_message: config.messageFinDuree,
        prompt: {
          prompt: config.consignes,
          llm: "claude-haiku-4-5",
          built_in_tools: {
            end_call: { type: "system", name: "end_call", description: "", params: { system_tool_type: "end_call" } },
          },
        },
      },
      // v4 turbo : prosodie plus fluide que flash. Peu d'optimisation de latence (elle hache la voix),
      // son en 24 kHz, débit un peu ralenti et voix stable pour des personnes âgées.
      tts: {
        voice_id: VOIX_ID,
        model_id: "eleven_v4_turbo",
        optimize_streaming_latency: 1,
        agent_output_audio_format: "pcm_24000",
        stability: 0.6,
        similarity_boost: 0.8,
        speed: 0.95,
      },
      // Patient : l'agent laisse la personne finir ses phrases, même avec des pauses.
      turn: { turn_eagerness: "patient", turn_timeout: 15 },
      conversation: {
        max_duration_seconds: config.dureeMaxSecondes,
        // « interruption » : la personne peut couper l'agent (qui reprend ensuite sa phrase, cf. consignes).
        client_events: ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction"],
      },
    },
    // Connexion uniquement avec un jeton délivré par notre serveur.
    platform_settings: { auth: { enable_auth: true } },
  };
}

async function trouverOuCreerAgent(cle: string, config: ConfigurationAgent): Promise<string> {
  const { agents } = await appeler<{ agents: { agent_id: string; name: string }[] }>(cle, `/agents?search=${encodeURIComponent(NOM_AGENT)}&page_size=100`);
  const existant = agents.find((a) => a.name === NOM_AGENT);
  if (existant) {
    await appeler(cle, `/agents/${existant.agent_id}`, { method: "PATCH", body: corpsAgent(config) });
    return existant.agent_id;
  }
  const { agent_id } = await appeler<{ agent_id: string }>(cle, "/agents/create", { method: "POST", body: corpsAgent(config) });
  return agent_id;
}

export function creerAgentElevenLabs(): AgentVocal | null {
  const cle = process.env.ELEVENLABS_API_KEY?.trim();
  if (!cle) return null;
  let agentPret: Promise<string> | null = null;

  return {
    async ouvrirConversation(config) {
      agentPret ??= trouverOuCreerAgent(cle, config).catch((e: unknown) => {
        agentPret = null;
        throw e;
      });
      const agentId = await agentPret;
      const { token } = await appeler<{ token: string }>(cle, `/conversation/token?agent_id=${encodeURIComponent(agentId)}`);
      return { jeton: token };
    },
  };
}
