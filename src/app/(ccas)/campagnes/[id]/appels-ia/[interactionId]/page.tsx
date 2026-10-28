import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageAppelIa } from "@/modules/crise/ui/page-appel-ia";

export const metadata: Metadata = { title: "Appel IA (démonstration)" };

export default async function AppelIa({ params }: PageProps<"/campagnes/[id]/appels-ia/[interactionId]">) {
  const ctx = await contexteAvec("campagnes.gerer");
  const { id, interactionId } = await params;
  return <PageAppelIa ctx={ctx} campagneId={id} interactionId={interactionId} />;
}
