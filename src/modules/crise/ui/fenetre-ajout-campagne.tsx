"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { alertesEnCoursAction, campagneDepuisSelectionAction } from "./actions";

type Proprietes = { ids: string[]; ouvert: boolean; fermer: () => void };

const NOUVELLE = "nouvelle";

/**
 * « Ajouter à une campagne » depuis le tableau : crée une campagne sur la sélection, rattachée à une alerte en cours
 * ou à une nouvelle alerte (ex. inondation d'une rue), la sélection étant conservée pendant le déclenchement.
 */
export function FenetreAjoutCampagne({ ids, ouvert, fermer }: Proprietes) {
  const [alertes, setAlertes] = useState<{ id: string; libelle: string }[] | null>(null);
  const [peutDeclencher, setPeutDeclencher] = useState(false);
  const [alerteId, setAlerteId] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (!ouvert) return;
    alertesEnCoursAction().then((r) => {
      const liste = r.ok ? r.alertes : [];
      const declencher = r.ok && r.peutDeclencher;
      setAlertes(liste);
      setPeutDeclencher(declencher);
      setAlerteId(liste[0]?.id ?? (declencher ? NOUVELLE : ""));
    });
  }, [ouvert]);

  const valider = () =>
    demarrer(async () => {
      const r = await campagneDepuisSelectionAction({ alerteId, ids });
      if (r && !r.ok) setErreur(r.erreur);
    });

  const nb = `${ids.length} personne${ids.length > 1 ? "s" : ""}`;
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && fermer()}>
      <DialogContent className="gap-4 p-6 text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Ajouter à une campagne</DialogTitle>
          <DialogDescription className="text-base">
            Une campagne d&apos;appels sera préparée pour les {nb} sélectionnées.
          </DialogDescription>
        </DialogHeader>
        {alertes === null ? (
          <p className="text-muted-foreground">Chargement des alertes…</p>
        ) : alertes.length === 0 && !peutDeclencher ? (
          <p>Aucune alerte n&apos;est en cours. Demandez à un administrateur de déclencher l&apos;alerte, puis revenez ici.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="alerte-campagne" className="text-sm font-semibold">
              Alerte concernée
            </label>
            <select
              id="alerte-campagne"
              value={alerteId}
              onChange={(e) => setAlerteId(e.target.value)}
              className="h-11 rounded-lg border border-input bg-card px-3"
            >
              {alertes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
              {peutDeclencher && <option value={NOUVELLE}>Déclencher une nouvelle alerte (inondation, tempête…)</option>}
            </select>
          </div>
        )}
        {erreur && <p className="text-err">{erreur}</p>}
        <DialogFooter className="-mx-6 -mb-6 bg-card p-4">
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={!alerteId || enCours}>
            {alerteId === NOUVELLE ? "Déclencher l'alerte" : "Préparer la campagne"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
