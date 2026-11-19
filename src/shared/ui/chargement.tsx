import { cn } from "@/lib/utils";

/**
 * Écran affiché instantanément pendant qu'une page se charge (fichiers `loading.tsx`).
 * Il permet aussi à Next de précharger les pages dynamiques au survol des liens.
 * Statique : aucune animation (DA).
 */
export function ChargementPage({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}
    >
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="h-8 w-64 max-w-full rounded-lg bg-muted" />
        <div className="h-5 w-96 max-w-full rounded-lg bg-muted" />
      </div>
      <div className="h-64 rounded-lg border bg-card" aria-hidden />
      <p className="text-muted-foreground">Chargement…</p>
    </div>
  );
}

/** Variante pour le contenu d'un onglet (la page autour reste affichée). */
export function ChargementBloc() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <div className="h-48 rounded-lg border bg-card" aria-hidden />
      <p className="text-muted-foreground">Chargement…</p>
    </div>
  );
}
