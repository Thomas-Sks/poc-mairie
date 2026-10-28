import { redirect } from "next/navigation";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { casDUsageBenevole } from "@/modules/benevole/infrastructure";
import { EngagementRequis } from "@/modules/benevole/application/acces";

/** « Personne suivante » : calculée au moment du clic, puis ouverture de l'écran « Appel ». */
export default async function PagePersonneSuivante() {
  const ctx = await obtenirContexte();
  let id: string | null = null;
  try {
    id = await casDUsageBenevole.trouverPersonneSuivante(ctx);
  } catch (e) {
    if (!(e instanceof EngagementRequis)) throw e;
  }
  redirect(id ? `/benevole/appel/${id}` : "/benevole");
}
