import type { NextRequest } from "next/server";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { peut } from "@/shared/domain/permissions";
import { casDUsageCrise } from "@/modules/crise/infrastructure";

/** NF-07 : export de secours de la liste de campagne (CSV), pour continuer sur papier en cas de panne. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/campagnes/[id]/export">) {
  const ctx = await obtenirContexte();
  if (!peut(ctx.utilisateur.role, "campagnes.gerer")) return new Response("Accès refusé", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Campagne introuvable", { status: 404 });
  const r = await casDUsageCrise.exporterListeCsv(ctx, { campagneId: id, vague: req.nextUrl.searchParams.get("vague") });
  if (!r) return new Response("Campagne introuvable", { status: 404 });
  return new Response(r.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${r.nomFichier}"`,
      "Cache-Control": "no-store",
    },
  });
}
