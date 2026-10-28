import { OngletInfos } from "@/modules/beneficiaires/ui/onglet-infos";

export default async function InfosFiche({ params }: PageProps<"/beneficiaires/[id]">) {
  const { id } = await params;
  return <OngletInfos id={id} />;
}
