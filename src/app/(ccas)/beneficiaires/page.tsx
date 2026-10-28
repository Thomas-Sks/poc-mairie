import type { Metadata } from "next";
import { PageBeneficiaires } from "@/modules/registre/ui/pages";

export const metadata: Metadata = { title: "Bénéficiaires" };

export default async function Beneficiaires({ searchParams }: PageProps<"/beneficiaires">) {
  const { "non-verifiee-depuis": mois } = await searchParams;
  const n = typeof mois === "string" ? Number.parseInt(mois, 10) : NaN;
  return <PageBeneficiaires nonVerifieeDepuisMois={Number.isInteger(n) && n >= 1 && n <= 120 ? n : undefined} />;
}
