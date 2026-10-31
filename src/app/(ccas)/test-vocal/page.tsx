import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { PageTestVocal } from "@/modules/test-vocal/ui/page-test-vocal";

export const metadata: Metadata = { title: "Test Vocal AI" };

export default async function TestVocal() {
  await contexteAvec("vocal.tester");
  return <PageTestVocal />;
}
