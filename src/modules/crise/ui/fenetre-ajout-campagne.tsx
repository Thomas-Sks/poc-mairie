"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { alertesEnCoursAction, campagneDepuisSelectionAction } from "./actions";

type Proprietes = { ids: string[]; ouvert: boolean; fermer: () => void };

/** « Ajouter à une campagne » depuis le tableau : crée une campagne sur la sélection, rattachée à une alerte en cours. */
export function FenetreAjoutCampagne({ ids, ouvert, fermer }: Proprietes) {
  const [alertes, setAlertes] = useState<{ id: string; libelle: string }[] | null>(null);
  const [alerteId, setAlerteId] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (!ouvert) return;
    alertesEnCoursAction().then((r) => {
      const liste = r.ok ? r.alertes : [];
      setAlertes(liste);
      setAlerteId(liste[0]?.id ?? "");
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
        ) : alertes.length === 0 ? (
          <p>Aucune alerte n&apos;est en cours. Déclenchez d&apos;abord une alerte, puis revenez ici.</p>
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
            </select>
          </div>
        )}
        {erreur && <p className="text-err">{erreur}</p>}
        <DialogFooter className="-mx-6 -mb-6 bg-card p-4">
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          {alertes?.length === 0 ? (
            <Link href="/alertes/nouvelle" className={buttonVariants()}>
              Déclencher une alerte
            </Link>
          ) : (
            <Button onClick={valider} disabled={!alerteId || enCours}>
              Préparer la campagne
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
