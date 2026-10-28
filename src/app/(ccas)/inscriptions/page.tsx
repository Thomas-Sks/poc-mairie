import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { casDUsage } from "@/modules/inscriptions/infrastructure";
import { FileValidation } from "@/modules/inscriptions/ui/file-validation";

export const metadata: Metadata = { title: "Inscriptions à valider" };

export default async function PageInscriptions() {
  const ctx = await contexteAvec("inscriptions.valider");
  const { file, traitees } = await casDUsage.listerInscriptions(ctx);
  return <FileValidation file={file} traitees={traitees} maintenant={ctx.maintenant} />;
}
