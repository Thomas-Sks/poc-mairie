"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reinitialiserDemoAction } from "./actions";

/** §10.2 : bouton « Réinitialiser la démo », avec une confirmation intégrée à la page. */
export function ReinitialiserDemo() {
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, demarrer] = useTransition();

  const reinitialiser = () =>
    demarrer(async () => {
      // En cas de succès, l'action redirige vers l'accueil.
      const r = await reinitialiserDemoAction();
      if (!r.ok) toast.error(r.message);
    });

  if (!confirmation) {
    return (
      <Button variant="destructive" onClick={() => setConfirmation(true)} className="self-start">
        <RotateCcw aria-hidden />
        Réinitialiser la démo
      </Button>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby="confirmation-demo" className="flex flex-col gap-3 border-t pt-4">
      <p id="confirmation-demo" className="font-semibold">
        Toutes les données saisies seront effacées et remplacées par le jeu de démonstration. Confirmez-vous ?
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="destructive" onClick={reinitialiser} disabled={enCours} autoFocus>
          {enCours ? "Réinitialisation en cours…" : "Oui, réinitialiser la démo"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirmation(false)} disabled={enCours}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
