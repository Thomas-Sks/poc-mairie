import type { Metadata } from "next";
import { PageListe } from "@/modules/registre/ui/pages";

export const metadata: Metadata = { title: "Liste" };

export default async function Liste({ params }: PageProps<"/listes/[id]">) {
  const { id } = await params;
  return <PageListe id={id} />;
}
