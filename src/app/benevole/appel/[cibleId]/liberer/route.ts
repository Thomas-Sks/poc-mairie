import { obtenirContexte } from "@/shared/infrastructure/session";
import { casDUsageBenevole } from "@/modules/benevole/infrastructure";

/** Libération du verrou quand l'onglet se ferme (navigator.sendBeacon, E8-US7). */
export async function POST(_req: Request, { params }: RouteContext<"/benevole/appel/[cibleId]/liberer">) {
  const { cibleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(cibleId)) return new Response(null, { status: 400 });
  try {
    await casDUsageBenevole.libererVerrou(await obtenirContexte(), cibleId);
  } catch {
    // Personne plus accessible : rien à libérer.
  }
  return new Response(null, { status: 204 });
}
