import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageRapport } from "@/modules/crise/ui/page-rapport";

export const metadata: Metadata = { title: "Bilan" };

export default async function Rapport({ params }: PageProps<"/campagnes/[id]/rapport">) {
  const ctx = await contexteAvec("campagnes.gerer");
  const { id } = await params;
  return <PageRapport ctx={ctx} campagneId={id} />;
}
