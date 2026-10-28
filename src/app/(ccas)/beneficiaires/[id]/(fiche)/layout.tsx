import type { Metadata } from "next";
import { CadreFiche } from "@/modules/beneficiaires/ui/cadre-fiche";

export const metadata: Metadata = { title: "Fiche bénéficiaire" };

export default async function LayoutFiche({ children, params }: LayoutProps<"/beneficiaires/[id]">) {
  const { id } = await params;
  return <CadreFiche id={id}>{children}</CadreFiche>;
}
