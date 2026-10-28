"use client";

/**
 * E15-US1 — Assistant d'import Excel en 5 étapes. Le fichier est lu dans le navigateur (SheetJS) ;
 * seules les lignes brutes et la correspondance choisie sont envoyées au serveur.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bandeau, Pastille, Surface } from "@/shared/ui/elements";
import { formaterDateHeure } from "@/shared/domain/dates";
import {
  correspondanceValeursInitiale,
  rapportRejetsCsv,
  valeursAMapper,
  type CorrespondanceValeurs,
  type LigneAnalysee,
} from "../domain/analyse";
import {
  CHAMPS_IMPORT,
  cleEntete,
  DEFINITIONS,
  detecterLigneEntete,
  suggererCorrespondance,
  type ChampImport,
  type Destination,
} from "../domain/champs";
import type { MappingSauvegarde } from "../application/ports";
import { importerFichesAction, previsualiserImportAction, trouverMappingAction } from "./actions";

const ETAPES = ["Fichier", "Colonnes", "Valeurs", "Aperçu", "Import"] as const;
const GROUPES = ["Identité", "Coordonnées", "Adresse", "Situation", "Personne à prévenir"] as const;
const classeSelect = "h-10 w-full rounded-lg border border-input bg-card px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

type Classeur = { nom: string; feuilles: Record<string, string[][]>; onglets: string[] };

function lireFeuille(ws: XLSX.WorkSheet): string[][] {
  const lignes = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", dateNF: "dd/mm/yyyy", blankrows: true });
  return lignes.map((l) => l.map((c) => String(c ?? "").trim()));
}

function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

const nomFiche = (l: LigneAnalysee) => (l.fiche ? `${l.fiche.civilite} ${l.fiche.prenom} ${l.fiche.nom}` : null);

export function AssistantImport() {
  const [etape, setEtape] = useState(0);
  const [classeur, setClasseur] = useState<Classeur | null>(null);
  const [onglet, setOnglet] = useState("");
  const [ligneEntete, setLigneEntete] = useState(0);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [mappingReconnu, setMappingReconnu] = useState<MappingSauvegarde | null>(null);
  const [valeurs, setValeurs] = useState<CorrespondanceValeurs>({});
  const [analyse, setAnalyse] = useState<LigneAnalysee[] | null>(null);
  const [statut, setStatut] = useState<"active" | "en_attente">("active");
  const [resultat, setResultat] = useState<{ foyers: number; fiches: number; rejets: LigneAnalysee[] } | null>(null);
  const [enCours, demarrer] = useTransition();

  const lignes = useMemo(() => (classeur && onglet ? classeur.feuilles[onglet] : []), [classeur, onglet]);
  const entetes = useMemo(() => (lignes[ligneEntete] ?? []).map((h, i) => h || `Colonne ${i + 1}`), [lignes, ligneEntete]);
  const donnees = useMemo(() => lignes.slice(ligneEntete + 1), [lignes, ligneEntete]);
  const aMapper = useMemo(() => valeursAMapper(donnees, destinations), [donnees, destinations]);

  const entree = () => ({ entetes, lignes: donnees.map((l) => entetes.map((_, i) => l[i] ?? "")), premiereLigne: ligneEntete + 2, destinations, valeurs });

  // ── Étape 1 : fichier ──
  const charger = async (fichier: File) => {
    try {
      const csv = /\.(csv|txt)$/i.test(fichier.name);
      const wb = XLSX.read(await fichier.arrayBuffer(), { raw: csv });
      const feuilles = Object.fromEntries(wb.SheetNames.map((n) => [n, lireFeuille(wb.Sheets[n])]));
      const premier = wb.SheetNames.find((n) => feuilles[n].some((l) => l.some(Boolean))) ?? wb.SheetNames[0];
      setClasseur({ nom: fichier.name, feuilles, onglets: wb.SheetNames });
      choisirOnglet(premier, feuilles);
      setAnalyse(null);
      setResultat(null);
    } catch {
      toast.error("Ce fichier n'a pas pu être lu. Utilisez un fichier Excel (.xlsx, .xls) ou CSV.");
    }
  };

  const choisirOnglet = (nom: string, feuilles = classeur?.feuilles ?? {}) => {
    setOnglet(nom);
    setLigneEntete(detecterLigneEntete(feuilles[nom] ?? []));
  };

  const versColonnes = () =>
    demarrer(async () => {
      const r = await trouverMappingAction(entetes);
      const sauvegarde = r.ok ? r.donnees : null;
      setMappingReconnu(sauvegarde);
      setDestinations(sauvegarde ? entetes.map((h) => sauvegarde.colonnes[cleEntete(h)] ?? "ignorer") : suggererCorrespondance(entetes));
      setEtape(1);
    });

  // ── Étape 2 : colonnes ──
  const champs = new Set(destinations);
  const manquants = [
    !champs.has("civilite") && "Civilité",
    !champs.has("nom") && !champs.has("nomPrenom") && "Nom",
    !champs.has("prenom") && !champs.has("nomPrenom") && "Prénom",
    !champs.has("dateNaissance") && "Date de naissance",
    !champs.has("adresse") && !champs.has("voie") && "Adresse ou rue",
  ].filter((x): x is string => Boolean(x));
  const doublesChamps = CHAMPS_IMPORT.filter((c) => destinations.filter((d) => d === c).length > 1);

  const versValeurs = () => {
    setValeurs(correspondanceValeursInitiale(valeursAMapper(donnees, destinations), mappingReconnu?.valeurs));
    setEtape(2);
  };

  // ── Étape 4 : aperçu ──
  const versApercu = () =>
    demarrer(async () => {
      const r = await previsualiserImportAction(entree());
      if (!r.ok) return void toast.error(r.message);
      setAnalyse(r.donnees);
      setEtape(3);
    });

  const importer = () =>
    demarrer(async () => {
      const r = await importerFichesAction({ ...entree(), statut, nomFichier: classeur?.nom ?? "fichier" });
      if (!r.ok) return void toast.error(r.message);
      setResultat(r.donnees);
      setEtape(4);
    });

  const rejets = analyse?.filter((l) => l.erreurs.length > 0) ?? [];
  const valides = analyse?.filter((l) => l.fiche) ?? [];
  const nomRapport = `rejets-${(classeur?.nom ?? "import").replace(/\.[^.]+$/, "")}.csv`;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Étapes de l'import">
        <ol className="flex flex-wrap gap-x-6 gap-y-2">
          {ETAPES.map((e, i) => (
            <li key={e} aria-current={i === etape ? "step" : undefined} className={cn("flex items-center gap-2 font-semibold", i === etape ? "text-primary" : i < etape ? "text-foreground" : "text-subtle-foreground")}>
              <span className={cn("flex size-7 items-center justify-center rounded-full text-sm tabular", i === etape ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
              {e}
            </li>
          ))}
        </ol>
      </nav>

      {etape === 0 && (
        <Surface className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">1. Déposez votre fichier</h2>
            <p className="text-muted-foreground">Fichier Excel (.xlsx, .xls) ou CSV. Il est lu sur votre ordinateur : rien n&apos;est enregistré avant la dernière étape.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className={cn(buttonVariants({ variant: classeur ? "outline" : "default" }), "cursor-pointer has-focus-visible:ring-3 has-focus-visible:ring-ring/50")}>
              <Upload aria-hidden />
              {classeur ? "Choisir un autre fichier" : "Choisir un fichier"}
              <input type="file" accept=".xlsx,.xls,.csv,.ods" className="sr-only" onChange={(e) => e.target.files?.[0] && charger(e.target.files[0])} />
            </label>
            {classeur && (
              <span className="flex items-center gap-2 font-medium">
                <FileSpreadsheet className="size-5 text-primary" aria-hidden />
                {classeur.nom}
              </span>
            )}
          </div>

          {classeur && (
            <>
              <div className="grid gap-4 border-t pt-6 sm:grid-cols-2 lg:max-w-2xl">
                <div className="flex flex-col gap-2">
                  <label htmlFor="onglet" className="font-semibold">Onglet</label>
                  <select id="onglet" value={onglet} onChange={(e) => choisirOnglet(e.target.value)} className={cn(classeSelect, "h-11")}>
                    {classeur.onglets.map((o) => (
                      <option key={o} value={o}>
                        {o} ({classeur.feuilles[o].filter((l) => l.some(Boolean)).length} lignes)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="ligne-entete" className="font-semibold">Ligne des en-têtes de colonnes</label>
                  <input
                    id="ligne-entete"
                    type="number"
                    min={1}
                    max={Math.max(1, lignes.length)}
                    value={ligneEntete + 1}
                    onChange={(e) => setLigneEntete(Math.max(0, Math.min(lignes.length - 1, Number(e.target.value) - 1)))}
                    className={cn(classeSelect, "h-11 px-3")}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Début de l&apos;onglet. La ligne des en-têtes est surlignée ; cliquez sur une autre ligne pour la choisir.</p>
                <div className="relative overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {lignes.slice(0, 10).map((l, i) => (
                        <tr key={i} onClick={() => setLigneEntete(i)} className={cn("cursor-pointer", i === ligneEntete ? "bg-accent font-semibold text-primary" : i < ligneEntete ? "text-subtle-foreground" : "hover:bg-muted")}>
                          <th scope="row" className="w-10 border-r bg-muted px-2 py-1.5 text-right font-normal text-muted-foreground tabular">{i + 1}</th>
                          {l.slice(0, 12).map((c, j) => (
                            <td key={j} className="max-w-48 truncate px-2 py-1.5">{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end border-t pt-6">
            <Button disabled={!classeur || entetes.length === 0 || enCours} onClick={versColonnes}>
              Continuer
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </Surface>
      )}

      {etape === 1 && (
        <>
          {mappingReconnu && (
            <Bandeau ton="ok">
              Format reconnu : la correspondance enregistrée lors de l&apos;import de « {mappingReconnu.nom} » ({formaterDateHeure(new Date(mappingReconnu.misAJourLe))}) a été appliquée.
            </Bandeau>
          )}
          {manquants.length > 0 && <Bandeau ton="warn">Associez une colonne aux champs obligatoires : {manquants.join(", ")}.</Bandeau>}
          {doublesChamps.length > 0 && <Bandeau ton="warn">Un même champ est choisi pour plusieurs colonnes : {doublesChamps.map((c) => DEFINITIONS[c].libelle).join(", ")}.</Bandeau>}
          <Surface className="flex flex-col">
            <div className="flex flex-col gap-1 p-6 pb-4">
              <h2 className="text-xl font-semibold">2. Faites correspondre les colonnes</h2>
              <p className="text-muted-foreground">
                Les correspondances sont proposées d&apos;après le nom des colonnes. Une colonne utile mais sans champ prévu (« Observations ») peut être importée comme note sur la fiche.
              </p>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left">
                <thead className="border-y text-sm text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-6 py-2.5 font-semibold">Colonne du fichier</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Exemples de valeurs</th>
                    <th scope="col" className="w-96 px-6 py-2.5 font-semibold">Champ de la plateforme</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entetes.map((h, i) => {
                    const exemples = donnees.map((l) => l[i]).filter(Boolean).slice(0, 3);
                    return (
                      <tr key={i} className={destinations[i] === "ignorer" ? "text-muted-foreground" : undefined}>
                        <th scope="row" className="px-6 py-2.5 font-semibold">{h}</th>
                        <td className="max-w-96 truncate px-4 py-2.5 text-sm">{exemples.join(" · ") || <span className="text-subtle-foreground">Colonne vide</span>}</td>
                        <td className="px-6 py-2">
                          <select
                            aria-label={`Champ de la plateforme pour la colonne « ${h} »`}
                            value={destinations[i]}
                            onChange={(e) => setDestinations((d) => d.map((x, j) => (j === i ? (e.target.value as Destination) : x)))}
                            className={classeSelect}
                          >
                            <option value="ignorer">Ne pas importer</option>
                            <option value="note">Importer comme note sur la fiche</option>
                            {GROUPES.map((g) => (
                              <optgroup key={g} label={g}>
                                {CHAMPS_IMPORT.filter((c) => DEFINITIONS[c].groupe === g).map((c) => (
                                  <option key={c} value={c}>{DEFINITIONS[c].libelle}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between border-t p-6">
              <Button variant="outline" onClick={() => setEtape(0)}>
                <ArrowLeft aria-hidden />
                Retour
              </Button>
              <Button disabled={manquants.length > 0 || doublesChamps.length > 0} onClick={versValeurs}>
                Continuer
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </Surface>
        </>
      )}

      {etape === 2 && (
        <Surface className="flex flex-col">
          <div className="flex flex-col gap-1 p-6 pb-2">
            <h2 className="text-xl font-semibold">3. Faites correspondre les valeurs des listes</h2>
            <p className="text-muted-foreground">Chaque valeur trouvée dans le fichier est rattachée à une valeur de la plateforme. Une valeur ignorée laisse le champ vide sur la fiche.</p>
          </div>
          {aMapper.length === 0 && <p className="px-6 py-4 text-muted-foreground">Aucune colonne de type liste n&apos;est importée : rien à faire ici.</p>}
          {aMapper.map(({ champ, valeurs: distinctes }) => (
            <TableValeurs
              key={champ}
              champ={champ}
              distinctes={distinctes}
              choix={valeurs[champ] ?? {}}
              onChange={(cle, v) => setValeurs((x) => ({ ...x, [champ]: { ...(x[champ] ?? {}), [cle]: v } }))}
            />
          ))}
          <div className="flex justify-between border-t p-6">
            <Button variant="outline" onClick={() => setEtape(1)}>
              <ArrowLeft aria-hidden />
              Retour
            </Button>
            <Button disabled={enCours} onClick={versApercu}>
              {enCours ? "Vérification des lignes…" : "Vérifier les lignes"}
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </Surface>
      )}

      {etape === 3 && analyse && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Compteur valeur={valides.length} libelle="lignes prêtes à importer" ton="ok" />
            <Compteur valeur={rejets.length} libelle="lignes rejetées (erreurs, doublons)" ton="err" />
            <Compteur valeur={analyse.filter((l) => l.fiche && l.avertissements.length).length} libelle="lignes importées avec un point à vérifier" ton="warn" />
          </div>
          <Surface className="flex flex-col">
            <div className="flex flex-wrap items-end justify-between gap-4 p-6 pb-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">4. Vérifiez l&apos;aperçu</h2>
                <p className="text-muted-foreground">Les lignes rejetées ne sont pas importées. Corrigez-les dans votre fichier puis importez-le de nouveau.</p>
              </div>
              {rejets.length > 0 && (
                <Button variant="outline" onClick={() => telecharger(nomRapport, rapportRejetsCsv(entetes, rejets))}>
                  <Download aria-hidden />
                  Rapport des rejets (CSV)
                </Button>
              )}
            </div>
            <TableApercu lignes={analyse} />
            <fieldset className="flex flex-col gap-3 border-t px-6 pt-5">
              <legend className="float-left mb-3 font-semibold">Statut des fiches importées</legend>
              <div className="clear-left flex flex-wrap gap-x-8 gap-y-2">
                {(
                  [
                    ["active", "Actives", "Les personnes sont tout de suite dans le registre."],
                    ["en_attente", "En attente de validation", "Elles rejoignent la file « Inscriptions à valider »."],
                  ] as const
                ).map(([v, libelle, detail]) => (
                  <label key={v} className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input type="radio" name="statut-import" value={v} checked={statut === v} onChange={() => setStatut(v)} className="mt-1 size-5 accent-primary" />
                    <span className="flex flex-col">
                      <span className="font-medium">{libelle}</span>
                      <span className="text-sm text-muted-foreground">{detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-between p-6">
              <Button variant="outline" onClick={() => setEtape(2)}>
                <ArrowLeft aria-hidden />
                Retour
              </Button>
              <Button disabled={valides.length === 0 || enCours} onClick={importer}>
                <Upload aria-hidden />
                {enCours ? "Import en cours…" : `Importer ${valides.length} fiche${valides.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </Surface>
        </>
      )}

      {etape === 4 && resultat && (
        <>
          <Bandeau ton="ok">
            {resultat.fiches} fiche{resultat.fiches > 1 ? "s" : ""} créée{resultat.fiches > 1 ? "s" : ""} ({resultat.foyers} foyer{resultat.foyers > 1 ? "s" : ""}), au statut « {statut === "active" ? "Active" : "En attente de validation"} ». La correspondance des colonnes est enregistrée pour le prochain fichier de ce format.
          </Bandeau>
          <Surface className="flex flex-col gap-4 p-6">
            <h2 className="text-xl font-semibold">5. Import terminé</h2>
            {resultat.rejets.length > 0 ? (
              <p>
                {resultat.rejets.length} ligne{resultat.rejets.length > 1 ? "s ont été rejetées" : " a été rejetée"}. Téléchargez le rapport pour les corriger.
              </p>
            ) : (
              <p>Toutes les lignes ont été importées.</p>
            )}
            <div className="flex flex-wrap gap-3">
              {resultat.rejets.length > 0 && (
                <Button variant="outline" onClick={() => telecharger(nomRapport, rapportRejetsCsv(entetes, resultat.rejets))}>
                  <Download aria-hidden />
                  Télécharger le rapport des rejets (CSV)
                </Button>
              )}
              <Link href={statut === "active" ? "/beneficiaires" : "/inscriptions"} className={buttonVariants()}>
                {statut === "active" ? "Voir les bénéficiaires" : "Voir les inscriptions à valider"}
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setClasseur(null);
                  setAnalyse(null);
                  setResultat(null);
                  setEtape(0);
                }}
              >
                Importer un autre fichier
              </Button>
            </div>
          </Surface>
        </>
      )}
    </div>
  );
}

function Compteur({ valeur, libelle, ton }: { valeur: number; libelle: string; ton: "ok" | "warn" | "err" }) {
  return (
    <Surface className="flex flex-col gap-1 p-5">
      <span className={cn("text-3xl font-bold tabular", { ok: "text-ok", warn: "text-warn", err: "text-err" }[ton])}>{valeur}</span>
      <span className="text-muted-foreground">{libelle}</span>
    </Surface>
  );
}

function TableValeurs({
  champ,
  distinctes,
  choix,
  onChange,
}: {
  champ: ChampImport;
  distinctes: { cle: string; exemple: string; occurrences: number }[];
  choix: Record<string, string>;
  onChange: (cle: string, valeur: string) => void;
}) {
  const options = Object.entries(DEFINITIONS[champ].valeurs ?? {});
  return (
    <section className="flex flex-col gap-2 border-t px-6 py-5">
      <h3 className="font-semibold">{DEFINITIONS[champ].libelle}</h3>
      <table className="w-full max-w-3xl text-left">
        <thead className="text-sm text-muted-foreground">
          <tr>
            <th scope="col" className="py-1.5 pr-4 font-semibold">Valeur dans le fichier</th>
            <th scope="col" className="py-1.5 pr-4 font-semibold">Lignes</th>
            <th scope="col" className="w-72 py-1.5 font-semibold">Valeur retenue</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {distinctes.map((v) => (
            <tr key={v.cle}>
              <th scope="row" className="py-2 pr-4 font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  « {v.exemple} »{!choix[v.cle] && <Pastille ton="warn">À choisir</Pastille>}
                </span>
              </th>
              <td className="py-2 pr-4 tabular text-muted-foreground">{v.occurrences}</td>
              <td className="py-2">
                <select aria-label={`Valeur retenue pour « ${v.exemple} »`} value={choix[v.cle] ?? ""} onChange={(e) => onChange(v.cle, e.target.value)} className={classeSelect}>
                  <option value="">Ignorer cette valeur</option>
                  {options.map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>{libelle}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TableApercu({ lignes }: { lignes: LigneAnalysee[] }) {
  return (
    <div className="relative max-h-[32rem] overflow-auto border-t">
      <table className="w-full min-w-[48rem] text-left">
        <thead className="sticky top-0 border-b bg-card text-sm text-muted-foreground">
          <tr>
            <th scope="col" className="px-6 py-2.5 font-semibold">Ligne</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Personne</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Statut</th>
            <th scope="col" className="px-6 py-2.5 font-semibold">Détail</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lignes.map((l) => (
            <tr key={l.numero} className="align-top">
              <td className="px-6 py-2.5 tabular text-muted-foreground">{l.numero}</td>
              <td className="px-4 py-2.5 font-medium">{nomFiche(l) ?? l.libelle}</td>
              <td className="px-4 py-2.5">
                {l.erreurs.length ? <Pastille ton="err">Rejetée</Pastille> : l.avertissements.length ? <Pastille ton="warn">À vérifier</Pastille> : <Pastille ton="ok">Prête</Pastille>}
              </td>
              <td className="px-6 py-2.5 text-sm">
                <ul className="flex flex-col gap-0.5">
                  {l.erreurs.map((e) => (
                    <li key={e} className="font-medium text-err">{e}</li>
                  ))}
                  {l.avertissements.map((a) => (
                    <li key={a} className="text-muted-foreground">{a}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
