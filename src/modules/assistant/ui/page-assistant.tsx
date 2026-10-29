import { contexteAvec } from "@/shared/infrastructure/session";
import { EnTetePage, Page } from "@/shared/ui/elements";
import { QUESTIONS_SUGGEREES } from "../application/repondre";
import { casDUsageAssistant } from "../infrastructure";
import { Assistant } from "./assistant";

const DESCRIPTION = "Posez une question sur le registre : un chiffre, une liste à télécharger, une fiche. La même question donne toujours la même réponse.";

export async function PageAssistant({ question }: { question: string | null }) {
  const ctx = await contexteAvec("statistiques.lire");
  const modeSimple = ctx.utilisateur.role === "admin" && !casDUsageAssistant.iaActive();
  return (
    <Page className="max-w-3xl">
      <EnTetePage
        titre="Assistant"
        description={modeSimple ? `${DESCRIPTION} Mode simple : l'IA n'est pas branchée, seuls les mots-clés connus sont compris.` : DESCRIPTION}
      />
      <Assistant questionInitiale={question} suggestions={QUESTIONS_SUGGEREES} />
    </Page>
  );
}
