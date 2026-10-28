import type { Metadata } from "next";
import { PageExplorateur } from "@/modules/statistiques/ui/pages";

export const metadata: Metadata = { title: "Statistiques" };

export default async function Statistiques({ searchParams }: PageProps<"/statistiques">) {
  const { requete } = await searchParams;
  return <PageExplorateur requeteId={typeof requete === "string" ? requete : undefined} />;
}
