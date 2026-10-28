"use client";

/**
 * E8-US2 / E8-US3 — Panneau de filtres combinables. Chaque modification s'applique immédiatement.
 * Utilisé dans une colonne latérale (desktop) ou dans un tiroir (mobile, tablette).
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DEPLACEMENTS,
  DEPLACEMENT_LIBELLES,
  NIVEAUX_PRIORITE,
  SEXES,
  SEXE_LIBELLES,
  STATUTS_FICHE,
  STATUT_FICHE_LIBELLES,
} from "@/shared/domain/vocabulaire";
import { basculerValeur, COTE_LIBELLES, COTES, normaliserFiltre, type Cote, type Filtre, type FiltreRue } from "../domain/filtre";
import { nomMembre, type Referentiels } from "./types";

export const classeSelect =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Bouton bascule (valeur d'un critère multiple). */
function Bascule({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-lg border px-3 text-[0.9375rem] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        actif ? "border-primary bg-accent text-primary" : "border-input bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Groupe({ legende, children }: { legende: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{legende}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function ChoixMultiple<T extends string | number>({
  legende,
  options,
  valeurs,
  onBasculer,
}: {
  legende: string;
  options: { valeur: T; libelle: string }[];
  valeurs: T[] | undefined;
  onBasculer: (v: T) => void;
}) {
  return (
    <Groupe legende={legende}>
      {options.map((o) => (
        <Bascule key={String(o.valeur)} actif={valeurs?.includes(o.valeur) ?? false} onClick={() => onBasculer(o.valeur)}>
          {o.libelle}
        </Bascule>
      ))}
    </Groupe>
  );
}

/** Critère oui / non facultatif. */
function ChoixOuiNon({
  legende,
  valeur,
  libelles,
  onChange,
}: {
  legende: string;
  valeur: boolean | undefined;
  libelles: [string, string];
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <Groupe legende={legende}>
      <Bascule actif={valeur === undefined} onClick={() => onChange(undefined)}>
        Indifférent
      </Bascule>
      <Bascule actif={valeur === true} onClick={() => onChange(valeur === true ? undefined : true)}>
        {libelles[0]}
      </Bascule>
      <Bascule actif={valeur === false} onClick={() => onChange(valeur === false ? undefined : false)}>
        {libelles[1]}
      </Bascule>
    </Groupe>
  );
}

function ChampNombre({ id, libelle, valeur, onChange, min = 0, max }: { id: string; libelle: string; valeur?: number; onChange: (v?: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {libelle}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={valeur ?? ""}
        onChange={(e) => {
          const n = e.target.value === "" ? undefined : Math.trunc(Number(e.target.value));
          onChange(n === undefined || Number.isNaN(n) ? undefined : n);
        }}
      />
    </div>
  );
}

const OPTIONS_CONTACT = [
  { valeur: "", libelle: "Indifférent" },
  { valeur: "moins_de:7", libelle: "Contacté il y a moins de 7 jours" },
  { valeur: "moins_de:30", libelle: "Contacté il y a moins de 30 jours" },
  { valeur: "plus_de:30", libelle: "Sans contact depuis plus de 30 jours" },
  { valeur: "plus_de:90", libelle: "Sans contact depuis plus de 90 jours" },
  { valeur: "plus_de:180", libelle: "Sans contact depuis plus de 6 mois" },
];

/** Autocomplétion des voies de la commune (table `adresses`). */
function AjoutRue({ onAjouter }: { onAjouter: (voie: string) => void }) {
  const id = useId();
  const [saisie, setSaisie] = useState("");
  const [differee, setDifferee] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDifferee(saisie.trim()), 200);
    return () => clearTimeout(t);
  }, [saisie]);
  const { data: voies = [] } = useQuery({
    queryKey: ["registre", "voies", differee],
    queryFn: async () => (await fetch(`/api/registre/voies?q=${encodeURIComponent(differee)}`)).json() as Promise<string[]>,
    enabled: differee.length >= 2,
  });
  const choisir = (voie: string) => {
    onAjouter(voie);
    setSaisie("");
    setOuvert(false);
  };
  const visibles = differee.length >= 2 ? voies : [];
  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        Ajouter une rue
      </label>
      <Input
        id={id}
        role="combobox"
        aria-expanded={ouvert && visibles.length > 0}
        aria-controls={`${id}-liste`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Ex. rue du Marais"
        value={saisie}
        onChange={(e) => {
          setSaisie(e.target.value);
          setOuvert(true);
          setActif(0);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActif((a) => Math.min(a + 1, visibles.length - 1));
          else if (e.key === "ArrowUp") setActif((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && visibles[actif]) {
            e.preventDefault();
            choisir(visibles[actif]);
          } else if (e.key === "Escape") setOuvert(false);
        }}
      />
      {ouvert && visibles.length > 0 && (
        <ul id={`${id}-liste`} role="listbox" className="absolute top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10">
          {visibles.map((v, i) => (
            <li
              key={v}
              role="option"
              aria-selected={i === actif}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(v);
              }}
              className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2", i === actif && "bg-accent text-primary")}
            >
              <MapPin className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
              {v}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CritereRue({ rue, onChange, onRetirer }: { rue: FiltreRue; onChange: (r: FiltreRue) => void; onRetirer: () => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{rue.voie}</span>
        <Button variant="ghost" size="icon" aria-label={`Retirer ${rue.voie}`} onClick={onRetirer}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex gap-2">
        <ChampNombre id={`${id}-min`} libelle="Du n°" valeur={rue.numeroMin} onChange={(v) => onChange({ ...rue, numeroMin: v })} />
        <ChampNombre id={`${id}-max`} libelle="Au n°" valeur={rue.numeroMax} onChange={(v) => onChange({ ...rue, numeroMax: v })} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-cote`} className="text-sm text-muted-foreground">
          Côté
        </label>
        <select id={`${id}-cote`} className={classeSelect} value={rue.cote} onChange={(e) => onChange({ ...rue, cote: e.target.value as Cote })}>
          {COTES.map((c) => (
            <option key={c} value={c}>
              {COTE_LIBELLES[c]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Rubrique({ titre, children, premiere }: { titre: string; children: ReactNode; premiere?: boolean }) {
  return (
    <section className={cn("flex flex-col gap-5", !premiere && "border-t pt-5")}>
      <h3 className="text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-subtle-foreground">{titre}</h3>
      {children}
    </section>
  );
}

export function PanneauFiltres({
  filtre,
  onChange,
  referentiels,
  accesSante,
}: {
  filtre: Filtre;
  onChange: (f: Filtre) => void;
  referentiels: Referentiels;
  accesSante: boolean;
}) {
  const id = useId();
  const maj = (partiel: Partial<Filtre>) => onChange(normaliserFiltre({ ...filtre, ...partiel }));
  const basculer = <K extends Parameters<typeof basculerValeur>[1]>(cle: K, v: NonNullable<Filtre[K]>[number]) => onChange(basculerValeur(filtre, cle, v));
  const rues = filtre.rues ?? [];
  const valeurContact = filtre.dernierContact ? `${filtre.dernierContact.sens}:${filtre.dernierContact.jours}` : "";

  return (
    <div className="flex flex-col gap-5">
      <Rubrique titre="Adresse" premiere>
        <div className="flex flex-col gap-3">
          {rues.map((r, i) => (
            <CritereRue
              key={`${r.voie}-${i}`}
              rue={r}
              onChange={(nouvelle) => maj({ rues: rues.map((x, j) => (j === i ? nouvelle : x)) })}
              onRetirer={() => maj({ rues: rues.filter((_, j) => j !== i) })}
            />
          ))}
          <AjoutRue onAjouter={(voie) => maj({ rues: [...rues, { voie, cote: "tous" }] })} />
        </div>
        <ChoixMultiple
          legende="Quartier"
          options={referentiels.quartiers.map((q) => ({ valeur: q, libelle: q }))}
          valeurs={filtre.quartiers}
          onBasculer={(v) => basculer("quartiers", v)}
        />
      </Rubrique>

      <Rubrique titre="Personne">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Âge</legend>
          <div className="flex gap-2">
            <ChampNombre id={`${id}-age-min`} libelle="De (ans)" max={130} valeur={filtre.age?.min} onChange={(v) => maj({ age: { ...filtre.age, min: v } })} />
            <ChampNombre id={`${id}-age-max`} libelle="À (ans)" max={130} valeur={filtre.age?.max} onChange={(v) => maj({ age: { ...filtre.age, max: v } })} />
          </div>
        </fieldset>
        <ChoixMultiple legende="Sexe" options={SEXES.map((s) => ({ valeur: s, libelle: SEXE_LIBELLES[s] }))} valeurs={filtre.sexes} onBasculer={(v) => basculer("sexes", v)} />
        <ChoixOuiNon legende="Vit seul(e)" valeur={filtre.vitSeul} libelles={["Oui", "Non"]} onChange={(v) => maj({ vitSeul: v })} />
      </Rubrique>

      {accesSante && (
        <Rubrique titre="Autonomie et aides">
          <ChoixMultiple
            legende="Mobilité"
            options={DEPLACEMENTS.map((d) => ({ valeur: d, libelle: DEPLACEMENT_LIBELLES[d] }))}
            valeurs={filtre.deplacements}
            onBasculer={(v) => basculer("deplacements", v)}
          />
          <ChoixOuiNon legende="Handicap" valeur={filtre.handicap} libelles={["Oui", "Non"]} onChange={(v) => maj({ handicap: v })} />
          <ChoixOuiNon legende="APA" valeur={filtre.apa} libelles={["Bénéficiaire", "Non"]} onChange={(v) => maj({ apa: v })} />
          <ChoixMultiple legende="GIR" options={[1, 2, 3, 4, 5, 6].map((g) => ({ valeur: g, libelle: `GIR ${g}` }))} valeurs={filtre.girs} onBasculer={(v) => basculer("girs", v)} />
        </Rubrique>
      )}

      <Rubrique titre="Suivi">
        <ChoixMultiple legende="Priorité" options={NIVEAUX_PRIORITE.map((n) => ({ valeur: n, libelle: n }))} valeurs={filtre.niveaux} onBasculer={(v) => basculer("niveaux", v)} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-contact`} className="font-semibold">
            Dernier contact
          </label>
          <select
            id={`${id}-contact`}
            className={classeSelect}
            value={valeurContact}
            onChange={(e) => {
              const [sens, jours] = e.target.value.split(":");
              maj({ dernierContact: sens ? { sens: sens as "moins_de" | "plus_de", jours: Number(jours) } : undefined });
            }}
          >
            {OPTIONS_CONTACT.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
        </div>
        <ChoixOuiNon legende="Indisponibilité en cours" valeur={filtre.indisponible} libelles={["Indisponible", "Disponible"]} onChange={(v) => maj({ indisponible: v })} />
        <ChoixMultiple
          legende="Assigné à"
          options={referentiels.equipe.map((m) => ({ valeur: m.id, libelle: nomMembre(m) }))}
          valeurs={filtre.assignesA}
          onBasculer={(v) => basculer("assignesA", v)}
        />
        {referentiels.tags.length > 0 && (
          <ChoixMultiple legende="Tags" options={referentiels.tags.map((t) => ({ valeur: t, libelle: t }))} valeurs={filtre.tags} onBasculer={(v) => basculer("tags", v)} />
        )}
        <ChoixMultiple
          legende="Statut de la fiche"
          options={STATUTS_FICHE.map((s) => ({ valeur: s, libelle: STATUT_FICHE_LIBELLES[s] }))}
          valeurs={filtre.statuts}
          onBasculer={(v) => basculer("statuts", v)}
        />
        {!filtre.statuts && <p className="-mt-3 text-sm text-muted-foreground">Sans choix, les fiches archivées sont masquées.</p>}
      </Rubrique>
    </div>
  );
}

