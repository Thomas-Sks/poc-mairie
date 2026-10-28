import type { Metadata } from "next";
import { PageRequetes } from "@/modules/statistiques/ui/pages";

export const metadata: Metadata = { title: "Requêtes enregistrées" };

export default function Requetes() {
  return <PageRequetes />;
}
