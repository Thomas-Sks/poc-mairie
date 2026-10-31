"use server";

import { AccesRefuse } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { VoixNonConfiguree, type ConversationOuverte } from "../application/demarrer-test";
import { casDUsageTestVocal } from "../infrastructure";

export type ResultatDemarrage = ({ ok: true } & ConversationOuverte) | { ok: false; erreur: string };

/** Délivre un jeton de conversation à usage unique : la clé ElevenLabs ne quitte jamais le serveur. */
export async function demarrerTestVocalAction(): Promise<ResultatDemarrage> {
  try {
    return { ok: true, ...(await casDUsageTestVocal.demarrer(await obtenirContexte())) };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: "Votre compte ne permet pas de lancer le test vocal." };
    if (e instanceof VoixNonConfiguree) return { ok: false, erreur: "La voix n'est pas encore branchée : la clé ElevenLabs manque sur le serveur." };
    console.error(e);
    return { ok: false, erreur: "Le service de voix ne répond pas. Réessayez dans un instant." };
  }
}
