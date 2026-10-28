import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { EngagementRequis, PersonneInaccessible } from "@/modules/benevole/application/acces";
import { casDUsageBenevole } from "@/modules/benevole/infrastructure";
import { EcranAppel } from "@/modules/benevole/ui/ecran-appel";

export const metadata: Metadata = { title: "Appel" };

export default async function PageAppel({ params }: PageProps<"/benevole/appel/[cibleId]">) {
  const { cibleId } = await params;
  const ctx = await obtenirContexte();
  if (!/^[0-9a-f-]{36}$/i.test(cibleId)) redirect("/benevole");
  const donnees = await casDUsageBenevole.ouvrirAppel(ctx, cibleId).catch((e: unknown) => {
    // RG-07 : une personne hors de la liste du jour n'est jamais affichée.
    if (e instanceof PersonneInaccessible || e instanceof EngagementRequis) redirect("/benevole");
    throw e;
  });
  // `key` : repartir d'un écran vierge quand on passe à la personne suivante.
  return <EcranAppel key={cibleId} donnees={donnees} />;
}
