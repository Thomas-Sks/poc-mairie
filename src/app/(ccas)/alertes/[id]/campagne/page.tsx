import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageCreationCampagne } from "@/modules/crise/ui/page-creation-campagne";

export const metadata: Metadata = { title: "Nouvelle campagne d'appels" };

export default async function NouvelleCampagne({ params }: PageProps<"/alertes/[id]/campagne">) {
  const ctx = await contexteAvec("campagnes.gerer");
  const { id } = await params;
  return <PageCreationCampagne ctx={ctx} alerteId={id} />;
}
