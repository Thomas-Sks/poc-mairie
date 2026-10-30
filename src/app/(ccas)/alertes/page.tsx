import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageAlertes } from "@/modules/crise/ui/page-alertes";

export const metadata: Metadata = { title: "Alertes" };

export default async function Alertes() {
  const ctx = await contexteAvec("campagnes.gerer");
  return <PageAlertes ctx={ctx} />;
}
