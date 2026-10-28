import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageVueEnsemble } from "@/modules/statistiques/ui/page-vue-ensemble";

export const metadata: Metadata = { title: "Statistiques" };

export default async function Statistiques({ searchParams }: PageProps<"/statistiques">) {
  // Anciens liens vers une requête enregistrée : elles s'ouvrent désormais dans l'explorateur.
  const { requete } = await searchParams;
  if (typeof requete === "string") redirect(`/statistiques/explorateur?requete=${encodeURIComponent(requete)}`);
  return <PageVueEnsemble />;
}
