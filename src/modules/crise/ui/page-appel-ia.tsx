import { notFound } from "next/navigation";
import { Bot, User } from "lucide-react";
import type { Contexte } from "@/shared/application/contexte";
import { formaterDateHeure } from "@/shared/domain/dates";
import { STATUT_CIBLE_LIBELLES, type NiveauRisque, type Ton } from "@/shared/domain/vocabulaire";
import { Bandeau, EnTetePage, Libelle, Page, Pastille, Surface } from "@/shared/ui/elements";
import { casDUsageCrise } from "../infrastructure";
import { tonStatut } from "../domain/tableau-de-bord";
import { LienRetour } from "./lien-retour";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RISQUE: Record<NiveauRisque, { libelle: string; ton: Ton }> = {
  vert: { libelle: "Risque faible", ton: "ok" },
  orange: { libelle: "Risque modéré", ton: "warn" },
  rouge: { libelle: "Risque élevé", ton: "err" },
};

/** Maquette E11 (mise de côté) : détail d'un appel IA fictif. */
export async function PageAppelIa({ ctx, campagneId, interactionId }: { ctx: Contexte; campagneId: string; interactionId: string }) {
  if (!UUID.test(interactionId)) notFound();
  const appel = await casDUsageCrise.consulterAppelIa(ctx, { interactionId });
  if (!appel || appel.campagneId !== campagneId) notFound();
  const { detail } = appel;
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        retour={<LienRetour href={`/campagnes/${campagneId}`}>{appel.campagneNom}</LienRetour>}
        titre={`Appel IA : ${appel.beneficiaire}`}
        description={`${formaterDateHeure(appel.survenueLe)}${appel.dureeMinutes ? ` · ${appel.dureeMinutes} min` : ""}${appel.telephone ? ` · ${appel.telephone}` : ""}`}
      />
      <Bandeau ton="accent" className="flex items-center gap-2">
        <Bot className="size-5 shrink-0" aria-hidden />
        Démonstration : cet appel est fictif. Les appels par agent vocal IA sont une évolution à venir. Aucun enregistrement audio n&apos;est conservé.
      </Bandeau>

      <Surface className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {appel.resultat && (
            <Pastille ton={tonStatut(appel.resultat)}>
              {appel.resultat === "escalade_humain" ? "Escaladé par l'IA – à rappeler par un humain" : STATUT_CIBLE_LIBELLES[appel.resultat]}
            </Pastille>
          )}
          <Pastille ton={RISQUE[detail.risque].ton}>{RISQUE[detail.risque].libelle}</Pastille>
        </div>
        <div className="flex flex-col gap-1">
          <Libelle>Résumé</Libelle>
          <p className="text-lg">{detail.resume}</p>
        </div>
        <div className="flex flex-col gap-1 border-t pt-4">
          <Libelle>Justification du niveau de risque</Libelle>
          <p>{detail.justification}</p>
        </div>
        <div className="flex flex-col gap-1 border-t pt-4">
          <Libelle>Réponses au script</Libelle>
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {Object.entries(detail.reponses).map(([q, r]) => (
              <li key={q}>
                <span className="text-muted-foreground">{q.toUpperCase()} :</span> {r}
              </li>
            ))}
          </ul>
        </div>
      </Surface>

      <Surface className="flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="titre-transcription">
        <h2 id="titre-transcription" className="text-xl font-semibold">
          Transcription
        </h2>
        <ol className="flex flex-col divide-y">
          {detail.transcription.map((t, i) => (
            <li key={i} className="flex gap-3 py-3">
              {t.locuteur === "ia" ? <Bot className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> : <User className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-muted-foreground">{t.locuteur === "ia" ? "Assistant automatique" : "La personne"}</span>
                <p>{t.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </Surface>
    </Page>
  );
}
