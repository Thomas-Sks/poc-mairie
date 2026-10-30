import type { Metadata } from "next";
import { PageBeneficiaires } from "@/modules/registre/ui/pages";

export const metadata: Metadata = { title: "Bénéficiaires" };

export default async function Beneficiaires({ searchParams }: PageProps<"/beneficiaires">) {
  const { q } = await searchParams;
  return <PageBeneficiaires question={typeof q === "string" && q.trim() ? q.slice(0, 300) : undefined} />;
}
