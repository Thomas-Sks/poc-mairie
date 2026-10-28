"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Liste déroulante native : lisible, accessible, adaptée au tactile. */
export function ListeDeroulante({
  options,
  className,
  ...props
}: Omit<ComponentProps<"select">, "children"> & { options: { valeur: string; libelle: string }[] }) {
  return (
    <select className={cn("h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base", className)} {...props}>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  );
}

export function ChampDate(props: ComponentProps<"input">) {
  return <input type="date" {...props} className={cn("h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base", props.className)} />;
}

/** Bouton bascule (choix exclusif dans un groupe) : état actif en accent léger. */
export function Bascule({ actif, className, ...props }: ComponentProps<"button"> & { actif: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-base font-medium [&_svg]:size-4",
        actif ? "border-primary bg-accent text-primary" : "border-input bg-card hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

const ONGLETS = [
  { href: "/statistiques", libelle: "Vue d'ensemble" },
  { href: "/statistiques/explorateur", libelle: "Explorateur" },
  { href: "/statistiques/tableaux-de-bord", libelle: "Tableaux de bord" },
  { href: "/statistiques/requetes", libelle: "Requêtes enregistrées" },
] as const;

/** Sous-navigation du module, posée sur le fond (pas dans une surface). */
export function SousNavigation({ actif }: { actif: (typeof ONGLETS)[number]["href"] }) {
  return (
    <nav aria-label="Statistiques" className="-mb-2 flex gap-1 overflow-x-auto border-b">
      {ONGLETS.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.href === actif ? "page" : undefined}
          className={cn(
            "-mb-px flex h-11 shrink-0 items-center border-b-2 px-3 font-medium",
            o.href === actif ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {o.libelle}
        </Link>
      ))}
    </nav>
  );
}
