import type { Metadata } from "next";
import { PageBenevole } from "@/modules/benevole/ui/gestion/pages";

export const metadata: Metadata = { title: "Bénévole" };

export default async function Benevole({ params }: PageProps<"/benevoles/[id]">) {
  const { id } = await params;
  return <PageBenevole id={id} />;
}
