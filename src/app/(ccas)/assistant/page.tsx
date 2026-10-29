import { redirect } from "next/navigation";

/** L'assistant est intégré au registre (page Bénéficiaires) : les anciens liens y mènent. */
export default async function Assistant({ searchParams }: PageProps<"/assistant">) {
  const { q } = await searchParams;
  redirect(typeof q === "string" && q.trim() ? `/beneficiaires?q=${encodeURIComponent(q.slice(0, 300))}` : "/beneficiaires");
}
