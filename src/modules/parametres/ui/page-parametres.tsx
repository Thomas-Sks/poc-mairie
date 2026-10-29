import type { Contexte } from "@/shared/application/contexte";
import { EnTetePage, Page, Section, Surface } from "@/shared/ui/elements";
import { casDUsage } from "../infrastructure";
import { FormulaireGrille } from "./formulaire-grille";
import { ReinitialiserDemo } from "./reinitialiser-demo";

export async function PageParametres({ ctx }: { ctx: Contexte }) {
  const { parametres: p } = await casDUsage.lireParametres(ctx);

  return (
    <Page className="max-w-4xl">
      <EnTetePage
        titre="Critères de priorité"
        description="Chaque critère ajoute des points. Les personnes qui ont le plus de points sont appelées en premier."
      />
      <FormulaireGrille initiale={p.grilleScore} />

      <Section titre="Démonstration">
        <Surface className="flex flex-col gap-3 px-5 py-5 sm:px-6">
          <p className="text-muted-foreground">Remet la démonstration à zéro, avec les dates d&apos;aujourd&apos;hui.</p>
          <ReinitialiserDemo />
        </Surface>
      </Section>
    </Page>
  );
}
