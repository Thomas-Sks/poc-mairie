import type { Metadata } from "next";
import { PageDashboard } from "@/modules/statistiques/ui/pages";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBord({ params, searchParams }: PageProps<"/statistiques/tableaux-de-bord/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const texte = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <PageDashboard id={id} du={texte(sp.du)} au={texte(sp.au)} secret={sp.secret === "1"} edition={sp.edition === "1"} />;
}
