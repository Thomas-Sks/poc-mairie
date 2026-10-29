"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retirerPersonneAction } from "./actions";

export function BoutonRetirer({ benevoleId, beneficiaireId, nom }: { benevoleId: string; beneficiaireId: string; nom: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={enCours}
      aria-label={`Retirer ${nom} de la liste`}
      onClick={() =>
        demarrer(async () => {
          const r = await retirerPersonneAction({ benevoleId, beneficiaireId });
          if (r.ok) toast.success(`${nom} n'est plus confié(e) à ce bénévole.`);
          else toast.error(r.erreur);
        })
      }
    >
      Retirer
    </Button>
  );
}
