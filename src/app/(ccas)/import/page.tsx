import type { Metadata } from "next";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { contexteAvec } from "@/shared/infrastructure/session";
import { EnTetePage, Page } from "@/shared/ui/elements";
import { AssistantImport } from "@/modules/import/ui/assistant-import";

export const metadata: Metadata = { title: "Import Excel" };

export default async function PageImport() {
  await contexteAvec("import");
  return (
    <Page>
      <EnTetePage
        titre="Import Excel"
        description="Reprenez votre registre existant : l'assistant vous guide pour faire correspondre les colonnes et les valeurs, puis vérifie chaque ligne avant l'import."
        actions={
          <a href="/exemple-import-registre.xlsx" download className={buttonVariants({ variant: "outline" })}>
            <Download aria-hidden />
            Télécharger le fichier d&apos;exemple
          </a>
        }
      />
      <AssistantImport />
    </Page>
  );
}
