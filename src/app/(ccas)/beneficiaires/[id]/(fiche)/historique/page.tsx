import { OngletHistorique } from "@/modules/beneficiaires/ui/onglet-historique";

export default async function Historique({ params, searchParams }: PageProps<"/beneficiaires/[id]/historique">) {
  const { id } = await params;
  const { type, periode } = await searchParams;
  return <OngletHistorique id={id} type={typeof type === "string" ? type : undefined} periode={typeof periode === "string" ? periode : undefined} />;
}
