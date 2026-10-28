"use client";

import "react-grid-layout/css/styles.css";
import "./grille.css";
import { useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EtatVide, Surface } from "@/shared/ui/elements";
import type { DateISO } from "@/shared/domain/dates";
import { SUJET_UNITES } from "../domain/catalogue";
import {
  COLONNES_GRILLE,
  TYPES_WIDGET,
  TYPE_WIDGET_LIBELLES,
  ordreDeLecture,
  widgetCompatible,
  type Disposition,
  type DroitsDashboard,
  type TypeWidget,
} from "../domain/dashboard";
import { clePeriode, periodesProposees } from "../domain/periodes";
import type { DefinitionRequete, Periode } from "../domain/requete";
import { graphiqueAdapte } from "../domain/resultat";
import { formaterEffectif, SEUIL_SECRET } from "../domain/secret";
import type { QuartierCarte } from "../application/ports";
import type { WidgetCalcule } from "../application/dashboards";
import { ajouterWidgetAction, enregistrerDispositionAction, modifierDashboardAction, retirerWidgetAction, supprimerDashboardAction } from "./actions";
import { ListeDeroulante } from "./controles";
import { Graphique } from "./graphique";
import { BoutonCsv, TableauResultat } from "./tableau-resultat";

const Grille = WidthProvider(GridLayout);

/** Glisser-déposer sur grand écran ; en dessous, empilement (1 colonne sur mobile, 2 pour les chiffres sur tablette). */
const requeteMedia = "(min-width: 1024px)";
function useGrandEcran() {
  return useSyncExternalStore(
    (rappel) => {
      const mq = window.matchMedia(requeteMedia);
      mq.addEventListener("change", rappel);
      return () => mq.removeEventListener("change", rappel);
    },
    () => window.matchMedia(requeteMedia).matches,
    () => true,
  );
}

type RequeteSource = { id: string; nom: string; definition: DefinitionRequete };
type DashboardVue = { id: string; nom: string; predefini: boolean; partage: boolean; widgets: WidgetCalcule[] };

export function VueDashboard({
  dashboard,
  droits,
  quartiers,
  requetes,
  periode,
  secret,
  nominatif,
  edition,
  jour,
}: {
  dashboard: DashboardVue;
  droits: DroitsDashboard;
  quartiers: QuartierCarte[];
  requetes: RequeteSource[];
  periode: Periode | null;
  secret: boolean;
  nominatif: boolean;
  edition: boolean;
  jour: DateISO;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const grandEcran = useGrandEcran();
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [enCours, demarrer] = useTransition();
  const proposees = periodesProposees(jour);

  const naviguer = (modifs: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(modifs)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.push(qs ? `${chemin}?${qs}` : chemin, { scroll: false });
  };

  const disposition = (w: WidgetCalcule) => dispositions[w.id] ?? w.layout;
  const layout: Layout[] = dashboard.widgets.map((w) => ({ i: w.id, ...disposition(w), minW: 2, minH: 2 }));

  const enregistrer = () =>
    demarrer(async () => {
      const r = await enregistrerDispositionAction(dashboard.id, Object.fromEntries(dashboard.widgets.map((w) => [w.id, disposition(w)])));
      if (r.ok) {
        toast.success("Disposition enregistrée");
        naviguer({ edition: null });
      } else toast.error(r.erreur);
    });

  const retirer = (widgetId: string) =>
    demarrer(async () => {
      const r = await retirerWidgetAction(dashboard.id, widgetId);
      if (!r.ok) toast.error(r.erreur);
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="flex w-full flex-col gap-1 sm:w-64">
            <label htmlFor="periode-dashboard" className="text-sm font-medium text-muted-foreground">
              Période (activité et évolutions)
            </label>
            <ListeDeroulante
              id="periode-dashboard"
              value={clePeriode(periode, proposees)}
              onChange={(e) => {
                const p = proposees.find((x) => x.cle === e.target.value)?.periode ?? null;
                naviguer({ du: p?.du ?? null, au: p?.au ?? null });
              }}
              options={[
                ...proposees.map((p) => ({ valeur: p.cle, libelle: p.cle === "tout" ? "Celle de chaque widget" : p.libelle })),
                ...(clePeriode(periode, proposees) === "personnalisee" ? [{ valeur: "personnalisee", libelle: "Dates personnalisées" }] : []),
              ]}
            />
          </div>
          <div className="flex min-h-11 items-center gap-3">
            <Switch id="secret-dashboard" checked={secret} disabled={!nominatif} onCheckedChange={(v) => naviguer({ secret: v ? "1" : null })} />
            <label htmlFor="secret-dashboard" className="font-medium">
              Masquer les effectifs inférieurs à {SEUIL_SECRET}
            </label>
          </div>
        </div>
        {droits.modifier && (
          <div className="flex flex-wrap gap-2">
            {edition ? (
              <>
                <AjouterWidget dashboardId={dashboard.id} requetes={requetes} />
                <Button variant="ghost" onClick={() => naviguer({ edition: null })}>
                  Annuler
                </Button>
                <Button onClick={enregistrer} disabled={enCours}>
                  <Check aria-hidden />
                  Enregistrer la disposition
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => naviguer({ edition: "1" })}>
                <Pencil aria-hidden />
                Modifier le tableau de bord
              </Button>
            )}
          </div>
        )}
      </div>

      {edition && !dashboard.predefini && <ReglagesDashboard dashboard={dashboard} droits={droits} />}
      {edition && grandEcran && dashboard.widgets.length > 0 && (
        <p className="text-muted-foreground">Faites glisser les widgets par leur poignée pour les déplacer, et par leur coin inférieur droit pour les redimensionner.</p>
      )}

      {dashboard.widgets.length === 0 ? (
        <Surface className="px-5">
          <EtatVide
            titre="Ce tableau de bord est vide"
            description={droits.modifier ? "Ajoutez des widgets à partir des requêtes enregistrées." : "Son auteur n'y a pas encore ajouté de widget."}
            action={droits.modifier && !edition ? <Button onClick={() => naviguer({ edition: "1" })}>Ajouter des widgets</Button> : undefined}
          />
        </Surface>
      ) : grandEcran ? (
        <Grille
          className="grille-dashboard -mx-2"
          layout={layout}
          cols={COLONNES_GRILLE}
          rowHeight={72}
          margin={[16, 16]}
          containerPadding={[8, 0]}
          isDraggable={edition}
          isResizable={edition}
          draggableHandle=".poignee-widget"
          compactType="vertical"
          onLayoutChange={(l) => {
            if (!edition) return;
            setDispositions(Object.fromEntries(l.map((x) => [x.i, { x: x.x, y: x.y, w: x.w, h: x.h }])));
          }}
        >
          {dashboard.widgets.map((w) => (
            <div key={w.id}>
              <CarteWidget widget={w} quartiers={quartiers} edition={edition} onRetirer={() => retirer(w.id)} />
            </div>
          ))}
        </Grille>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ordreDeLecture(dashboard.widgets).map((w) => (
            <div key={w.id} className={w.type === "chiffre" ? undefined : "sm:col-span-2"} style={{ height: w.type === "chiffre" || w.type === "tableau" ? undefined : 320 }}>
              <CarteWidget widget={w} quartiers={quartiers} edition={edition} onRetirer={() => retirer(w.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Un widget = une Surface posée sur le fond ; à l'intérieur, pas d'autre boîte. */
function CarteWidget({ widget, quartiers, edition, onRetirer }: { widget: WidgetCalcule; quartiers: QuartierCarte[]; edition: boolean; onRetirer: () => void }) {
  const r = widget.resultat;
  const [singulier, pluriel] = SUJET_UNITES[widget.requete.sujet];
  const graphique = widget.type === "chiffre" || widget.type === "tableau" ? null : graphiqueAdapte(r?.decoupage ?? null, r?.lignes.length ?? 0, widget.type);

  return (
    <Surface className="@container flex h-full flex-col" aria-label={widget.titre}>
      <div className="flex items-center gap-1 px-4 pt-2">
        {edition && (
          <span className="poignee-widget -ml-2 flex size-11 shrink-0 cursor-grab items-center justify-center text-muted-foreground" aria-label="Déplacer le widget" role="img">
            <GripVertical className="size-5" aria-hidden />
          </span>
        )}
        <h2 className="line-clamp-2 min-w-0 flex-1 py-2.5 font-semibold leading-snug" title={widget.titre}>
          {widget.titre}
        </h2>
        {r && widget.type !== "chiffre" && !edition && <BoutonCsv titre={widget.titre} resultat={r} compact />}
        {edition && (
          <Button variant="ghost" size="icon" onClick={onRetirer} aria-label={`Retirer le widget « ${widget.titre} »`}>
            <X aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        {!r ? (
          <p className="text-muted-foreground">{widget.erreur ?? "Aucune donnée."}</p>
        ) : widget.type === "chiffre" ? (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular text-4xl font-bold leading-none tracking-tight text-primary @[15rem]:text-5xl">{formaterEffectif(r.total)}</span>
            <span className="text-muted-foreground">{r.total === 1 ? singulier : pluriel}</span>
          </p>
        ) : widget.type === "tableau" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <TableauResultat resultat={r} />
          </div>
        ) : r.lignes.length === 0 ? (
          <p className="text-muted-foreground">Aucune donnée sur la période.</p>
        ) : graphique ? (
          <div className="min-h-0 flex-1">
            <Graphique resultat={r} type={graphique} quartiers={quartiers} />
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

function AjouterWidget({ dashboardId, requetes }: { dashboardId: string; requetes: RequeteSource[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [requeteId, setRequeteId] = useState(requetes[0]?.id ?? "");
  const [type, setType] = useState<TypeWidget>("chiffre");
  const [titre, setTitre] = useState(requetes[0]?.nom ?? "");
  const [enCours, demarrer] = useTransition();
  const source = requetes.find((r) => r.id === requeteId);
  const types = source ? TYPES_WIDGET.filter((t) => widgetCompatible(t, source.definition)) : [];

  const choisirRequete = (id: string) => {
    const r = requetes.find((x) => x.id === id);
    setRequeteId(id);
    setTitre(r?.nom ?? "");
    if (r && !widgetCompatible(type, r.definition)) setType(r.definition.decoupage ? "barres" : "chiffre");
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOuvert(true)}>
        <Plus aria-hidden />
        Ajouter un widget
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Ajouter un widget</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">Un widget affiche le résultat d&apos;une requête enregistrée.</DialogDescription>
          </DialogHeader>
          {requetes.length === 0 ? (
            <p>Aucune requête enregistrée : créez-en une depuis l&apos;explorateur.</p>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!source) return;
                demarrer(async () => {
                  const r = await ajouterWidgetAction(dashboardId, { titre, type, definition: source.definition });
                  if (r.ok) {
                    setOuvert(false);
                    toast.success("Widget ajouté en bas du tableau de bord");
                  } else toast.error(r.erreur);
                });
              }}
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="widget-requete" className="font-medium">
                  Requête
                </label>
                <ListeDeroulante id="widget-requete" value={requeteId} onChange={(e) => choisirRequete(e.target.value)} options={requetes.map((r) => ({ valeur: r.id, libelle: r.nom }))} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="widget-type" className="font-medium">
                  Affichage
                </label>
                <ListeDeroulante
                  id="widget-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as TypeWidget)}
                  options={types.map((t) => ({ valeur: t, libelle: TYPE_WIDGET_LIBELLES[t] }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="widget-titre" className="font-medium">
                  Titre
                </label>
                <Input id="widget-titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={enCours || !titre.trim() || !types.includes(type)}>
                  Ajouter le widget
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReglagesDashboard({ dashboard, droits }: { dashboard: DashboardVue; droits: DroitsDashboard }) {
  const [nom, setNom] = useState(dashboard.nom);
  const [enCours, demarrer] = useTransition();
  const modifier = (champs: { nom?: string; partage?: boolean }) =>
    demarrer(async () => {
      const r = await modifierDashboardAction(dashboard.id, champs);
      if (r.ok) toast.success("Tableau de bord modifié");
      else toast.error(r.erreur);
    });
  return (
    <Surface className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between">
      <form
        className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          modifier({ nom });
        }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="renommer" className="text-sm font-medium text-muted-foreground">
            Nom du tableau de bord
          </label>
          <Input id="renommer" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} />
        </div>
        <Button type="submit" variant="outline" disabled={enCours || !nom.trim() || nom === dashboard.nom}>
          Renommer
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-h-11 items-center gap-3">
          <Switch id="partage" checked={dashboard.partage} onCheckedChange={(v) => modifier({ partage: v })} disabled={enCours} />
          <label htmlFor="partage" className="font-medium">
            Partagé avec l&apos;équipe
          </label>
        </div>
        {droits.supprimer && (
          <Button
            variant="destructive"
            disabled={enCours}
            onClick={() => {
              if (!window.confirm(`Supprimer le tableau de bord « ${dashboard.nom} » ?`)) return;
              demarrer(async () => {
                const r = await supprimerDashboardAction(dashboard.id);
                if (r && !r.ok) toast.error(r.erreur);
              });
            }}
          >
            <Trash2 aria-hidden />
            Supprimer
          </Button>
        )}
      </div>
    </Surface>
  );
}
