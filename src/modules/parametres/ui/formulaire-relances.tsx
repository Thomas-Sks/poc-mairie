"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ParametresRelance } from "@/shared/domain/campagne";
import { Surface } from "@/shared/ui/elements";
import { ajusterDelais } from "../domain/parametres";
import { enregistrerRelancesAction } from "./actions";
import { ChampNombre, PiedFormulaire, SousTitre, useEnvoi } from "./champs";

type Valeurs = { relance: ParametresRelance; anniversaireJoursAvant: number; verificationMois: number };

const ORDINAUX = ["", "", "2e", "3e", "4e", "5e"];

/** RG-04 (relances), E4-US1 (anniversaires), E1-US5 (revérification). */
export function FormulaireRelances({ initiales }: { initiales: Valeurs }) {
  const [v, setV] = useState<Valeurs>(initiales);
  const { enCours, envoyer } = useEnvoi();
  const r = v.relance;
  const setRelance = (changement: Partial<ParametresRelance>) => setV({ ...v, relance: { ...r, ...changement } });

  return (
    <Surface>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(() => enregistrerRelancesAction(v));
        }}
      >
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <SousTitre>Relances pendant une campagne d&apos;appel</SousTitre>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            <ChampNombre
              id="relance-tentatives"
              libelle="Nombre de tentatives"
              min={1}
              max={5}
              valeur={r.nbTentatives}
              onChange={(n) => setRelance({ nbTentatives: n, delaisMinutes: Number.isNaN(n) ? r.delaisMinutes : ajusterDelais(n, r.delaisMinutes) })}
            />
            {r.delaisMinutes.map((d, i) => (
              <ChampNombre
                key={i}
                id={`relance-delai-${i}`}
                libelle={`Délai avant la ${ORDINAUX[i + 2]} tentative`}
                unite="min"
                min={5}
                max={1440}
                valeur={d}
                onChange={(n) => setRelance({ delaisMinutes: r.delaisMinutes.map((x, j) => (j === i ? n : x)) })}
              />
            ))}
          </div>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="relance-debut">Appels à partir de</label>
              <Input id="relance-debut" type="time" value={r.plageDebut} onChange={(e) => setRelance({ plageDebut: e.target.value })} className="w-36" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="relance-fin">Jusqu&apos;à</label>
              <Input id="relance-fin" type="time" value={r.plageFin} onChange={(e) => setRelance({ plageFin: e.target.value })} className="w-36" />
            </div>
          </div>
          <div className="flex min-h-11 items-center justify-between gap-4">
            <label htmlFor="relance-cercle" className="flex flex-col">
              <span>Appeler le cercle de proches après la dernière tentative</span>
              <span className="text-sm text-muted-foreground">Dans l&apos;ordre des rangs d&apos;appel.</span>
            </label>
            <Switch id="relance-cercle" checked={r.escaladeCercle} onCheckedChange={(c) => setRelance({ escaladeCercle: c })} />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t px-5 py-5 sm:px-6">
          <SousTitre>Anniversaires et mise à jour des fiches</SousTitre>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            <ChampNombre
              id="anniversaire-jours"
              libelle="Annoncer les anniversaires"
              aide="Nombre de jours avant la date"
              unite="jours"
              min={0}
              max={30}
              valeur={v.anniversaireJoursAvant}
              onChange={(n) => setV({ ...v, anniversaireJoursAvant: n })}
            />
            <ChampNombre
              id="verification-mois"
              libelle="Revérifier une fiche après"
              aide="Sans vérification pendant cette durée"
              unite="mois"
              min={1}
              max={60}
              valeur={v.verificationMois}
              onChange={(n) => setV({ ...v, verificationMois: n })}
            />
          </div>
        </div>

        <PiedFormulaire>
          <Button type="submit" variant="outline" disabled={enCours}>
            Enregistrer les relances et rappels
          </Button>
        </PiedFormulaire>
      </form>
    </Surface>
  );
}
