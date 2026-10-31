export type ConfigurationAgent = {
  consignes: string;
  premierMessage: string;
  dureeMaxSecondes: number;
  messageFinDuree: string;
};

/** Fournisseur de voix IA (ElevenLabs). */
export interface AgentVocal {
  /** Met l'agent à jour avec cette configuration et délivre un jeton de conversation pour le navigateur. */
  ouvrirConversation(config: ConfigurationAgent): Promise<{ jeton: string }>;
}
