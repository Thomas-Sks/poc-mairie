import type { Metadata } from "next";
import { PageNouvelleFiche } from "@/modules/beneficiaires/ui/pages-formulaire";

export const metadata: Metadata = { title: "Nouvelle fiche" };

export default function NouvelleFiche() {
  return <PageNouvelleFiche />;
}
