"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Champ de formulaire : libellé associé, aide facultative. */
export function Champ({ id, libelle, aide, children, className }: { id: string; libelle: ReactNode; aide?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="font-medium">
        {libelle}
      </label>
      {children}
      {aide && <p className="text-sm text-muted-foreground">{aide}</p>}
    </div>
  );
}

export const classeSelect = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base";

/** Choix exclusif sous forme de boutons segmentés (≥ 44 px), accessible comme un groupe radio. */
export function ChoixSegmente<T extends string>({
  nom,
  libelle,
  options,
  valeur,
  onChange,
}: {
  nom: string;
  libelle: string;
  options: { valeur: T; libelle: ReactNode }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{libelle}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.valeur}
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 font-medium has-focus-visible:outline-3 has-focus-visible:outline-ring",
              valeur === o.valeur && "border-primary bg-accent text-primary",
            )}
          >
            <input type="radio" name={nom} value={o.valeur} checked={valeur === o.valeur} onChange={() => onChange(o.valeur)} className="sr-only" />
            {o.libelle}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
