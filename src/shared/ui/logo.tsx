import { HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Logo du registre : pictogramme « entraide » et sigle CCAS (centre communal d'action sociale).
 * Emblème générique, sans reprendre de marque déposée.
 */
export function LogoCcas({ commune, className }: { commune: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} role="img" aria-label={`CCAS de ${commune} – registre des personnes vulnérables`}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
        <HeartHandshake className="size-6" />
      </span>
      <span className="text-2xl font-bold tracking-wide text-primary" aria-hidden>
        CCAS
      </span>
    </div>
  );
}
