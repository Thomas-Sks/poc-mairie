import type { NextRequest } from "next/server";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { peut } from "@/shared/domain/permissions";
import { casDUsageCrise } from "@/modules/crise/infrastructure";

/** Temps réel du tableau de bord de campagne (polling toutes les 2,5 s). */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/campagnes/[id]/tableau">) {
  const ctx = await obtenirContexte();
  if (!peut(ctx.utilisateur.role, "campagnes.gerer")) return Response.json({ erreur: "Accès refusé" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ erreur: "Campagne introuvable" }, { status: 404 });
  const tableau = await casDUsageCrise.consulterTableauDeBord(ctx, { campagneId: id, vague: req.nextUrl.searchParams.get("vague") });
  if (!tableau) return Response.json({ erreur: "Campagne introuvable" }, { status: 404 });
  return Response.json(tableau, { headers: { "Cache-Control": "no-store" } });
}
