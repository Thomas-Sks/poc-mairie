import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageReglagesIa } from "@/modules/crise/ui/page-reglages-ia";

export const metadata: Metadata = { title: "Réglages IA (bientôt disponible)" };

export default async function ReglagesIa({ params }: PageProps<"/campagnes/[id]/reglages-ia">) {
  await contexteAvec("campagnes.gerer");
  const { id } = await params;
  return <PageReglagesIa campagneId={id} />;
}
