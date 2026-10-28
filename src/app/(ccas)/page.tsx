import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageTaches } from "@/modules/taches/ui/page-taches";

export const metadata: Metadata = { title: "Mes tâches du jour" };

export default async function Accueil({ searchParams }: PageProps<"/">) {
  const ctx = await contexteAvec("fiches.lire");
  const { vue } = await searchParams;
  return <PageTaches ctx={ctx} equipe={vue === "equipe"} />;
}
