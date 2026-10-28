import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { BellRing, ChevronRight, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formaterDate, formaterDateLongue } from "@/shared/domain/dates";
import { ALERTE_LIBELLES } from "@/shared/domain/vocabulaire";
import { EnTetePage, EtatVide, Libelle, Page, Pastille, Section, Surface } from "@/shared/ui/elements";
import type { Contexte } from "@/shared/application/contexte";
import { casDUsageCrise } from "../infrastructure";
import type { Alerte, CampagneResume } from "../application/ports";
import { BoutonCloturer } from "./bouton-cloturer";
import { CANAL_LIBELLES, NIVEAU_ALERTE_LIBELLES, NIVEAU_ALERTE_TONS } from "./libelles";

const periode = (a: Alerte) => (a.finPrevue ? `Du ${formaterDate(a.debut)} au ${formaterDate(a.finPrevue)}` : `Depuis le ${formaterDateLongue(a.debut)}`);

function LigneCampagne({ c, rapport }: { c: CampagneResume; rapport?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col">
        <Link href={`/campagnes/${c.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
          {c.nom}
        </Link>
        <span className="text-sm text-muted-foreground">
          {c.nbPersonnes} personnes · {CANAL_LIBELLES[c.canal]}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {rapport && (
          <Link href={`/campagnes/${c.id}/rapport`} className={buttonVariants({ variant: "outline" })}>
            <FileText aria-hidden />
            Rapport
          </Link>
        )}
        <Link href={`/campagnes/${c.id}`} className={buttonVariants({ variant: rapport ? "ghost" : "outline" })}>
          {rapport ? "Bilan" : "Tableau de bord"}
          <ChevronRight aria-hidden />
        </Link>
      </div>
    </li>
  );
}

export async function PageAlertes({ ctx }: { ctx: Contexte }) {
  const { enCours, passees, peutDeclencher } = await casDUsageCrise.listerAlertes(ctx);
  return (
    <Page>
      <EnTetePage
        titre="Alertes et campagnes"
        description="Déclenchez une alerte, lancez une campagne d'appels et suivez la couverture des personnes en temps réel."
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
            <EtatVide titre="Aucune alerte en cours" description="Lorsqu'une vigilance est annoncée, déclenchez une alerte pour organiser les appels." />
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
                  <Link href={`/alertes/${a.id}/campagne`} className={buttonVariants({ variant: a.campagnes.length ? "outline" : "default" })}>
                    <Plus aria-hidden />
                    Créer une campagne
                  </Link>
                  {peutDeclencher && <BoutonCloturer alerteId={a.id} libelle={ALERTE_LIBELLES[a.type]} />}
                </div>
              </div>
              <div className="flex flex-col border-t pt-3">
                <Libelle>Campagnes</Libelle>
                {a.campagnes.length === 0 ? (
                  <p className="py-3 text-muted-foreground">Aucune campagne lancée pour cette alerte.</p>
                ) : (
                  <ul className="divide-y">
                    {a.campagnes.map((c) => (
                      <LigneCampagne key={c.id} c={c} />
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
          <p className="text-muted-foreground">Aucune alerte clôturée.</p>
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
                      <LigneCampagne key={c.id} c={c} rapport />
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
