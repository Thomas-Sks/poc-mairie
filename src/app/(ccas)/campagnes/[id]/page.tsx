import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contexteAvec } from "@/shared/infrastructure/session";
import { casDUsageCrise } from "@/modules/crise/infrastructure";
import { TableauDeBordCampagne } from "@/modules/crise/ui/tableau-de-bord";
import { versJson } from "@/modules/crise/ui/libelles";

export const metadata: Metadata = { title: "Tableau de bord de campagne" };

export default async function Campagne({ params, searchParams }: PageProps<"/campagnes/[id]">) {
  const ctx = await contexteAvec("campagnes.gerer");
  const { id } = await params;
  const { vague } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tableau = await casDUsageCrise.consulterTableauDeBord(ctx, { campagneId: id, vague: typeof vague === "string" ? vague : null });
  if (!tableau) notFound();
  return <TableauDeBordCampagne initial={versJson(tableau)} vagueDemandee={typeof vague === "string" ? vague : null} />;
}
