import { OngletIntervenants } from "@/modules/beneficiaires/ui/onglet-intervenants";

export default async function Intervenants({ params }: PageProps<"/beneficiaires/[id]/intervenants">) {
  const { id } = await params;
  return <OngletIntervenants id={id} />;
}
