"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ResultatAction } from "./actions";

/** Envoie une Server Action et affiche le résultat dans un toast. */
export function useEnvoi() {
  const [enCours, demarrer] = useTransition();
  const envoyer = (action: () => Promise<ResultatAction>, apres?: () => void) =>
    demarrer(async () => {
      const r = await action();
      if (r.ok) {
        toast.success(r.message);
        apres?.();
      } else toast.error(r.message);
    });
  return { enCours, envoyer };
}

/** Ligne « libellé … [ nombre ] unité », alignée, sans boîte. */
export function ChampNombre({
  id,
  libelle,
  valeur,
  onChange,
  min = 0,
  max = 100,
  unite,
  aide,
}: {
  id: string;
  libelle: ReactNode;
  valeur: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unite?: string;
  aide?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span>{libelle}</span>
        {aide && <span className="text-sm text-muted-foreground">{aide}</span>}
      </label>
      <span className="flex shrink-0 items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isNaN(valeur) ? "" : valeur}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className="w-20 text-right tabular"
        />
        {unite && <span className="w-10 text-sm text-muted-foreground">{unite}</span>}
      </span>
    </div>
  );
}

/** Pied de formulaire séparé par un filet, boutons alignés à droite. */
export function PiedFormulaire({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-3 border-t px-5 py-4 sm:px-6", className)}>{children}</div>;
}

export function SousTitre({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold">{children}</h3>;
}
