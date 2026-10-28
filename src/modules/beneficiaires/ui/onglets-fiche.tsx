"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ONGLETS: { segment: string; libelle: string; court?: string }[] = [
  { segment: "", libelle: "Infos" },
  { segment: "/cercle", libelle: "Cercle" },
  { segment: "/intervenants", libelle: "Intervenants et planning", court: "Intervenants" },
  { segment: "/indisponibilites", libelle: "Indisponibilités" },
  { segment: "/historique", libelle: "Historique" },
];

/** Onglets de la fiche, en sous-routes (lien partageable, bouton retour du navigateur). */
export function OngletsFiche({ beneficiaireId, compteurs }: { beneficiaireId: string; compteurs: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  const base = `/beneficiaires/${beneficiaireId}`;
  return (
    <nav aria-label="Sections de la fiche" className="border-b">
      {/* Mobile : les onglets passent à la ligne plutôt que de défiler hors de l'écran. */}
      <ul className="flex flex-wrap gap-x-1">
        {ONGLETS.map((o) => {
          const href = `${base}${o.segment}`;
          const actif = o.segment === "" ? pathname === base || pathname.startsWith(`${base}/appels-ia`) : pathname.startsWith(href);
          const compteur = compteurs[o.segment];
          return (
            <li key={o.segment}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-12 items-center gap-2 border-b-2 border-transparent px-3 font-medium text-muted-foreground hover:text-foreground",
                  actif && "border-primary font-semibold text-primary hover:text-primary",
                )}
              >
                {o.court ? (
                  <>
                    <span className="sm:hidden">{o.court}</span>
                    <span className="max-sm:hidden">{o.libelle}</span>
                  </>
                ) : (
                  o.libelle
                )}
                {compteur !== undefined && compteur > 0 && <span className="tabular text-sm text-subtle-foreground">{compteur}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
