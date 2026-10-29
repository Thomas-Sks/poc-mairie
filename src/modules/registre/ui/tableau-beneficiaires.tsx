"use client";

/**
 * E8 — Tableau des bénéficiaires : colonnes configurables, tri multi-colonnes, pagination, recherche,
 * filtres combinables, sélection multiple, actions groupées, vue carte et temps réel (polling 2,5 s).
 * Le filtrage, le tri et la pagination sont faits côté serveur (`POST /api/registre/recherche`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Ellipsis,
  List,
  Map as IconeCarte,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formaterDate } from "@/shared/domain/dates";
import { DEPLACEMENT_LIBELLES, MODE_DE_VIE_LIBELLES, SEXE_LIBELLES, STATUT_FICHE_LIBELLES, type StatutFiche, type Ton } from "@/shared/domain/vocabulaire";
import { EtatVide, Pastille, PastillePriorite, Surface } from "@/shared/ui/elements";
import { decrireFiltre, estFiltreVide, FILTRE_VIDE, normaliserFiltre, retirerCritere, serialiserFiltre, type Filtre, type ZoneCarte } from "../domain/filtre";
import {
  adresseCourte,
  colonnesAutorisees,
  colonnesVisiblesParDefaut,
  COLONNES,
  DEFINITIONS_COLONNES,
  TAILLES_PAGE,
  TRI_PAR_DEFAUT,
  type Colonne,
  type ConfigVue,
  type LigneBeneficiaire,
  type ResultatTableau,
  type Tri,
} from "../domain/tableau";
import { poserQuestionAction } from "@/modules/assistant/ui/actions";
import type { ReponseRegistre } from "@/modules/assistant/domain/reponse";
import { ReponseQuestion } from "@/modules/assistant/ui/reponse-question";
import { actionRetirerAssignations, actionToutSelectionner } from "./actions";
import { AppelRapide } from "./appel-rapide";
import { FenetreAssigner, FenetreExport, FenetreListe, FenetreStatut, FenetreTag } from "./fenetres";
import { PanneauFiltres } from "./panneau-filtres";
import { ACTIONS_GROUPEES_EXTERNES } from "./points-extension";
import { IndicateurPresence } from "./presence";
import type { Droits, PointCarte, Referentiels } from "./types";

const CarteLeaflet = dynamic(() => import("./carte-leaflet"), {
  ssr: false,
  loading: () => <div className="h-[60vh] min-h-[22rem]" aria-busy="true" />,
});

const TON_STATUT: Record<StatutFiche, Ton> = { active: "ok", en_attente: "warn", suspendue: "neutre", archivee: "neutre" };

function useEstGrandEcran() {
  return useSyncExternalStore(
    (rappel) => {
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", rappel);
      return () => m.removeEventListener("change", rappel);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

async function post<T>(url: string, corps: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({ erreur: "Erreur" }))).erreur ?? "Erreur");
  return (await r.json()) as T;
}

/** Cycle de tri d'une colonne. Clic : tri sur cette seule colonne ; Maj + clic : ajoute un critère (multi-colonnes). */
function basculerTri(tri: Tri[], colonne: Colonne, multi: boolean): Tri[] {
  const actuel = tri.find((t) => t.colonne === colonne);
  const suivant: Tri | null = !actuel ? { colonne, sens: "asc" } : actuel.sens === "asc" ? { colonne, sens: "desc" } : null;
  if (!multi) return suivant ? [suivant] : [];
  const autres = tri.filter((t) => t.colonne !== colonne);
  if (!suivant) return autres;
  return actuel ? tri.map((t) => (t.colonne === colonne ? suivant : t)) : [...autres, suivant].slice(-4);
}

function Cellule({ ligne, colonne, noms }: { ligne: LigneBeneficiaire; colonne: Colonne; noms: Record<string, string> }) {
  const vide = <span className="text-subtle-foreground">–</span>;
  switch (colonne) {
    case "nom":
      return (
        <Link href={`/beneficiaires/${ligne.id}`} className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">
          {ligne.nom} {ligne.prenom}
        </Link>
      );
    case "age":
      return <span className="tabular">{ligne.age} ans</span>;
    case "priorite":
      return <PastillePriorite niveau={ligne.niveau} score={ligne.score} />;
    case "statut":
      return <Pastille ton={TON_STATUT[ligne.statut]}>{STATUT_FICHE_LIBELLES[ligne.statut]}</Pastille>;
    case "telephone":
      return ligne.telephone || ligne.telephoneMobile ? <span className="tabular">{ligne.telephone ?? ligne.telephoneMobile}</span> : <span className="text-subtle-foreground">Aucun</span>;
    case "adresse":
      return <span>{adresseCourte(ligne)}</span>;
    case "quartier":
      return ligne.quartier ?? vide;
    case "sexe":
      return SEXE_LIBELLES[ligne.sexe];
    case "modeDeVie":
      return ligne.modeDeVie ? MODE_DE_VIE_LIBELLES[ligne.modeDeVie] : vide;
    case "deplacement":
      return ligne.deplacement ? DEPLACEMENT_LIBELLES[ligne.deplacement] : vide;
    case "gir":
      return ligne.gir !== null ? <span className="tabular">GIR {ligne.gir}</span> : vide;
    case "apa":
      return ligne.apa ? "Oui" : "Non";
    case "handicap":
      return ligne.handicap ?? vide;
    case "tags":
      return ligne.tags.length ? <span className="text-[0.9375rem]">{ligne.tags.join(", ")}</span> : vide;
    case "dernierContact":
      return ligne.dernierContact ? <span className="tabular">{formaterDate(ligne.dernierContact.slice(0, 10))}</span> : <span className="text-subtle-foreground">Jamais</span>;
    case "indisponible":
      return ligne.indisponible ? <Pastille ton="warn">Indisponible</Pastille> : vide;
    case "assignes":
      return ligne.assignes.length ? <span>{ligne.assignes.map((id) => noms[id] ?? "?").join(", ")}</span> : vide;
  }
}

/** Liste « Colonnes » : afficher / masquer / réordonner. */
function ChoixColonnes({ colonnes, disponibles, onChange }: { colonnes: Colonne[]; disponibles: Colonne[]; onChange: (c: Colonne[]) => void }) {
  const masquees = disponibles.filter((c) => !colonnes.includes(c));
  const deplacer = (i: number, d: -1 | 1) => {
    const c = [...colonnes];
    [c[i], c[i + d]] = [c[i + d], c[i]];
    onChange(c);
  };
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <Columns3 aria-hidden /> Colonnes
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70dvh] w-80 overflow-y-auto p-3 text-base">
        <PopoverTitle className="px-1 font-semibold">Colonnes affichées</PopoverTitle>
        <ul className="flex flex-col">
          {colonnes.map((c, i) => (
            <li key={c} className="flex items-center gap-1">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 px-1">
                <Checkbox checked disabled={colonnes.length === 1} onCheckedChange={() => onChange(colonnes.filter((x) => x !== c))} />
                {DEFINITIONS_COLONNES[c].libelle}
              </label>
              <Button variant="ghost" size="icon" aria-label={`Monter ${DEFINITIONS_COLONNES[c].libelle}`} disabled={i === 0} onClick={() => deplacer(i, -1)}>
                <ArrowUp aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Descendre ${DEFINITIONS_COLONNES[c].libelle}`} disabled={i === colonnes.length - 1} onClick={() => deplacer(i, 1)}>
                <ArrowDown aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {masquees.length > 0 && (
          <>
            <p className="border-t px-1 pt-3 font-semibold">Colonnes masquées</p>
            <ul className="flex flex-col">
              {masquees.map((c) => (
                <li key={c}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1">
                    <Checkbox checked={false} onCheckedChange={() => onChange([...colonnes, c])} />
                    {DEFINITIONS_COLONNES[c].libelle}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <Button variant="ghost" className="self-start" onClick={() => onChange(colonnesAutorisees(colonnesVisiblesParDefaut(), true).filter((c) => disponibles.includes(c)))}>
          Rétablir les colonnes par défaut
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Bascule({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-2 px-4 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
        actif ? "bg-accent text-primary" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Défilement horizontal du tableau quand il a trop de colonnes : savoir s'il reste des colonnes cachées
 * à gauche ou à droite, et les faire apparaître avec des boutons (souris, Mac sans barre visible, tablette).
 */
function useDefilementHorizontal(dependances: unknown[]) {
  const zone = useRef<HTMLDivElement>(null);
  const [cote, setCote] = useState({ gauche: false, droite: false });
  const mesurer = useCallback(() => {
    const el = zone.current;
    if (!el) return;
    setCote({ gauche: el.scrollLeft > 4, droite: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    el.addEventListener("scroll", mesurer, { passive: true });
    return () => {
      observateur.disconnect();
      el.removeEventListener("scroll", mesurer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesurer, ...dependances]);
  const defiler = (sens: -1 | 1) => zone.current?.scrollBy({ left: sens * zone.current.clientWidth * 0.6 });
  return { zone, ...cote, defiler };
}

type Fenetres = "assigner" | "tag" | "statut" | "export" | "liste" | `externe:${string}` | null;

export function TableauBeneficiaires({
  referentiels,
  droits,
  listeId,
  ressource,
  configInitiale,
  questionInitiale,
}: {
  referentiels: Referentiels;
  droits: Droits;
  /** Consultation d'une liste enregistrée : son filtre (ou ses ids) s'ajoute au filtre saisi. */
  listeId?: string;
  /** Ressource de présence (ex. `beneficiaires`, `liste:<id>`). */
  ressource: string;
  configInitiale?: Partial<ConfigVue>;
  /** Question posée depuis un lien (`/beneficiaires?q=…`). */
  questionInitiale?: string;
}) {
  const client = useQueryClient();
  const grandEcran = useEstGrandEcran();
  const disponibles = useMemo(() => colonnesAutorisees(COLONNES, droits.sante), [droits.sante]);

  const [filtre, setFiltreBrut] = useState<Filtre>(configInitiale?.filtre ?? FILTRE_VIDE);
  const [tri, setTri] = useState<Tri[]>(configInitiale?.tri ?? TRI_PAR_DEFAUT);
  const [colonnes, setColonnes] = useState<Colonne[]>(() => colonnesAutorisees(configInitiale?.colonnes ?? colonnesVisiblesParDefaut(), droits.sante));
  const [page, setPage] = useState(0);
  const [taillePage, setTaillePage] = useState<number>(50);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [mode, setMode] = useState<"tableau" | "carte">("tableau");
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const [fenetre, setFenetre] = useState<Fenetres>(null);
  const [question, setQuestion] = useState(questionInitiale ?? "");
  const [reponse, setReponse] = useState<ReponseRegistre | null>(null);
  const [enQuestion, demarrerQuestion] = useTransition();
  const [enCours, demarrer] = useTransition();

  const setFiltre = (f: Filtre) => {
    setFiltreBrut(normaliserFiltre(f));
    setPage(0);
    setSelection({});
  };

  /**
   * Une seule zone de saisie : la question est confiée à l'assistant. Une réponse sur des personnes filtre le tableau
   * et la carte ; un nom ou une adresse devient une simple recherche ; un chiffre s'affiche au-dessus du tableau.
   */
  const poser = (texte: string) => {
    const q = texte.trim();
    setQuestion(q);
    if (!q) {
      setReponse(null);
      setFiltre(FILTRE_VIDE);
      return;
    }
    demarrerQuestion(async () => {
      const r = await poserQuestionAction(q);
      if (!r.ok) return void toast.error(r.erreur);
      const rep = r.reponse;
      if (rep.type === "recherche") setFiltre({ ...FILTRE_VIDE, recherche: rep.texte });
      else if (rep.type === "personnes") setFiltre({ ...FILTRE_VIDE, ids: rep.ids, question: q });
      setReponse(rep.type === "recherche" ? null : rep);
    });
  };

  useEffect(() => {
    if (questionInitiale) poser(questionInitiale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleFiltre = serialiserFiltre(filtre);
  const requete = { filtre, listeId, tri, page, taillePage };
  const { data, isError, isPending } = useQuery({
    queryKey: ["registre", "tableau", listeId ?? null, cleFiltre, tri, page, taillePage],
    queryFn: () => post<ResultatTableau>("/api/registre/recherche", requete),
    refetchInterval: 2500, // E8-US7 : statuts et assignations à jour chez tous les utilisateurs
    placeholderData: keepPreviousData,
  });
  const { data: points = [] } = useQuery({
    queryKey: ["registre", "carte", listeId ?? null, cleFiltre],
    queryFn: () => post<PointCarte[]>("/api/registre/carte", { filtre, listeId }),
    enabled: mode === "carte",
    refetchInterval: mode === "carte" ? 2500 : false,
    placeholderData: keepPreviousData,
  });

  const lignes = useMemo(() => data?.lignes ?? [], [data]);
  const defilement = useDefilementHorizontal([colonnes, lignes, mode]);
  const total = data?.total ?? 0;
  const noms = useMemo(() => Object.fromEntries(referentiels.equipe.map((m) => [m.id, m.prenom])), [referentiels.equipe]);
  const nomsComplets = useMemo(() => Object.fromEntries(referentiels.equipe.map((m) => [m.id, `${m.prenom} ${m.nom}`])), [referentiels.equipe]);
  const idsSelectionnes = Object.keys(selection).filter((k) => selection[k]);
  const puces = decrireFiltre(filtre, { utilisateurs: nomsComplets });
  const nbCriteresPanneau = puces.filter((p) => p.cle !== "recherche" && p.cle !== "zone").length;

  const colonnesTable = useMemo<ColumnDef<LigneBeneficiaire>[]>(
    () => [
      ...(droits.ecrire
        ? [
            {
              id: "selection",
              header: ({ table }) => (
                <Checkbox
                  aria-label="Sélectionner toute la page"
                  checked={table.getIsAllPageRowsSelected()}
                  indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                  onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
                />
              ),
              cell: ({ row }) => (
                <Checkbox aria-label={`Sélectionner ${row.original.nom} ${row.original.prenom}`} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} />
              ),
            } satisfies ColumnDef<LigneBeneficiaire>,
          ]
        : []),
      ...COLONNES.map(
        (c): ColumnDef<LigneBeneficiaire> => ({
          id: c,
          header: DEFINITIONS_COLONNES[c].libelle,
          cell: ({ row }) => <Cellule ligne={row.original} colonne={c} noms={noms} />,
        }),
      ),
      ...(droits.ecrire ? [{ id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <AppelRapide ligne={row.original} /> } satisfies ColumnDef<LigneBeneficiaire>] : []),
    ],
    [droits.ecrire, noms],
  );

  // TanStack Table n'est pas mémoïsable par le React Compiler : le composant est simplement ignoré par celui-ci.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: lignes,
    columns: colonnesTable,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (l) => l.id,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: total,
    enableRowSelection: droits.ecrire,
    state: {
      rowSelection: selection,
      columnOrder: ["selection", ...colonnes, "actions"],
      columnVisibility: Object.fromEntries(COLONNES.map((c) => [c, colonnes.includes(c)])),
      pagination: { pageIndex: page, pageSize: taillePage },
    },
    onRowSelectionChange: setSelection,
  });

  const toutSelectionner = () =>
    demarrer(async () => {
      const r = await actionToutSelectionner({ filtre, listeId });
      if (!r.ok) return void toast.error(r.erreur);
      setSelection(Object.fromEntries(r.valeur.map((id) => [id, true])));
    });

  const retirerAssignations = () =>
    demarrer(async () => {
      const r = await actionRetirerAssignations({ ids: idsSelectionnes });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success("Assignations retirées");
      void client.invalidateQueries({ queryKey: ["registre"] });
    });

  const changerZone = (zone: ZoneCarte | undefined) => setFiltre({ ...filtre, zone });

  const panneau = <PanneauFiltres filtre={filtre} onChange={setFiltre} referentiels={referentiels} accesSante={droits.sante} />;
  const debut = total === 0 ? 0 : page * taillePage + 1;
  const fin = Math.min(total, (page + 1) * taillePage);
  const nbPages = Math.max(1, Math.ceil(total / taillePage));
  const pageEntiereSelectionnee = lignes.length > 0 && lignes.every((l) => selection[l.id]);

  return (
    <div className="flex flex-col gap-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex min-w-0 flex-1 basis-80 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            poser(question);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-subtle-foreground" aria-hidden />
            <label htmlFor="question-registre" className="sr-only">
              Posez une question ou cherchez un nom
            </label>
            <Input
              id="question-registre"
              type="search"
              className="h-12 pl-10 text-lg"
              placeholder="Ex. Personnes P1 qui vivent seules, ou un nom"
              value={question}
              maxLength={300}
              autoComplete="off"
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12" disabled={enQuestion}>
            Demander
          </Button>
        </form>
        <Button
          variant="outline"
          aria-expanded={grandEcran ? panneauOuvert : undefined}
          className={cn(panneauOuvert && grandEcran && "border-primary bg-accent text-primary")}
          onClick={() => setPanneauOuvert((o) => !o)}
        >
          <SlidersHorizontal aria-hidden /> Filtres
          {nbCriteresPanneau > 0 && <span className="tabular rounded-full bg-primary px-2 text-sm text-primary-foreground">{nbCriteresPanneau}</span>}
        </Button>
        <div role="group" aria-label="Affichage" className="flex overflow-hidden rounded-lg border border-input">
          <Bascule actif={mode === "tableau"} onClick={() => setMode("tableau")}>
            <List aria-hidden /> Tableau
          </Bascule>
          <Bascule actif={mode === "carte"} onClick={() => setMode("carte")}>
            <IconeCarte aria-hidden /> Carte
          </Bascule>
        </div>
      </div>

      {enQuestion && <p className="text-muted-foreground">Je cherche…</p>}
      {!enQuestion && reponse && <ReponseQuestion reponse={reponse} poser={poser} />}

      {/* Puces des filtres actifs */}
      {puces.length > 0 && (
        <ul aria-label="Filtres actifs" className="flex flex-wrap items-center gap-2">
          {puces.map((p) => (
            <li key={p.cle}>
              <button
                type="button"
                onClick={() => {
                  if (p.cle === "recherche" || p.cle === "ids") {
                    setQuestion("");
                    setReponse(null);
                  }
                  setFiltre(retirerCritere(filtre, p.cle));
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/30 bg-accent px-3 font-medium text-primary outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Retirer le filtre : ${p.libelle}`}
              >
                {p.libelle}
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <Button
              variant="ghost"
              onClick={() => {
                setQuestion("");
                setReponse(null);
                setFiltre(FILTRE_VIDE);
              }}
            >
              Tout effacer
            </Button>
          </li>
        </ul>
      )}

      <div className="flex items-start gap-6">
        {panneauOuvert && grandEcran && (
          <Surface aria-label="Filtres" className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-80 shrink-0 flex-col gap-4 overflow-y-auto p-5 lg:flex">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Filtres</h2>
              <Button variant="ghost" size="icon" aria-label="Fermer les filtres" onClick={() => setPanneauOuvert(false)}>
                <X aria-hidden />
              </Button>
            </div>
            {panneau}
          </Surface>
        )}
        {!grandEcran && (
          <Sheet open={panneauOuvert} onOpenChange={setPanneauOuvert}>
            <SheetContent side="right" className="w-full max-w-md gap-0 overflow-y-auto text-base data-[side=right]:sm:max-w-md">
              <SheetHeader className="border-b p-5">
                <SheetTitle className="text-xl font-semibold">Filtres</SheetTitle>
              </SheetHeader>
              <div className="p-5">{panneau}</div>
              <div className="sticky bottom-0 mt-auto border-t bg-card p-4">
                <Button className="w-full" onClick={() => setPanneauOuvert(false)}>
                  Voir {total} personne{total > 1 ? "s" : ""}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}

        <Surface className="min-w-0 flex-1">
          {/* En-tête : nombre de résultats, sélection et actions */}
          <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
            {idsSelectionnes.length === 0 ? (
              <>
                <p className="font-semibold" aria-live="polite">
                  {isPending ? "Chargement…" : `${total} personne${total > 1 ? "s" : ""}`}
                </p>
                <IndicateurPresence ressource={ressource} />
                <div className="ml-auto flex flex-wrap gap-2">
                  {mode === "tableau" && (defilement.gauche || defilement.droite) && (
                    <div role="group" aria-label="Voir les autres colonnes" className="flex gap-1 max-md:hidden">
                      <Button variant="outline" size="icon" aria-label="Colonnes de gauche" disabled={!defilement.gauche} onClick={() => defilement.defiler(-1)}>
                        <ChevronLeft aria-hidden />
                      </Button>
                      <Button variant="outline" size="icon" aria-label="Colonnes de droite" disabled={!defilement.droite} onClick={() => defilement.defiler(1)}>
                        <ChevronRight aria-hidden />
                      </Button>
                    </div>
                  )}
                  {mode === "tableau" && (
                    <div className="max-md:hidden">
                      <ChoixColonnes colonnes={colonnes} disponibles={disponibles} onChange={setColonnes} />
                    </div>
                  )}
                  {droits.ecrire && (
                    <Button variant="outline" disabled={total === 0} onClick={() => setFenetre("liste")}>
                      Enregistrer la liste
                    </Button>
                  )}
                  {droits.exporter && (
                    <Button variant="ghost" disabled={total === 0} onClick={() => setFenetre("export")}>
                      Exporter
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold" aria-live="polite">
                  {idsSelectionnes.length} sélectionnée{idsSelectionnes.length > 1 ? "s" : ""}
                </p>
                {pageEntiereSelectionnee && idsSelectionnes.length < total && (
                  <Button variant="link" className="px-0" disabled={enCours} onClick={toutSelectionner}>
                    Sélectionner les {total} résultats
                  </Button>
                )}
                <Button variant="link" className="px-0 text-muted-foreground" onClick={() => setSelection({})}>
                  Désélectionner
                </Button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setFenetre("assigner")}>
                    <Users aria-hidden /> Assigner
                  </Button>
                  {ACTIONS_GROUPEES_EXTERNES.map((a) => (
                    <Button key={a.id} variant="outline" className="max-sm:hidden" onClick={() => setFenetre(`externe:${a.id}`)}>
                      <a.icone aria-hidden /> {a.libelle}
                    </Button>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" aria-label="Autres actions" />}>
                      <Ellipsis aria-hidden /> <span className="max-sm:sr-only">Autres actions</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 text-base">
                      {ACTIONS_GROUPEES_EXTERNES.map((a) => (
                        <DropdownMenuItem key={a.id} className="min-h-11 text-base sm:hidden" onClick={() => setFenetre(`externe:${a.id}`)}>
                          {a.libelle}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem className="min-h-11 text-base" onClick={() => setFenetre("tag")}>
                        Ajouter un tag
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11 text-base" onClick={() => setFenetre("statut")}>
                        Changer le statut
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11 text-base" onClick={retirerAssignations}>
                        Retirer les assignations
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11 text-base" onClick={() => setFenetre("liste")}>
                        Enregistrer comme liste
                      </DropdownMenuItem>
                      {droits.exporter && (
                        <DropdownMenuItem className="min-h-11 text-base" onClick={() => setFenetre("export")}>
                          Exporter en CSV
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>

          {isError && <p className="px-4 py-6 text-err">Impossible de charger les bénéficiaires. Nouvel essai automatique dans quelques secondes.</p>}

          {mode === "carte" ? (
            <CarteLeaflet points={points} cleFiltre={cleFiltre} zone={filtre.zone} onZone={changerZone} />
          ) : !isPending && lignes.length === 0 ? (
            <div className="px-4">
              <EtatVide
                titre="Aucune personne ne correspond"
                description={estFiltreVide(filtre) ? "Le registre est vide." : "Retirez un ou plusieurs filtres pour élargir la recherche."}
              />
            </div>
          ) : (
            <>
              {/* Desktop et tablette : tableau */}
              <div
                ref={defilement.zone}
                tabIndex={0}
                role="region"
                aria-label="Tableau des bénéficiaires (défilement avec les flèches du clavier)"
                className="relative max-h-[calc(100dvh-12rem)] overflow-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:hidden"
              >
                <table className="w-full text-left">
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b">
                        {hg.headers.map((h) => {
                          const c = h.column.id as Colonne;
                          const triable = c in DEFINITIONS_COLONNES && DEFINITIONS_COLONNES[c].triable;
                          const rang = tri.findIndex((t) => t.colonne === c);
                          const t = tri[rang];
                          return (
                            <th
                              key={h.id}
                              scope="col"
                              aria-sort={t ? (t.sens === "asc" ? "ascending" : "descending") : undefined}
                              className={cn(
                                "sticky top-0 z-20 h-12 bg-card px-2.5 text-sm font-semibold whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]",
                                h.column.id === "selection" && "left-0 z-30 w-12 min-w-12 pl-4",
                                h.column.id === "nom" && cn("z-30 shadow-[inset_-1px_-1px_0_var(--border)]", droits.ecrire ? "left-12" : "left-0"),
                                h.column.id === "actions" && "w-14",
                              )}
                            >
                              {triable ? (
                                <button
                                  type="button"
                                  title="Cliquer pour trier. Maj + clic pour trier aussi sur cette colonne."
                                  onClick={(e) => {
                                    setTri(basculerTri(tri, c, e.shiftKey));
                                    setPage(0);
                                  }}
                                  className={cn("-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:bg-muted hover:text-foreground", t && "text-primary")}
                                >
                                  {flexRender(h.column.columnDef.header, h.getContext())}
                                  {t ? t.sens === "asc" ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden /> : <ArrowUpDown className="size-4 opacity-40" aria-hidden />}
                                  {t && tri.length > 1 && <span className="tabular text-xs">{rang + 1}</span>}
                                </button>
                              ) : (
                                flexRender(h.column.columnDef.header, h.getContext())
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className={cn("group hover:bg-background", row.getIsSelected() && "bg-accent/60 hover:bg-accent")}>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn(
                              "h-14 px-2.5 py-2 align-middle",
                              cell.column.id === "adresse" ? "min-w-40 max-w-60" : ["tags", "assignes", "handicap"].includes(cell.column.id) ? "min-w-24 max-w-52" : "whitespace-nowrap",
                              cell.column.id === "selection" && "pl-4",
                              cell.column.id === "actions" && "pr-2 text-right",
                              // La case à cocher et le nom restent visibles quand on fait défiler les colonnes.
                              (cell.column.id === "selection" || cell.column.id === "nom") &&
                                cn("sticky z-10", row.getIsSelected() ? "bg-accent" : "bg-card group-hover:bg-background"),
                              cell.column.id === "selection" && "left-0 w-12 min-w-12",
                              cell.column.id === "nom" && cn("shadow-[inset_-1px_0_0_var(--border)]", droits.ecrire ? "left-12" : "left-0"),
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile : liste simple (nom, âge, priorité, rue) */}
              <ul className="divide-y md:hidden">
                {lignes.map((l) => (
                  <li key={l.id} className={cn("flex items-center gap-3 px-4 py-2", selection[l.id] && "bg-accent/60")}>
                    {droits.ecrire && (
                      <Checkbox
                        aria-label={`Sélectionner ${l.nom} ${l.prenom}`}
                        checked={Boolean(selection[l.id])}
                        onCheckedChange={(v) => setSelection((s) => ({ ...s, [l.id]: Boolean(v) }))}
                      />
                    )}
                    <Link href={`/beneficiaires/${l.id}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center">
                      <span className="truncate font-semibold">
                        {l.nom} {l.prenom}
                      </span>
                      <span className="truncate text-[0.9375rem] text-muted-foreground">
                        {l.age} ans · {adresseCourte(l)}
                      </span>
                    </Link>
                    <PastillePriorite niveau={l.niveau} />
                    {droits.ecrire && <AppelRapide ligne={l} />}
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="tabular text-muted-foreground">
                  {debut}–{fin} sur {total}
                </p>
                <div className="flex items-center gap-2">
                  <label htmlFor="taille-page" className="text-muted-foreground max-sm:sr-only">
                    Par page
                  </label>
                  <select
                    id="taille-page"
                    value={taillePage}
                    onChange={(e) => {
                      setTaillePage(Number(e.target.value));
                      setPage(0);
                    }}
                    className="h-11 rounded-lg border border-input bg-card px-2 text-base"
                  >
                    {TAILLES_PAGE.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" size="icon" aria-label="Page précédente" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft aria-hidden />
                  </Button>
                  <span className="tabular px-1">
                    {page + 1} / {nbPages}
                  </span>
                  <Button variant="outline" size="icon" aria-label="Page suivante" disabled={page + 1 >= nbPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Surface>
      </div>

      {/* Fenêtres (montées à l'ouverture pour repartir d'un état neuf) */}
      {fenetre === "assigner" && (
        <FenetreAssigner ids={idsSelectionnes} equipe={referentiels.equipe} ouvert fermer={() => setFenetre(null)} onTermine={() => setSelection({})} />
      )}
      {fenetre === "tag" && <FenetreTag ids={idsSelectionnes} tags={referentiels.tags} ouvert fermer={() => setFenetre(null)} />}
      {fenetre === "statut" && <FenetreStatut ids={idsSelectionnes} peutArchiver={droits.archiver} ouvert fermer={() => setFenetre(null)} />}
      {fenetre === "export" && (
        <FenetreExport ids={idsSelectionnes} total={total} filtre={filtre} listeId={listeId} colonnesVisibles={colonnes} accesSante={droits.sante} ouvert fermer={() => setFenetre(null)} />
      )}
      {fenetre === "liste" && <FenetreListe ids={idsSelectionnes} total={total} filtre={filtre} listeId={listeId} ouvert fermer={() => setFenetre(null)} />}
      {ACTIONS_GROUPEES_EXTERNES.map((a) =>
        fenetre === `externe:${a.id}` ? <a.Fenetre key={a.id} ids={idsSelectionnes} filtre={filtre} listeId={listeId} ouvert fermer={() => setFenetre(null)} /> : null,
      )}
    </div>
  );
}
