import { OngletIndisponibilites } from "@/modules/beneficiaires/ui/onglet-indisponibilites";

export default async function Indisponibilites({ params }: PageProps<"/beneficiaires/[id]/indisponibilites">) {
  const { id } = await params;
  return <OngletIndisponibilites id={id} />;
}
