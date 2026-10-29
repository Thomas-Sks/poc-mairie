import type { Metadata } from "next";
import { PageBeneficiaires } from "@/modules/registre/ui/pages";

export const metadata: Metadata = { title: "Bénéficiaires" };

export default function Beneficiaires() {
  return <PageBeneficiaires />;
}
