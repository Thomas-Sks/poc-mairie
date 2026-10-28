/** État renvoyé par les Server Actions de formulaire (affichage des erreurs et confirmations). */
export type DoublonAffiche = { id: string; nom: string; dateNaissance: string; statut: string; motifs: string[] };

export type EtatAction = {
  ok: boolean;
  message?: string;
  erreurs?: Partial<Record<string, string>>;
  doublons?: DoublonAffiche[];
  /** Incrémenté à chaque réponse : permet au client de réagir une seule fois par soumission. */
  jeton?: number;
};

export const ETAT_INITIAL: EtatAction = { ok: false };
