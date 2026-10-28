/**
 * Pages du module (Server Components). Les routes de `src/app/(ccas)/statistiques` ne font que les appeler.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { aujourdhui } from "@/shared/domain/dates";
import { peut } from "@/shared/domain/permissions";
import { contexteAvec } from "@/shared/infrastructure/session";
import { EnTetePage, EtatVide, Page, Surface } from "@/shared/ui/elements";
import { formaterDate } from "@/shared/domain/dates";
import { SUJET_LIBELLES } from "../domain/catalogue";
import { definitionVide, decrireFiltres, schemaPeriode } from "../domain/requete";
import { casDUsage } from "../infrastructure";
import { SousNavigation } from "./controles";
import { Explorateur } from "./explorateur";
import { ListeDashboards, NouveauDashboard } from "./liste-dashboards";
import { SupprimerRequete } from "./liste-requetes";
import { VueDashboard } from "./vue-dashboard";

export async function PageExplorateur({ requeteId }: { requeteId?: string }) {
  const ctx = await contexteAvec("statistiques.lire");
  const nominatif = peut(ctx.utilisateur.role, "statistiques.nominatif");
  const [referentiels, quartiers, requete] = await Promise.all([
    casDUsage.obtenirReferentiels(ctx),
    casDUsage.obtenirQuartiers(ctx),
    requeteId && /^[0-9a-f-]{36}$/i.test(requeteId) ? casDUsage.obtenirRequete(ctx, requeteId) : Promise.resolve(null),
  ]);
  const initiale = requete?.definition ?? definitionVide();
  const resultat = await casDUsage.executerRequete(ctx, { definition: initiale, masquerPetitsEffectifs: !nominatif, referentiels });

  return (
    <Page>
      <EnTetePage
        titre="Statistiques"
        description="Comptez, filtrez et découpez les données du registre. Commencez par une question ou par un exemple."
      />
      <SousNavigation actif="/statistiques/explorateur" />
      <Explorateur
        key={requete?.id ?? "nouvelle"}
        initiale={initiale}
        resultatInitial={resultat}
        referentiels={referentiels}
        quartiers={quartiers}
        nominatif={nominatif}
        jour={aujourdhui(ctx.maintenant)}
        titreInitial={requete?.nom}
      />
    </Page>
  );
}

export async function PageRequetes() {
  const ctx = await contexteAvec("statistiques.lire");
  const [requetes, referentiels] = await Promise.all([casDUsage.listerRequetes(ctx), casDUsage.obtenirReferentiels(ctx)]);
  return (
    <Page>
      <EnTetePage titre="Statistiques" description="Les requêtes enregistrées par l'équipe, à rouvrir dans l'explorateur ou à afficher dans un tableau de bord." />
      <SousNavigation actif="/statistiques/requetes" />
      <Surface>
        {requetes.length === 0 ? (
          <div className="px-5">
            <EtatVide titre="Aucune requête enregistrée" description="Dans l'explorateur, composez une requête puis choisissez « Enregistrer la requête »." />
          </div>
        ) : (
          <ul className="divide-y">
            {requetes.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/statistiques/explorateur?requete=${r.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {r.nom}
                  </Link>
                  <p className="text-muted-foreground">
                    {SUJET_LIBELLES[r.definition.sujet]} · {decrireFiltres(r.definition, referentiels)}
                  </p>
                  <p className="text-sm text-subtle-foreground">
                    {r.auteur ? `Par ${r.auteur}, ` : ""}le {formaterDate(aujourdhui(r.creeLe))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/statistiques/explorateur?requete=${r.id}`}
                    className="inline-flex h-11 items-center rounded-lg border border-input bg-card px-4 font-semibold hover:bg-muted"
                  >
                    Ouvrir
                  </Link>
                  <SupprimerRequete id={r.id} nom={r.nom} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </Page>
  );
}

export async function PageDashboards() {
  const ctx = await contexteAvec("statistiques.lire");
  const dashboards = await casDUsage.listerDashboards(ctx);
  return (
    <Page>
      <EnTetePage titre="Statistiques" description="Tableaux de bord partagés avec l'équipe : population suivie, activité, campagnes, qualité des données." actions={<NouveauDashboard />} />
      <SousNavigation actif="/statistiques/tableaux-de-bord" />
      <ListeDashboards
        dashboards={dashboards.map((d) => ({ id: d.id, nom: d.nom, predefini: d.predefini, partage: d.partage, auteur: d.auteur, nbWidgets: d.widgets.length }))}
      />
    </Page>
  );
}

export async function PageDashboard({ id, du, au, secret, edition }: { id: string; du?: string; au?: string; secret: boolean; edition: boolean }) {
  const ctx = await contexteAvec("statistiques.lire");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const nominatif = peut(ctx.utilisateur.role, "statistiques.nominatif");
  const periode = schemaPeriode.safeParse({ du, au });
  let donnees;
  try {
    donnees = await casDUsage.consulterDashboard(ctx, { id, periode: periode.success ? periode.data : null, masquerPetitsEffectifs: secret });
  } catch {
    notFound();
  }
  const [quartiers, requetes] = await Promise.all([casDUsage.obtenirQuartiers(ctx), donnees.droits.modifier ? casDUsage.listerRequetes(ctx) : Promise.resolve([])]);
  const { dashboard, droits } = donnees;

  return (
    <Page>
      <EnTetePage
        retour={
          <Link href="/statistiques/tableaux-de-bord" className="inline-flex min-h-11 items-center gap-2 self-start font-medium text-primary underline-offset-4 hover:underline">
            <ArrowLeft className="size-4" aria-hidden />
            Tous les tableaux de bord
          </Link>
        }
        titre={dashboard.nom}
        description={
          dashboard.predefini
            ? "Tableau de bord livré par défaut, partagé avec toute l'équipe."
            : `${dashboard.partage ? "Partagé avec l'équipe" : "Visible par vous seul"}${dashboard.auteur ? ` · créé par ${dashboard.auteur}` : ""}`
        }
      />
      <VueDashboard
        key={`${dashboard.id}-${edition}`}
        dashboard={dashboard}
        droits={droits}
        quartiers={quartiers}
        requetes={requetes.map((r) => ({ id: r.id, nom: r.nom, definition: r.definition }))}
        periode={periode.success ? periode.data : null}
        secret={secret || !nominatif}
        nominatif={nominatif}
        edition={edition && droits.modifier}
        jour={aujourdhui(ctx.maintenant)}
      />
    </Page>
  );
}
