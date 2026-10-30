"use server";

import { z } from "zod";
import { AccesRefuse } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";
import type { ReponseRegistre } from "../domain/reponse";
import { casDUsageAssistant } from "../infrastructure";

export type ResultatQuestion = { ok: true; reponse: ReponseRegistre } | { ok: false; erreur: string };

/** Question posée dans le registre : la réponse filtre le tableau, ou s'affiche en une ligne au-dessus. */
export async function poserQuestionAction(question: unknown): Promise<ResultatQuestion> {
  const q = z.string().trim().min(1).max(300).safeParse(question);
  if (!q.success) return { ok: false, erreur: "Écrivez une question (300 caractères au plus)." };
  try {
    return { ok: true, reponse: await casDUsageAssistant.interrogerRegistre(await obtenirContexte(), q.data) };
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: "Votre compte ne permet pas de poser cette question." };
    throw e;
  }
}
