import type { Metadata } from "next";
import { PageAssistant } from "@/modules/assistant/ui/page-assistant";

export const metadata: Metadata = { title: "Assistant" };

export default async function Assistant({ searchParams }: PageProps<"/assistant">) {
  const { q } = await searchParams;
  return <PageAssistant question={typeof q === "string" && q.trim() ? q.slice(0, 300) : null} />;
}
