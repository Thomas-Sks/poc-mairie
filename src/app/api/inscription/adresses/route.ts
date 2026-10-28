import { rechercherAdressesLocales } from "@/modules/inscriptions/infrastructure";

/** Repli de l'autocomplétion d'adresse du formulaire public quand l'API Adresse (BAN) ne répond pas. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 120) ?? "";
  return Response.json(await rechercherAdressesLocales(q));
}
