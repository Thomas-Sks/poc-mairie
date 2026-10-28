import type { Metadata } from "next";
import { PageModifierFiche } from "@/modules/beneficiaires/ui/pages-formulaire";

export const metadata: Metadata = { title: "Modifier la fiche" };

export default async function ModifierFiche({ params }: PageProps<"/beneficiaires/[id]/modifier">) {
  const { id } = await params;
  return <PageModifierFiche id={id} />;
}
