import type { Metadata } from "next";
import { RendreMaListe } from "@/modules/benevole/ui/rendre-ma-liste";

export const metadata: Metadata = { title: "Je n'ai plus de temps" };

export default function PageRendreMaListe() {
  return <RendreMaListe />;
}
