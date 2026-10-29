import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { BellRing, ChevronRight, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formaterDate, formaterDateLongue } from "@/shared/domain/dates";
import { ALERTE_LIBELLES } from "@/shared/domain/vocabulaire";
import { EnTetePage, EtatVide, Page, Pastille, Section, Surface } from "@/shared/ui/elements";
import type { Contexte } from "@/shared/application/contexte";
import { casDUsageCrise } from "../infrastructure";
import type { Alerte, CampagneResume } from "../application/ports";
import { BoutonCloturer } from "./bouton-cloturer";
import { NIVEAU_ALERTE_LIBELLES, NIVEAU_ALERTE_TONS } from "./libelles";

const periode = (a: Alerte) => (a.finPrevue ? `Du ${formaterDate(a.debut)} au ${formaterDate(a.finPrevue)}` : `Depuis le ${formaterDateLongue(a.debut)}`);

/**
 * Une série d'appels : en cours on la suit, terminée on lit son bilan.
 * Son nom (« Canicule – 29/10/2026 ») redit l'alerte : on ne l'affiche que s'il y a plusieurs séries.
 */
function LigneCampagne({ c, terminee, avecNom }: { c: CampagneResume; terminee?: boolean; avecNom: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="font-semibold">
          {c.nbPersonnes} personnes {terminee ? "appelées" : "à appeler"}
        </span>
        {avecNom && <span className="text-sm text-muted-foreground">{c.nom}</span>}
      </div>
      <Link href={terminee ? `/campagnes/${c.id}/rapport` : `/campagnes/${c.id}`} className={buttonVariants({ variant: terminee ? "ghost" : "default" })}>
        {terminee ? <FileText aria-hidden /> : null}
        {terminee ? "Bilan" : "Suivre les appels"}
        {terminee ? null : <ChevronRight aria-hidden />}
      </Link>
    </li>
  );
}

export async function PageAlertes({ ctx }: { ctx: Contexte }) {
  const { enCours, passees, peutDeclencher } = await casDUsageCrise.listerAlertes(ctx);
  return (
    <Page>
      <EnTetePage
        titre="Alertes"
        description="1. Déclenchez l'alerte (canicule, grand froid…). 2. Lancez les appels. 3. Suivez qui a été joint."
        actions={
          peutDeclencher && (
            <Link href="/alertes/nouvelle" className={buttonVariants({ size: "lg" })}>
              <BellRing aria-hidden />
              Déclencher une alerte
            </Link>
          )
        }
      />

      <Section titre="En cours">
        {enCours.length === 0 ? (
          <Surface className="px-5">
            <EtatVide titre="Aucune alerte en cours" description="Quand Météo-France annonce une vigilance, déclenchez une alerte pour organiser les appels." />
          </Surface>
        ) : (
          enCours.map((a) => (
            <Surface key={a.id} className="flex flex-col gap-4 p-5" aria-labelledby={`alerte-${a.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id={`alerte-${a.id}`} className="text-xl font-semibold">
                      {ALERTE_LIBELLES[a.type]}
                    </h3>
                    <Pastille ton={NIVEAU_ALERTE_TONS[a.niveau]}>{NIVEAU_ALERTE_LIBELLES[a.niveau]}</Pastille>
                  </div>
                  <p className="text-muted-foreground">
                    {periode(a)} · {a.perimetre}
                  </p>
                  {a.message && <p className="max-w-[70ch]">{a.message}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/alertes/${a.id}/campagne`} className={buttonVariants({ variant: a.campagnes.length ? "ghost" : "default" })}>
                    <Plus aria-hidden />
                    {a.campagnes.length ? "Lancer d'autres appels" : "Lancer les appels"}
                  </Link>
                  {peutDeclencher && <BoutonCloturer alerteId={a.id} libelle={ALERTE_LIBELLES[a.type]} />}
                </div>
              </div>
              <div className="flex flex-col border-t pt-3">
                {a.campagnes.length === 0 ? (
                  <p className="py-3 text-muted-foreground">Aucun appel lancé pour l&apos;instant.</p>
                ) : (
                  <ul className="divide-y">
                    {a.campagnes.map((c) => (
                      <LigneCampagne key={c.id} c={c} avecNom={a.campagnes.length > 1} />
                    ))}
                  </ul>
                )}
              </div>
            </Surface>
          ))
        )}
      </Section>

      <Section titre="Alertes passées">
        {passees.length === 0 ? (
          <p className="text-muted-foreground">Aucune alerte terminée.</p>
        ) : (
          <Surface className="px-5">
            <ul className="divide-y">
              {passees.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{ALERTE_LIBELLES[a.type]}</span>
                    <Pastille ton="neutre">{NIVEAU_ALERTE_LIBELLES[a.niveau]}</Pastille>
                    <span className="text-sm text-muted-foreground">
                      {periode(a)} · {a.perimetre}
                    </span>
                  </div>
                  <ul className={cn("divide-y", a.campagnes.length === 0 && "hidden")}>
                    {a.campagnes.map((c) => (
                      <LigneCampagne key={c.id} c={c} terminee avecNom={a.campagnes.length > 1} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </Section>
    </Page>
  );
}
