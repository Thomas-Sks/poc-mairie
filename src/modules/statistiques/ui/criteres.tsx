"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DateISO } from "@/shared/domain/dates";
import {
  CHAMPS,
  OPERATEUR_LIBELLES,
  SUJETS,
  SUJET_DATE_LIBELLES,
  SUJET_LIBELLES,
  champsPour,
  type ChampId,
  type Sujet,
} from "../domain/catalogue";
import { clePeriode, periodesProposees } from "../domain/periodes";
import { changerSujet, nouveauFiltre, optionsDuChamp, type DefinitionRequete, type Filtre, type Referentiels } from "../domain/requete";
import { memePeriodeAnneePrecedente } from "../domain/resultat";
import { ChampDate, ListeDeroulante } from "./controles";

const OUI_NON = [
  { valeur: "oui", libelle: "Oui" },
  { valeur: "non", libelle: "Non" },
];

/** Panneau « Critères » : quoi compter, filtres en phrases, période et comparaison. */
export function Criteres({
  definition,
  onChange,
  referentiels,
  jour,
  generation,
}: {
  /** Change quand la définition est remplacée de l'extérieur (question, suggestion) : réinitialise les champs. */
  generation: number;
  definition: DefinitionRequete;
  onChange: (d: DefinitionRequete) => void;
  referentiels: Referentiels;
  jour: DateISO;
}) {
  const d = definition;
  const disponibles = champsPour(d.sujet).filter((c) => !d.filtres.some((f) => f.champ === c));
  const modifierFiltre = (i: number, f: Filtre) => onChange({ ...d, filtres: d.filtres.map((x, k) => (k === i ? f : x)) });
  const proposees = periodesProposees(jour);
  const cle = clePeriode(d.periode, proposees);
  const cleComparaison = !d.comparaison
    ? "aucune"
    : d.periode && JSON.stringify(memePeriodeAnneePrecedente(d.periode)) === JSON.stringify(d.comparaison)
      ? "annee-1"
      : "personnalisee";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="sujet" className="font-semibold">
          Que voulez-vous compter ?
        </label>
        <ListeDeroulante
          id="sujet"
          value={d.sujet}
          onChange={(e) => onChange(changerSujet(d, e.target.value as Sujet))}
          options={SUJETS.map((s) => ({ valeur: s, libelle: SUJET_LIBELLES[s] }))}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">Filtres</legend>
        {d.filtres.length === 0 && <p className="text-muted-foreground">Aucun filtre : tout est compté.</p>}
        <ol className="flex flex-col">
          {d.filtres.map((f, i) => (
            <li key={`${f.champ}-${generation}`} className="flex flex-col gap-2">
              {i > 0 && <span className="py-1 text-sm font-semibold uppercase tracking-[0.06em] text-subtle-foreground">et</span>}
              <LigneFiltre filtre={f} referentiels={referentiels} onChange={(nf) => modifierFiltre(i, nf)} onRetirer={() => onChange({ ...d, filtres: d.filtres.filter((_, k) => k !== i) })} />
            </li>
          ))}
        </ol>
        {disponibles.length > 0 && (
          <div>
            <label htmlFor="ajout-filtre" className="sr-only">
              Ajouter un filtre
            </label>
            <ListeDeroulante
              id="ajout-filtre"
              value=""
              onChange={(e) => e.target.value && onChange({ ...d, filtres: [...d.filtres, nouveauFiltre(e.target.value as ChampId, referentiels)] })}
              options={[{ valeur: "", libelle: "+ Ajouter un filtre…" }, ...disponibles.map((c) => ({ valeur: c, libelle: CHAMPS[c].libelle }))]}
              className="font-medium text-primary"
            />
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="periode" className="font-semibold">
          Période
        </label>
        <ListeDeroulante
          id="periode"
          aria-describedby="periode-aide"
          value={cle}
          onChange={(e) => {
            const p = e.target.value === "personnalisee" ? (d.periode ?? { du: `${jour.slice(0, 4)}-01-01`, au: jour }) : (proposees.find((x) => x.cle === e.target.value)?.periode ?? null);
            onChange({ ...d, periode: p, comparaison: p ? d.comparaison : null });
          }}
          options={[...proposees.map((p) => ({ valeur: p.cle, libelle: p.libelle })), { valeur: "personnalisee", libelle: "Dates personnalisées" }]}
        />
        <p id="periode-aide" className="text-sm text-muted-foreground">
          Porte sur la {SUJET_DATE_LIBELLES[d.sujet]}.
        </p>
        {cle === "personnalisee" && d.periode && <Dates prefixe="periode" valeur={d.periode} onChange={(p) => onChange({ ...d, periode: p })} />}
      </div>

      {d.periode && (
        <div className="flex flex-col gap-2">
          <label htmlFor="comparaison" className="font-semibold">
            Comparer avec
          </label>
          <ListeDeroulante
            id="comparaison"
            value={cleComparaison}
            onChange={(e) => {
              const v = e.target.value;
              const periode = d.periode!;
              onChange({ ...d, comparaison: v === "aucune" ? null : v === "annee-1" ? memePeriodeAnneePrecedente(periode) : (d.comparaison ?? memePeriodeAnneePrecedente(periode)) });
            }}
            options={[
              { valeur: "aucune", libelle: "Pas de comparaison" },
              { valeur: "annee-1", libelle: "La même période, un an avant" },
              { valeur: "personnalisee", libelle: "Une autre période" },
            ]}
          />
          {cleComparaison === "personnalisee" && d.comparaison && <Dates prefixe="comparaison" valeur={d.comparaison} onChange={(p) => onChange({ ...d, comparaison: p })} />}
        </div>
      )}
    </div>
  );
}

function Dates({ prefixe, valeur, onChange }: { prefixe: string; valeur: { du: string; au: string }; onChange: (p: { du: string; au: string }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefixe}-du`} className="text-sm text-muted-foreground">
          Du
        </label>
        <ChampDate id={`${prefixe}-du`} value={valeur.du} max={valeur.au} onChange={(e) => e.target.value && onChange({ ...valeur, du: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefixe}-au`} className="text-sm text-muted-foreground">
          Au
        </label>
        <ChampDate id={`${prefixe}-au`} value={valeur.au} min={valeur.du} onChange={(e) => e.target.value && onChange({ ...valeur, au: e.target.value })} />
      </div>
    </div>
  );
}

function LigneFiltre({ filtre, referentiels, onChange, onRetirer }: { filtre: Filtre; referentiels: Referentiels; onChange: (f: Filtre) => void; onRetirer: () => void }) {
  const def = CHAMPS[filtre.champ];
  const id = `filtre-${filtre.champ}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-libelle`} className="font-medium">
          {def.libelle}
        </span>
        <Button variant="ghost" size="icon" onClick={onRetirer} aria-label={`Retirer le filtre « ${def.libelle} »`}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex gap-2">
        {def.operateurs.length > 1 && (
          <ListeDeroulante
            aria-label={`Comparaison pour ${def.libelle}`}
            value={filtre.operateur}
            onChange={(e) => onChange({ ...filtre, operateur: e.target.value as Filtre["operateur"] })}
            options={def.operateurs.map((o) => ({ valeur: o, libelle: OPERATEUR_LIBELLES[o].liste }))}
            className="w-auto shrink-0"
          />
        )}
        {def.type === "nombre" ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              aria-labelledby={`${id}-libelle`}
              min={def.min}
              max={def.max}
              defaultValue={filtre.valeur}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (/^\d{1,3}$/.test(e.target.value) && n >= (def.min ?? 0) && n <= (def.max ?? 999)) onChange({ ...filtre, valeur: e.target.value });
              }}
              className="tabular h-11 w-24 rounded-lg border border-input bg-card px-3 text-base"
            />
            {def.unite && <span className="text-muted-foreground">{def.unite}</span>}
          </div>
        ) : (
          <ListeDeroulante
            aria-labelledby={`${id}-libelle`}
            value={filtre.valeur}
            onChange={(e) => onChange({ ...filtre, valeur: e.target.value })}
            options={def.type === "oui_non" ? OUI_NON : optionsDuChamp(filtre.champ, referentiels)}
          />
        )}
      </div>
    </div>
  );
}
