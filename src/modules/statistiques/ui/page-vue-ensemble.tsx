/**
 * Page d'accueil des statistiques : quelques indicateurs choisis, lisibles d'un coup d'œil.
 * Chaque bloc est une Surface posée sur le fond ; à l'intérieur, uniquement du texte, des barres et des séparateurs.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { aujourdhui, formaterDate, formaterDateLongue } from "@/shared/domain/dates";
import { contexteAvec } from "@/shared/infrastructure/session";
import { EnTetePage, Libelle, Page, PastillePriorite, Surface } from "@/shared/ui/elements";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";
import { casDUsage } from "../infrastructure";
import { SousNavigation } from "./controles";
import { GraphiqueActivite } from "./graphique-activite";

const pourcent = (p: number | null) => (p === null ? "–" : `${p} %`);

function Chiffre({ libelle, valeur, detail, alerte = false }: { libelle: string; valeur: string; detail: string; alerte?: boolean }) {
  return (
    <Surface className="flex flex-col gap-1 p-5">
      <Libelle>{libelle}</Libelle>
      <p className={cn("tabular text-[2.25rem] font-bold leading-tight", alerte && "text-warn")}>{valeur}</p>
      <p className="text-muted-foreground">{detail}</p>
    </Surface>
  );
}

/** Barre de proportion (donnée, pas une boîte) : piste neutre, remplissage en couleur. */
function Barre({ part, couleur = "bg-primary" }: { part: number; couleur?: string }) {
  return (
    <div className="h-2 w-full rounded-lg bg-muted" aria-hidden>
      <div className={cn("h-2 rounded-lg", couleur)} style={{ width: `${Math.max(part, part > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

const COULEUR_NIVEAU: Record<NiveauPriorite, string> = { P1: "bg-err", P2: "bg-warn", P3: "bg-subtle-foreground" };
const LIBELLE_NIVEAU: Record<NiveauPriorite, string> = {
  P1: "Appel humain prioritaire",
  P2: "Priorité moyenne",
  P3: "Priorité faible",
};

function LienFleche({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline">
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

export async function PageVueEnsemble() {
  const ctx = await contexteAvec("statistiques.lire");
  const v = await casDUsage.consulterVueEnsemble(ctx);
  const jour = aujourdhui(ctx.maintenant);
  const maxQuartier = Math.max(1, ...v.quartiers.map((q) => q.total));
  const alerte = v.derniereAlerte;

  return (
    <Page>
      <EnTetePage titre="Statistiques" description={`Vue d'ensemble du registre au ${formaterDateLongue(jour)}.`} />
      <SousNavigation actif="/statistiques" />

      {/* Chiffres clés */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Chiffre
          libelle="Personnes suivies"
          valeur={String(v.population.actifs)}
          detail={`dont ${v.population.inscritsSurPeriode} inscrites ces 12 derniers mois`}
        />
        <Chiffre
          libelle="Priorité 1"
          valeur={String(v.population.p1.valeur)}
          detail={`${pourcent(v.population.p1.part)} du registre, à appeler en premier`}
        />
        <Chiffre
          libelle="Contactées depuis 3 mois"
          valeur={pourcent(v.suivi.contactes90j.part)}
          detail={`${v.suivi.contactes90j.valeur} personnes sur ${v.population.actifs}`}
        />
        <Chiffre
          libelle="Sans contact depuis 6 mois"
          valeur={String(v.suivi.sansContact6Mois)}
          detail="personnes à rappeler pour garder le lien"
          alerte={v.suivi.sansContact6Mois > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Activité */}
        <Surface className="flex flex-col gap-4 p-5 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Contacts des 12 derniers mois</h2>
            <p className="text-muted-foreground">Appels de suivi, appels passés pendant une alerte et visites à domicile.</p>
          </div>
          <div className="min-h-64 flex-1">
            <GraphiqueActivite mois={v.activite} />
          </div>
        </Surface>

        {/* Priorités */}
        <Surface className="flex flex-col gap-5 p-5">
          <h2 className="text-xl font-semibold">Niveaux de priorité</h2>
          <ul className="flex flex-col gap-4">
            {v.niveaux.map((n) => (
              <li key={n.niveau} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <PastillePriorite niveau={n.niveau} />
                    <span className="text-muted-foreground">{LIBELLE_NIVEAU[n.niveau]}</span>
                  </span>
                  <span className="tabular font-semibold">{n.n}</span>
                </div>
                <Barre part={n.part ?? 0} couleur={COULEUR_NIVEAU[n.niveau]} />
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 border-t pt-4">
            <h3 className="font-semibold">Facteurs de fragilité</h3>
            <ul className="flex flex-col gap-3">
              {v.fragilites.map((f) => (
                <li key={f.libelle} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{f.libelle}</span>
                    <span className="tabular shrink-0 whitespace-nowrap text-muted-foreground">
                      <span className="font-semibold text-foreground">{f.n}</span> · {pourcent(f.part)}
                    </span>
                  </div>
                  <Barre part={f.part ?? 0} />
                </li>
              ))}
            </ul>
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Dernière alerte */}
        <Surface className="flex flex-col gap-5 p-5 lg:col-span-2">
          {alerte ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Libelle>Dernière alerte</Libelle>
                  <h2 className="text-xl font-semibold">{alerte.nom}</h2>
                  <p className="text-muted-foreground">
                    Du {formaterDate(alerte.debut)}
                    {alerte.fin ? ` au ${formaterDate(alerte.fin)}` : ""} · {alerte.vagues} jour{alerte.vagues > 1 ? "s" : ""} d&apos;appels ·{" "}
                    {alerte.personnes} personnes
                  </p>
                </div>
                <LienFleche href={`/campagnes/${alerte.campagneId}/rapport`}>Voir le rapport</LienFleche>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 md:grid-cols-4">
                {[
                  { libelle: "Jointes ou couvertes", valeur: pourcent(alerte.tauxJointesOuCouvertes) },
                  { libelle: "Couvertes par un passage", valeur: String(alerte.couvertesParPassage) },
                  { libelle: "Situations signalées", valeur: String(alerte.situationsSignalees) },
                  { libelle: "Appels par l'assistant IA", valeur: pourcent(alerte.tauxIa) },
                ].map((x) => (
                  <div key={x.libelle} className="flex flex-col gap-1">
                    <dt className="text-sm text-muted-foreground">{x.libelle}</dt>
                    <dd className="tabular text-2xl font-bold">{x.valeur}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-auto text-sm text-subtle-foreground">
                Sur l&apos;ensemble des appels prévus pendant l&apos;alerte ({alerte.cibles}, une ligne par personne et par jour).
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Aucune alerte pour l&apos;instant</h2>
              <p className="text-muted-foreground">Le bilan de la dernière alerte apparaîtra ici.</p>
            </div>
          )}
        </Surface>

        {/* Quartiers */}
        <Surface className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Par quartier</h2>
            <p className="text-muted-foreground">Personnes suivies, dont priorité 1.</p>
          </div>
          <ul className="flex flex-col gap-3">
            {v.quartiers.map((q) => (
              <li key={q.nom} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{q.nom}</span>
                  <span className="tabular shrink-0 whitespace-nowrap text-muted-foreground">
                    <span className="font-semibold text-foreground">{q.total}</span>
                    {q.p1 > 0 && <span> · {q.p1} en P1</span>}
                  </span>
                </div>
                <Barre part={(q.total / maxQuartier) * 100} />
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      {/* À surveiller */}
      <Surface className="grid lg:grid-cols-2">
        <section className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Priorité 1 sans contact depuis 2 mois</h2>
            <p className="text-muted-foreground">Les personnes les plus fragiles qu&apos;il faudrait rappeler.</p>
          </div>
          {v.p1SansContact.length === 0 ? (
            <p className="py-2">Toutes les personnes en priorité 1 ont eu un contact récent.</p>
          ) : (
            <ul className="divide-y">
              {v.p1SansContact.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <Link href={`/beneficiaires/${p.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {p.nom}
                  </Link>
                  <span className="text-muted-foreground">
                    {p.joursSansContact === null ? "Jamais contactée" : `${p.joursSansContact} jours`}
                    {p.quartier ? ` · ${p.quartier}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-3 border-t p-5 lg:border-t-0 lg:border-l">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Qualité des données</h2>
            <p className="text-muted-foreground">Ce qui rend une fiche moins fiable le jour d&apos;une crise.</p>
          </div>
          <ul className="divide-y">
            {[
              { libelle: "Fiches non vérifiées depuis 12 mois", n: v.qualite.aReverifier, href: "/beneficiaires" },
              { libelle: "Personnes sans téléphone (visite nécessaire)", n: v.qualite.sansTelephone, href: "/beneficiaires" },
              { libelle: "Adresses à vérifier", n: v.qualite.adresseAVerifier, href: "/beneficiaires" },
              { libelle: "Inscriptions en attente de validation", n: v.qualite.inscriptionsEnAttente, href: "/inscriptions" },
              { libelle: "Rappels en retard", n: v.suivi.rappelsEnRetard, href: "/" },
            ].map((x) => (
              <li key={x.libelle} className="flex items-center justify-between gap-4 py-3">
                <Link href={x.href} className="underline-offset-4 hover:text-primary hover:underline">
                  {x.libelle}
                </Link>
                <span className={cn("tabular text-lg font-semibold", x.n > 0 ? "text-warn" : "text-ok")}>{x.n}</span>
              </li>
            ))}
          </ul>
        </section>
      </Surface>
    </Page>
  );
}
