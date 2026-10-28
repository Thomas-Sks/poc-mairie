import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageParametres } from "@/modules/parametres/ui/page-parametres";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Parametres() {
  const ctx = await contexteAvec("parametres.gerer");
  return <PageParametres ctx={ctx} />;
}
