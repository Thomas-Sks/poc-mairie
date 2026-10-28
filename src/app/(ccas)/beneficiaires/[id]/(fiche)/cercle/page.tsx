import { OngletCercle } from "@/modules/beneficiaires/ui/onglet-cercle";

export default async function Cercle({ params }: PageProps<"/beneficiaires/[id]/cercle">) {
  const { id } = await params;
  return <OngletCercle id={id} />;
}
