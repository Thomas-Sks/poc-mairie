import type { NextRequest } from "next/server";
import { casDUsageAssistant } from "@/modules/assistant/infrastructure";
import { classeurPersonnes } from "@/modules/assistant/infrastructure/excel";
import { aujourdhui } from "@/shared/domain/dates";
import { peut } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";

/** Téléchargement Excel d'une réponse « liste » de l'assistant (même question → même liste). */
export async function GET(req: NextRequest) {
  const ctx = await obtenirContexte();
  if (!peut(ctx.utilisateur.role, "export")) return new Response("Accès refusé", { status: 403 });
  const question = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 300);
  const r = question ? await casDUsageAssistant.exporterPersonnes(ctx, question) : null;
  if (!r) return new Response("Cette question ne donne pas de liste de personnes.", { status: 404 });
  const fichier = classeurPersonnes(r.titre, r.personnes);
  return new Response(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liste-${aujourdhui(ctx.maintenant)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
