/**
 * Adaptateurs entrants HTTP (Route Handlers) du registre — lecture et temps réel (polling 2,5 s, E8-US7).
 * Les fichiers `src/app/api/registre/**\/route.ts` ne font que réexporter ces fonctions.
 */
import "server-only";
import { z } from "zod";
import { AccesRefuse } from "@/shared/domain/permissions";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { schemaFiltre, normaliserFiltre, type Filtre } from "../domain/filtre";
import { lireRequeteTableau } from "../domain/tableau";
import { ErreurMetier } from "../application/actions-groupees";
import { ListeIntrouvable } from "../application/rechercher-beneficiaire-ids";
import { casDUsage } from "../infrastructure";

async function traiter(f: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await f(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AccesRefuse) return Response.json({ erreur: "Accès refusé" }, { status: 403 });
    if (e instanceof ListeIntrouvable) return Response.json({ erreur: e.message }, { status: 404 });
    if (e instanceof z.ZodError) return Response.json({ erreur: "Requête invalide", details: e.issues }, { status: 400 });
    if (e instanceof ErreurMetier) return Response.json({ erreur: e.message }, { status: 400 });
    throw e;
  }
}

const lireJson = async (req: Request) => {
  try {
    return (await req.json()) as unknown;
  } catch {
    return {};
  }
};

/** POST /api/registre/recherche — page du tableau (filtre, tri, pagination côté serveur). */
export async function rechercher(req: Request) {
  const corps = await lireJson(req);
  return traiter(async () => casDUsage.consulterTableau(await obtenirContexte(), lireRequeteTableau(corps)));
}

const schemaCarte = z.object({ filtre: schemaFiltre.default({ version: 1 }), listeId: z.uuid().optional() });

/** POST /api/registre/carte — points de la carte, synchronisés avec les filtres. */
export async function carte(req: Request) {
  const corps = await lireJson(req);
  return traiter(async () => {
    const e = schemaCarte.parse(corps);
    return casDUsage.consulterCarte(await obtenirContexte(), { filtre: normaliserFiltre(e.filtre as Filtre), listeId: e.listeId });
  });
}

/** GET /api/registre/voies?q=mar — autocomplétion des rues (table `adresses`). */
export async function voies(req: Request) {
  const q = z.string().max(100).catch("").parse(new URL(req.url).searchParams.get("q") ?? "");
  return traiter(async () => casDUsage.suggererVoies(await obtenirContexte(), q));
}

const schemaPresence = z.object({ ressource: z.string().regex(/^[a-z0-9:-]{1,80}$/) });

/** POST /api/registre/presence — signale la présence et renvoie les autres personnes sur la même liste. */
export async function presence(req: Request) {
  const corps = await lireJson(req);
  return traiter(async () => casDUsage.signalerPresence(await obtenirContexte(), schemaPresence.parse(corps).ressource));
}
