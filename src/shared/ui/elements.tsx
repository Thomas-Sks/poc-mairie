/**
 * Éléments de mise en page partagés.
 *
 * Règle « pas de boîtes imbriquées » : une page = fond sable + des surfaces blanches posées DIRECTEMENT
 * dessus (`Surface`). On ne met jamais une Surface (ou toute boîte bordée/colorée) dans une autre :
 * à l'intérieur d'une surface, on hiérarchise avec des titres, de l'espace et des séparateurs (`divide-y`).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { NiveauPriorite, Ton } from "@/shared/domain/vocabulaire";

export function EnTetePage({
  titre,
  description,
  actions,
  retour,
}: {
  titre: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  retour?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {retour}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.01em]">{titre}</h1>
          {description && <p className="max-w-[65ch] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

/** Surface blanche bordée, posée directement sur le fond de page. Jamais imbriquée. */
export function Surface({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-lg border bg-card", className)} {...props}>
      {children}
    </section>
  );
}

/** Section titrée sans boîte (à utiliser dans une Surface ou sur le fond). */
export function Section({
  titre,
  actions,
  children,
  className,
}: {
  titre: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{titre}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Libelle({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-subtle-foreground", className)}>{children}</span>;
}

const TONS: Record<Ton, string> = {
  neutre: "bg-muted text-muted-foreground",
  accent: "bg-accent text-primary",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  err: "bg-err-soft text-err",
};

/** Pastille de statut (le seul élément en arrondi complet de la DA). */
export function Pastille({ ton, children, className }: { ton: Ton; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold",
        "before:size-1.5 before:rounded-full before:bg-current before:content-['']",
        TONS[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

const TON_PRIORITE: Record<NiveauPriorite, Ton> = { P1: "err", P2: "warn", P3: "neutre" };

export function PastillePriorite({ niveau, score }: { niveau: NiveauPriorite; score?: number }) {
  return (
    <Pastille ton={TON_PRIORITE[niveau]}>
      {niveau}
      {score !== undefined && <span className="tabular font-medium opacity-80">· {score}</span>}
    </Pastille>
  );
}

/** Bandeau d'information (ex. informations prioritaires E5-US4). Pleine largeur, jamais dans une Surface. */
export function Bandeau({ ton = "warn", children, className }: { ton?: Exclude<Ton, "neutre">; children: ReactNode; className?: string }) {
  return (
    <div role="note" className={cn("rounded-lg px-4 py-3 font-medium", TONS[ton], className)}>
      {children}
    </div>
  );
}

export function EtatVide({ titre, description, action }: { titre: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-10">
      <p className="font-semibold">{titre}</p>
      {description && <p className="max-w-[65ch] text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

/** Liste libellé / valeur, alignée, sans boîte. */
export function Proprietes({ items, className }: { items: { libelle: string; valeur: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,auto)_1fr]", className)}>
      {items.map((it) => (
        <div key={it.libelle} className="contents">
          <dt className="text-sm text-muted-foreground">{it.libelle}</dt>
          <dd className="max-sm:-mt-2.5">{it.valeur ?? <span className="text-subtle-foreground">Non renseigné</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Conteneur de page standard (largeur, gouttières, espacement vertical entre blocs). */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>{children}</div>;
}
