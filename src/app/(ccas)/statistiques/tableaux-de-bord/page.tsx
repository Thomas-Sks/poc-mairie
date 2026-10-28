import type { Metadata } from "next";
import { PageDashboards } from "@/modules/statistiques/ui/pages";

export const metadata: Metadata = { title: "Tableaux de bord" };

export default function TableauxDeBord() {
  return <PageDashboards />;
}
