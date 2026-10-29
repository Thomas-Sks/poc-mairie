import type { Metadata } from "next";
import { PageBenevoles } from "@/modules/benevole/ui/gestion/pages";

export const metadata: Metadata = { title: "Bénévoles" };

export default function Benevoles() {
  return <PageBenevoles />;
}
