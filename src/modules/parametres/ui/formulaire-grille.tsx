"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRILLE_PAR_DEFAUT, type GrilleScore } from "@/shared/domain/priorite";
import { Surface } from "@/shared/ui/elements";
import { CRITERES_DEPLACEMENT, CRITERES_GRILLE } from "../domain/parametres";
import { enregistrerGrilleEtRecalculerAction } from "./actions";
import { ChampNombre, PiedFormulaire, SousTitre, useEnvoi } from "./champs";

/** RG-01 / E13-US6 : pondérations des critères et seuils P1/P2. */
export function FormulaireGrille({ initiale }: { initiale: GrilleScore }) {
  const [g, setG] = useState<GrilleScore>(initiale);
  const { enCours, envoyer } = useEnvoi();

  return (
    <Surface>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(() => enregistrerGrilleEtRecalculerAction(g));
        }}
      >
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <SousTitre>Points par critère</SousTitre>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {CRITERES_GRILLE.map((c) => (
              <ChampNombre key={c.cle} id={`grille-${c.cle}`} libelle={c.libelle} unite="pts" valeur={g[c.cle]} onChange={(n) => setG({ ...g, [c.cle]: n })} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t px-5 py-5 sm:px-6">
          <SousTitre>Mobilité dans le domicile</SousTitre>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {CRITERES_DEPLACEMENT.map((c) => (
              <ChampNombre
                key={c.cle}
                id={`grille-deplacement-${c.cle}`}
                libelle={c.libelle}
                unite="pts"
                valeur={g.deplacement[c.cle]}
                onChange={(n) => setG({ ...g, deplacement: { ...g.deplacement, [c.cle]: n } })}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t px-5 py-5 sm:px-6">
          <SousTitre>Seuils de priorité</SousTitre>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            <ChampNombre id="grille-seuil-p1" libelle="Priorité 1 à partir de" unite="pts" min={1} valeur={g.seuilP1} onChange={(n) => setG({ ...g, seuilP1: n })} />
            <ChampNombre id="grille-seuil-p2" libelle="Priorité 2 à partir de" unite="pts" min={1} valeur={g.seuilP2} onChange={(n) => setG({ ...g, seuilP2: n })} />
          </div>
          <p className="text-sm text-muted-foreground">
            En dessous du seuil P2, la fiche est en priorité 3. Le score est plafonné à 100. Un niveau forcé sur une fiche reste prioritaire.
          </p>
        </div>

        <PiedFormulaire>
          <Button type="button" variant="ghost" onClick={() => setG(GRILLE_PAR_DEFAUT)} disabled={enCours}>
            <RotateCcw aria-hidden />
            Rétablir les valeurs par défaut
          </Button>
          <Button type="submit" disabled={enCours}>
            {enCours ? "Recalcul en cours…" : "Enregistrer et recalculer les scores"}
          </Button>
        </PiedFormulaire>
      </form>
    </Surface>
  );
}
