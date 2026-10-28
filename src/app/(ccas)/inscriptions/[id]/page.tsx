import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contexteAvec } from "@/shared/infrastructure/session";
import { casDUsage } from "@/modules/inscriptions/infrastructure";
import { DetailInscriptionVue } from "@/modules/inscriptions/ui/detail-inscription";

export const metadata: Metadata = { title: "Inscription" };

export default async function PageInscription({ params }: PageProps<"/inscriptions/[id]">) {
  const { id } = await params;
  const ctx = await contexteAvec("inscriptions.valider");
  const inscription = await casDUsage.consulterInscription(ctx, id);
  if (!inscription) notFound();
  return <DetailInscriptionVue inscription={inscription} maintenant={ctx.maintenant} />;
}
