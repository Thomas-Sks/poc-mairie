import type { Metadata } from "next";
import { PageExplorateur } from "@/modules/statistiques/ui/pages";

export const metadata: Metadata = { title: "Explorateur de statistiques" };

export default async function Explorateur({ searchParams }: PageProps<"/statistiques/explorateur">) {
  const { requete } = await searchParams;
  return <PageExplorateur requeteId={typeof requete === "string" ? requete : undefined} />;
}
