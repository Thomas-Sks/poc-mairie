import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui, formaterDate, formaterDateLongue } from "@/shared/domain/dates";
import { EnTetePage, EtatVide, Page, Pastille, Section, Surface } from "@/shared/ui/elements";
import { libelleDans, libelleRetard } from "../domain/taches-du-jour";
import type { RappelVue, VueTaches } from "../application/obtenir-taches-du-jour";
import { casDUsage } from "../infrastructure";
import { ActionsRappel } from "./actions-rappel";

const FICHES_AFFICHEES = 5;

const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const formaterJour = (d: string) => FORMAT_JOUR.format(new Date(`${d}T00:00:00Z`));
const FORMAT_JOUR_MOIS = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

const lienFiche = (id: string) => `/beneficiaires/${id}`;

function pluriel(n: number, singulier: string, plurielForme = `${singulier}s`) {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

/** « 4 rappels, 2 anniversaires et 3 inscriptions à valider » */
function resume(v: VueTaches): string {
  const morceaux = [
    v.rappels.length > 0 && pluriel(v.rappels.length, "rappel"),
    v.anniversaires.length > 0 && pluriel(v.anniversaires.length, "anniversaire"),
    v.inscriptions && v.inscriptions.length > 0 && `${pluriel(v.inscriptions.length, "inscription")} à valider`,
  ].filter((m): m is string => Boolean(m));
  if (morceaux.length === 0) return "Rien d'urgent aujourd'hui.";
  const fin = morceaux.pop();
  return `${morceaux.length ? `${morceaux.join(", ")} et ${fin}` : fin}.`;
}

/** Ligne de liste entièrement cliquable vers une fiche (cible tactile ≥ 44 px). */
function LigneLien({ href, titre, detail, fin }: { href: string; titre: ReactNode; detail?: ReactNode; fin?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-11 items-center gap-3 px-5 py-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{titre}</span>
          {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
        </span>
        {fin}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
      </Link>
    </li>
  );
}

function LigneRappel({ rappel, afficherAssigne }: { rappel: RappelVue; afficherAssigne: boolean }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-semibold">{rappel.objet}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          {rappel.urgent && <Pastille ton="err">Urgent</Pastille>}
          <Pastille ton={rappel.joursDeRetard > 0 ? "warn" : "accent"}>{libelleRetard(rappel.joursDeRetard)}</Pastille>
          {rappel.beneficiaire && (
            <Link href={lienFiche(rappel.beneficiaire.id)} className="relative font-medium text-primary underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:underline">
              Ouvrir la fiche
            </Link>
          )}
          {afficherAssigne && <span>{rappel.assigneNom ? `Assigné à ${rappel.assigneNom}` : "Non assigné"}</span>}
        </div>
      </div>
      <ActionsRappel id={rappel.id} objet={rappel.objet} />
    </li>
  );
}

function ChoixVue({ equipe }: { equipe: boolean }) {
  const lien = (actif: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-lg px-4 font-semibold",
      actif ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  return (
    <nav aria-label="Rappels affichés" className="flex gap-1">
      <Link href="/" className={lien(!equipe)} aria-current={!equipe ? "page" : undefined}>
        Mes rappels
      </Link>
      <Link href="/?vue=equipe" className={lien(equipe)} aria-current={equipe ? "page" : undefined}>
        Toute l&apos;équipe
      </Link>
    </nav>
  );
}

export async function PageTaches({ ctx, equipe }: { ctx: Contexte; equipe: boolean }) {
  const v = await casDUsage.obtenirTachesDuJour(ctx, { equipe });
  const fichesVisibles = v.fichesAReverifier.slice(0, FICHES_AFFICHEES);
  const fichesRestantes = v.fichesAReverifier.length - fichesVisibles.length;

  return (
    <Page>
      <EnTetePage
        titre="Mes tâches du jour"
        description={
          <>
            Bonjour {ctx.utilisateur.prenom}, nous sommes le {formaterJour(v.jour)}. {resume(v)}
          </>
        }
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-8">
          <Section
            titre={`Rappels (${v.rappels.length})`}
            actions={v.peutVoirEquipe ? <ChoixVue equipe={v.vueEquipe} /> : undefined}
          >
            <Surface>
              {v.rappels.length === 0 ? (
                <div className="px-5">
                  <EtatVide
                    titre={v.vueEquipe ? "Aucun rappel pour l'équipe aujourd'hui" : "Aucun rappel pour vous aujourd'hui"}
                    description="Les rappels du jour et ceux en retard apparaîtront ici."
                    action={
                      v.peutVoirEquipe && !v.vueEquipe ? (
                        <Link href="/?vue=equipe" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
                          Voir les rappels de toute l&apos;équipe
                        </Link>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {v.rappels.map((r) => (
                    <LigneRappel key={r.id} rappel={r} afficherAssigne={v.vueEquipe} />
                  ))}
                </ul>
              )}
            </Surface>
          </Section>

          {v.inscriptions && v.inscriptions.length > 0 && (
            <Section
              titre={`Inscriptions à valider (${v.inscriptions.length})`}
              actions={<Button nativeButton={false} render={<Link href="/inscriptions" />}>Valider les inscriptions</Button>}
            >
              <Surface>
                <ul className="divide-y">
                  {v.inscriptions.map((i) => (
                    <LigneLien
                      key={i.id}
                      href={`/inscriptions/${i.id}`}
                      titre={i.personnes.join(" et ") || "Inscription en ligne"}
                      detail={`Reçue le ${formaterDate(aujourdhui(i.soumisLe))}`}
                    />
                  ))}
                </ul>
              </Surface>
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-8">
          <Section titre={`Anniversaires (${v.anniversaires.length})`}>
            <Surface>
              {v.anniversaires.length === 0 ? (
                <p className="px-5 py-4 text-muted-foreground">Aucun anniversaire dans les prochains jours.</p>
              ) : (
                <ul className="divide-y">
                  {v.anniversaires.map((a) => (
                    <LigneLien
                      key={a.personne.id}
                      href={lienFiche(a.personne.id)}
                      titre={a.personne.nom}
                      detail={`${a.age} ans ${libelleDans(a.dansJours)}, le ${FORMAT_JOUR_MOIS.format(new Date(`${a.date}T00:00:00Z`))}`}
                      fin={a.rond ? <Pastille ton="accent">{a.age} ans</Pastille> : undefined}
                    />
                  ))}
                </ul>
              )}
            </Surface>
          </Section>

          {v.contactsDus.length > 0 && (
            <Section titre={`Contacts à prévoir (${v.contactsDus.length})`}>
              <Surface>
                <ul className="divide-y">
                  {v.contactsDus.map((c) => (
                    <LigneLien
                      key={c.personne.id}
                      href={lienFiche(c.personne.id)}
                      titre={c.personne.nom}
                      detail={`Un contact tous les ${c.personne.frequenceContactJours} jours · ${
                        c.joursSansContact === null ? "aucun contact enregistré" : `dernier il y a ${c.joursSansContact} jours`
                      }`}
                    />
                  ))}
                </ul>
              </Surface>
            </Section>
          )}

          {v.fichesAReverifier.length > 0 && (
            <Section titre={`Fiches à revérifier (${v.fichesAReverifier.length})`}>
              <Surface>
                <ul className="divide-y">
                  {fichesVisibles.map((f) => (
                    <LigneLien
                      key={f.personne.id}
                      href={lienFiche(f.personne.id)}
                      titre={f.personne.nom}
                      detail={`Dernière vérification le ${formaterDateLongue(f.depuis)}`}
                    />
                  ))}
                </ul>
                {fichesRestantes > 0 && (
                  <Link
                    href={`/beneficiaires?non-verifiee-depuis=${v.verificationMois}`}
                    className="flex min-h-11 items-center justify-between gap-3 border-t px-5 py-3 font-medium text-primary hover:bg-muted"
                  >
                    Voir les {v.fichesAReverifier.length} fiches à revérifier
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </Surface>
            </Section>
          )}
        </div>
      </div>
    </Page>
  );
}
