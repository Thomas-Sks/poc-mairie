import type { Metadata } from "next";
import { PageListes } from "@/modules/registre/ui/pages";

export const metadata: Metadata = { title: "Listes" };

export default function Listes() {
  return <PageListes />;
}
