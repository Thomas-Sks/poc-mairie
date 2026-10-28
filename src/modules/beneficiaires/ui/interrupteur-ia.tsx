"use client";
import { useOptimistic, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { definirAssistantIaAction } from "./actions";
import { lancer } from "./champs";

/** E11-US1 (maquette) : activation de l'assistant IA fiche par fiche, impossible sans consentement. */
export function InterrupteurIa({ beneficiaireId, active, consentement, modifiable }: { beneficiaireId: string; active: boolean; consentement: boolean; modifiable: boolean }) {
  const [enCours, demarrer] = useTransition();
  const [affiche, setAffiche] = useOptimistic(active);
  const desactive = !modifiable || !consentement || enCours;
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 has-disabled:cursor-not-allowed">
      <span className="flex flex-col">
        <span className="font-medium">IA activée</span>
        <span className="text-sm text-muted-foreground">
          {consentement ? "La personne peut être appelée par l'assistant pendant une alerte." : "Impossible sans le consentement de la personne."}
        </span>
      </span>
      <Switch
        checked={affiche}
        disabled={desactive}
        aria-label="Appels par l'assistant IA"
        onCheckedChange={(valeur) =>
          demarrer(async () => {
            setAffiche(valeur);
            await lancer(() => definirAssistantIaAction(beneficiaireId, valeur));
          })
        }
      />
    </label>
  );
}
