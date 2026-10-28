/** E11-US4 / US6 (maquette) — Détail d'un appel par l'assistant IA : résumé, réponses, risque, transcription. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, User } from "lucide-react";
import { z } from "zod";
import { formaterDateHeure } from "@/shared/domain/dates";
import { STATUT_CIBLE_LIBELLES, type NiveauRisque, type Ton } from "@/shared/domain/vocabulaire";
import { Pastille, Proprietes, Section, Surface } from "@/shared/ui/elements";
import { cn } from "@/lib/utils";
import { casDUsage } from "../infrastructure";
import { chargerFiche } from "./cadre-fiche";
import { tonResultat } from "./libelles";

const RISQUE: Record<NiveauRisque, { ton: Ton; libelle: string }> = {
  vert: { ton: "ok", libelle: "Risque faible" },
  orange: { ton: "warn", libelle: "Risque modéré" },
  rouge: { ton: "err", libelle: "Risque élevé" },
};

export async function PageAppelIa({ id, interactionId }: { id: string; interactionId: string }) {
  if (!z.uuid().safeParse(interactionId).success) notFound();
  const { ctx, fiche } = await chargerFiche(id);
  const appel = await casDUsage.consulterAppelIa(ctx, { beneficiaireId: id, interactionId });
  if (!appel) notFound();
  const { detail } = appel;
  const risque = RISQUE[detail.risque];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/beneficiaires/${id}/historique`} className="inline-flex min-h-11 w-fit items-center gap-2 font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Retour à l&apos;historique
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Surface className="p-5 sm:p-6">
          <Section titre="Transcription">
            <p className="text-sm text-muted-foreground">Aucun enregistrement audio n&apos;est conservé : seuls la transcription et le résumé sont stockés.</p>
            <ol className="flex flex-col gap-4 border-t pt-4">
              {detail.transcription.map((r, i) => {
                const ia = r.locuteur === "ia";
                return (
                  <li key={i} className="flex gap-3">
                    {ia ? <Bot className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> : <User className="mt-0.5 size-5 shrink-0 text-subtle-foreground" aria-hidden />}
                    <div className="flex flex-col gap-0.5">
                      <span className={cn("text-sm font-semibold", ia ? "text-primary" : "text-muted-foreground")}>
                        {ia ? "Assistant" : `${fiche.beneficiaire.civilite} ${fiche.beneficiaire.nom.toUpperCase()}`}
                      </span>
                      <p>{r.texte}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>
        </Surface>

        <div className="flex flex-col gap-6">
          <Surface className="p-5 sm:p-6">
            <Section titre="Résumé de l'appel">
              <div className="flex flex-wrap items-center gap-2">
                <Pastille ton={risque.ton}>{risque.libelle}</Pastille>
                {appel.resultat && <Pastille ton={tonResultat(appel.resultat)}>{STATUT_CIBLE_LIBELLES[appel.resultat]}</Pastille>}
              </div>
              <p>{detail.resume}</p>
              <p className="text-sm text-muted-foreground">{detail.justification}</p>
              <Proprietes
                className="border-t pt-4 sm:grid-cols-1"
                items={[
                  { libelle: "Date", valeur: formaterDateHeure(appel.survenueLe) },
                  { libelle: "Durée", valeur: appel.dureeMinutes ? `${appel.dureeMinutes} min` : null },
                  { libelle: "Campagne", valeur: appel.campagne?.nom },
                ]}
              />
            </Section>
          </Surface>
          {Object.keys(detail.reponses).length > 0 && (
            <Surface className="p-5 sm:p-6">
              <Section titre="Réponses au script">
                <dl className="flex flex-col divide-y">
                  {Object.entries(detail.reponses).map(([question, reponse]) => (
                    <div key={question} className="flex flex-col gap-0.5 py-2.5">
                      <dt className="text-sm text-muted-foreground">{question}</dt>
                      <dd className="font-medium">{reponse}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </Surface>
          )}
        </div>
      </div>
    </div>
  );
}
