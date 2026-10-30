import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { aujourdhui } from "@/shared/domain/dates";
import { EnTetePage, Page } from "@/shared/ui/elements";
import { FormulaireAlerte } from "@/modules/crise/ui/formulaire-alerte";
import { LienRetour } from "@/modules/crise/ui/lien-retour";

export const metadata: Metadata = { title: "Déclencher une alerte" };

export default async function NouvelleAlerte({ searchParams }: PageProps<"/alertes/nouvelle">) {
  const ctx = await contexteAvec("alertes.declencher");
  const { liste } = await searchParams;
  return (
    <Page>
      <EnTetePage
        retour={<LienRetour href="/alertes">Alertes</LienRetour>}
        titre="Déclencher une alerte"
        description={
          liste
            ? "Étape 1 sur 2. Ensuite, les personnes sélectionnées dans le tableau seront appelées."
            : "Étape 1 sur 2. Ensuite, vous choisirez qui appeler et qui passe les appels."
        }
      />
      <FormulaireAlerte aujourdhui={aujourdhui(ctx.maintenant)} listeId={typeof liste === "string" ? liste : undefined} />
    </Page>
  );
}
