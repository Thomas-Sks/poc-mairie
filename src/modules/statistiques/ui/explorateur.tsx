"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChartBar, ChartLine, ChartPie, Map as IconeCarte, Save, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Libelle, PastillePriorite, Surface } from "@/shared/ui/elements";
import type { DateISO } from "@/shared/domain/dates";
import { analyserQuestion, QUESTIONS_SUGGEREES } from "../domain/analyseur";
import {
  DECOUPAGES,
  GRAPHIQUE_LIBELLES,
  SUJET_UNITES,
  decoupagesPour,
  estSujetPersonne,
  type DecoupageId,
  type TypeGraphique,
} from "../domain/catalogue";
import { decrirePeriode } from "../domain/periodes";
import { decrireFiltres, type DefinitionRequete, type Referentiels } from "../domain/requete";
import { evolution, graphiqueAdapte, graphiquesPossibles } from "../domain/resultat";
import { formaterEffectif, SEUIL_SECRET, type ResultatAffiche } from "../domain/secret";
import type { PersonneTrouvee, QuartierCarte } from "../application/ports";
import { enregistrerRequeteAction, executerRequeteAction, listerPersonnesAction } from "./actions";
import { Bascule } from "./controles";
import { Criteres } from "./criteres";
import { Graphique, hauteurBarres } from "./graphique";
import { BoutonCsv, TableauResultat } from "./tableau-resultat";

const ICONES_GRAPHIQUE: Record<TypeGraphique, typeof ChartBar> = { barres: ChartBar, camembert: ChartPie, courbe: ChartLine, carte: IconeCarte };

export function Explorateur({
  initiale,
  resultatInitial,
  referentiels,
  quartiers,
  nominatif,
  jour,
  titreInitial,
}: {
  initiale: DefinitionRequete;
  resultatInitial: ResultatAffiche;
  referentiels: Referentiels;
  quartiers: QuartierCarte[];
  nominatif: boolean;
  jour: DateISO;
  titreInitial?: string;
}) {
  const [definition, setDefinition] = useState(initiale);
  const [generation, setGeneration] = useState(0);
  const [masquer, setMasquer] = useState(!nominatif);
  const [resultat, setResultat] = useState(resultatInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [personnes, setPersonnes] = useState<{ total: number; personnes: PersonneTrouvee[] } | null>(null);
  const [question, setQuestion] = useState("");
  const [compris, setCompris] = useState<{ morceaux: string[]; vide: boolean } | null>(null);
  const [calcul, demarrerCalcul] = useTransition();
  const [chargementPersonnes, demarrerPersonnes] = useTransition();
  const numero = useRef(0);
  const premier = useRef(true);
  const refPersonnes = useRef<HTMLElement>(null);

  // Le choix du graphique ne relance pas le calcul.
  const cleCalcul = JSON.stringify({ ...definition, graphique: null });
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    const n = ++numero.current;
    demarrerCalcul(async () => {
      const r = await executerRequeteAction(JSON.parse(cleCalcul), masquer);
      if (n !== numero.current) return;
      if (r.ok) {
        setResultat(r.valeur);
        setErreur(null);
      } else setErreur(r.erreur);
    });
  }, [cleCalcul, masquer]);

  const modifier = (d: DefinitionRequete) => {
    setDefinition(d);
    setPersonnes(null);
  };

  const appliquerQuestion = (texte: string) => {
    setQuestion(texte);
    const a = analyserQuestion(texte, referentiels);
    setCompris({ morceaux: a.compris, vide: a.vide });
    if (!a.vide) {
      modifier(a.definition);
      setGeneration((g) => g + 1);
    }
  };

  const voirPersonnes = () =>
    demarrerPersonnes(async () => {
      const r = await listerPersonnesAction(definition);
      if (r.ok) {
        setPersonnes(r.valeur);
        requestAnimationFrame(() => refPersonnes.current?.scrollIntoView({ block: "start" }));
      } else toast.error(r.erreur);
    });

  const [singulier, pluriel] = SUJET_UNITES[definition.sujet];
  const unite = resultat.total === 1 ? singulier : pluriel;
  const nbCategories = resultat.lignes.length;
  const graphique = graphiqueAdapte(resultat.decoupage, nbCategories, definition.graphique);
  const comparer = resultat.totalComparaison !== null && definition.comparaison !== null;
  const libellesSeries: [string, string] = [decrirePeriode(definition.periode), decrirePeriode(definition.comparaison)];
  const peutVoirPersonnes = nominatif && !resultat.secret && estSujetPersonne(definition.sujet) && (resultat.total ?? 0) > 0;
  const evo = comparer && resultat.total !== null && resultat.totalComparaison !== null ? evolution(resultat.total, resultat.totalComparaison) : null;
  const decoupageAffiche = resultat.decoupage === definition.decoupage;

  return (
    <div className="flex flex-col gap-6">
      <Surface className="flex flex-col gap-4 p-5">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) appliquerQuestion(question);
          }}
        >
          <label htmlFor="question" className="text-lg font-semibold">
            Posez votre question
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex. : combien de femmes de plus de 85 ans vivent seules ?"
              aria-describedby="question-aide"
            />
            <Button type="submit" variant="outline">
              <Search aria-hidden />
              Traduire en filtres
            </Button>
          </div>
          <p id="question-aide" className="text-sm text-muted-foreground">
            La question est traduite en filtres visibles ci-dessous, que vous pouvez corriger.
          </p>
        </form>
        {compris && (
          <p role="status" className={compris.vide ? "font-medium text-warn" : "text-muted-foreground"}>
            {compris.vide ? (
              "Je n'ai pas compris cette question. Essayez un exemple ou composez les filtres vous-même."
            ) : (
              <>
                Compris : {compris.morceaux.map((m) => `« ${m} »`).join(", ")}.
              </>
            )}
          </p>
        )}
        <div className="flex flex-col gap-2 border-t pt-4">
          <Libelle>Exemples de questions</Libelle>
          <ul className="flex flex-wrap gap-2">
            {QUESTIONS_SUGGEREES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => appliquerQuestion(q)}
                  className="min-h-11 rounded-lg border border-input bg-card px-3 py-2 text-left hover:border-primary hover:bg-accent hover:text-primary"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Surface>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Surface className="p-5" aria-label="Critères">
          <h2 className="mb-4 text-xl font-semibold">Critères</h2>
          <Criteres definition={definition} onChange={modifier} referentiels={referentiels} jour={jour} generation={generation} />
        </Surface>

        <Surface className="flex min-w-0 flex-col max-lg:order-first" aria-label="Résultat" aria-busy={calcul}>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <Libelle>{titreInitial && generation === 0 ? titreInitial : "Résultat"}</Libelle>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <p className={calcul ? "opacity-60" : undefined}>
                    <span className="tabular block text-6xl font-bold leading-none tracking-tight text-primary" aria-live="polite">
                      {formaterEffectif(resultat.total)}
                    </span>
                    <span className="mt-2 block text-lg font-medium">{unite}</span>
                  </p>
                  {comparer && (
                    <p className="pb-1">
                      <span className="tabular block text-3xl font-semibold leading-none text-muted-foreground">{formaterEffectif(resultat.totalComparaison)}</span>
                      <span className="mt-2 block text-muted-foreground">
                        {decrirePeriode(definition.comparaison)}
                        {evo !== null && ` · ${evo > 0 ? "+" : ""}${evo} %`}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {peutVoirPersonnes && (
                  <Button variant="outline" onClick={voirPersonnes} disabled={chargementPersonnes}>
                    <Users aria-hidden />
                    Voir {resultat.total === 1 ? "la personne" : `les ${formaterEffectif(resultat.total)} personnes`}
                  </Button>
                )}
                <EnregistrerRequete definition={definition} referentiels={referentiels} />
              </div>
            </div>
            <p className="text-muted-foreground">
              {decrireFiltres(definition, referentiels)} · {decrirePeriode(definition.periode)}
            </p>
            {erreur && <p className="font-medium text-err">{erreur}</p>}
            <div className="flex items-start gap-3">
              <Switch
                id="secret"
                checked={masquer || !nominatif}
                disabled={!nominatif}
                onCheckedChange={(v) => {
                  setMasquer(v);
                  if (v) setPersonnes(null);
                }}
                className="mt-1"
                aria-describedby="secret-aide"
              />
              <div className="flex flex-col">
                <label htmlFor="secret" className="font-medium">
                  Masquer les effectifs inférieurs à {SEUIL_SECRET}
                </label>
                <span id="secret-aide" className="text-sm text-muted-foreground">
                  {nominatif
                    ? "Secret statistique, à activer avant de diffuser un chiffre hors du CCAS."
                    : "Secret statistique : votre profil n'a pas accès aux données nominatives."}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t p-5">
            <h2 className="font-semibold" id="titre-decoupage">
              Découper par
            </h2>
            <div role="group" aria-labelledby="titre-decoupage" className="flex flex-wrap gap-2">
              <Bascule actif={!definition.decoupage} onClick={() => modifier({ ...definition, decoupage: null, graphique: null })}>
                Aucun découpage
              </Bascule>
              {decoupagesPour(definition.sujet).map((dec: DecoupageId) => (
                <Bascule key={dec} actif={definition.decoupage === dec} onClick={() => modifier({ ...definition, decoupage: dec, graphique: null })}>
                  {DECOUPAGES[dec].libelle}
                </Bascule>
              ))}
            </div>
          </div>

          {definition.decoupage && decoupageAffiche && graphique && (
            <div className="flex flex-col gap-5 border-t p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Type de graphique" className="flex flex-wrap gap-2">
                  {graphiquesPossibles(resultat.decoupage, nbCategories).map((g) => {
                    const Icone = ICONES_GRAPHIQUE[g];
                    return (
                      <Bascule key={g} actif={graphique === g} onClick={() => setDefinition({ ...definition, graphique: g })}>
                        <Icone aria-hidden />
                        {GRAPHIQUE_LIBELLES[g]}
                      </Bascule>
                    );
                  })}
                </div>
                <BoutonCsv titre={`${pluriel} par ${DECOUPAGES[definition.decoupage].libelle}`} resultat={resultat} libellesSeries={libellesSeries} />
              </div>
              {nbCategories === 0 ? (
                <p className="text-muted-foreground">Aucune donnée à découper.</p>
              ) : (
                <div className={calcul ? "opacity-60" : undefined}>
                  <Graphique
                    resultat={resultat}
                    type={graphique}
                    quartiers={quartiers}
                    libellesSeries={libellesSeries}
                    hauteur={graphique === "barres" ? hauteurBarres(nbCategories, comparer) : graphique === "camembert" ? 240 : 320}
                  />
                </div>
              )}
              <TableauResultat resultat={resultat} libellesSeries={libellesSeries} />
            </div>
          )}
        </Surface>
      </div>

      {personnes && (
        <Surface ref={refPersonnes} className="flex flex-col gap-4 p-5" aria-label="Personnes correspondantes">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">Personnes correspondantes</h2>
            <span className="text-muted-foreground">
              {personnes.total > personnes.personnes.length ? `${personnes.personnes.length} premières sur ${personnes.total}` : `${personnes.total} au total`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left">
              <thead>
                <tr className="border-b text-sm text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-semibold">Nom</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Âge</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Quartier</th>
                  <th scope="col" className="py-2 font-semibold">Priorité</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {personnes.personnes.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4">
                      <Link href={`/beneficiaires/${p.id}`} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                        {p.civilite} {p.nom} {p.prenom}
                      </Link>
                    </td>
                    <td className="tabular py-2 pr-4 text-right">{p.age} ans</td>
                    <td className="py-2 pr-4">{p.quartier ?? "–"}</td>
                    <td className="py-2">
                      <PastillePriorite niveau={p.priorite} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}
    </div>
  );
}

function EnregistrerRequete({ definition, referentiels }: { definition: DefinitionRequete; referentiels: Referentiels }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, demarrer] = useTransition();
  const ouvrir = () => {
    const base = decrireFiltres(definition, referentiels);
    const dec = definition.decoupage ? `, par ${DECOUPAGES[definition.decoupage].libelle.toLowerCase()}` : "";
    setNom(`${definition.filtres.length ? base : "Tous"}${dec}`.slice(0, 120));
    setOuvert(true);
  };
  return (
    <>
      <Button onClick={ouvrir}>
        <Save aria-hidden />
        Enregistrer la requête
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Enregistrer la requête</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">Elle sera visible par toute l&apos;équipe et utilisable dans les tableaux de bord.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              demarrer(async () => {
                const r = await enregistrerRequeteAction(nom, definition);
                if (r.ok) {
                  setOuvert(false);
                  toast.success("Requête enregistrée", { description: nom });
                } else toast.error(r.erreur);
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="nom-requete" className="font-medium">
                Nom de la requête
              </label>
              <Input id="nom-requete" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={enCours || !nom.trim()}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
