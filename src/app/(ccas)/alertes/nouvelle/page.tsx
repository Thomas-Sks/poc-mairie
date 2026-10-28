import type { Metadata } from "next";
import { contexteAvec } from "@/shared/infrastructure/session";
import { aujourdhui } from "@/shared/domain/dates";
import { EnTetePage, Page } from "@/shared/ui/elements";
import { FormulaireAlerte } from "@/modules/crise/ui/formulaire-alerte";
import { LienRetour } from "@/modules/crise/ui/lien-retour";

export const metadata: Metadata = { title: "Déclencher une alerte" };

export default async function NouvelleAlerte() {
  const ctx = await contexteAvec("alertes.declencher");
  return (
    <Page>
      <EnTetePage
        retour={<LienRetour href="/alertes">Alertes et campagnes</LienRetour>}
        titre="Déclencher une alerte"
        description="Après le déclenchement, vous choisirez les personnes à appeler et l'équipe mobilisée."
      />
      <FormulaireAlerte aujourdhui={aujourdhui(ctx.maintenant)} />
    </Page>
  );
}
