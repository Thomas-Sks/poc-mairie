import type { Metadata } from "next";
import { PageAppelIa } from "@/modules/beneficiaires/ui/page-appel-ia";

export const metadata: Metadata = { title: "Appel par l'assistant IA" };

export default async function AppelIa({ params }: PageProps<"/beneficiaires/[id]/appels-ia/[interactionId]">) {
  const { id, interactionId } = await params;
  return <PageAppelIa id={id} interactionId={interactionId} />;
}
