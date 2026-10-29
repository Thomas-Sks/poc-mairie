"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoCcas } from "./logo";
import type { EntreeNavigation } from "./navigation";

function estActif(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Nombre affiché en pastille rouge à côté d'une entrée (ex. inscriptions à valider). */
export type Pastilles = Partial<Record<string, number>>;

function Liens({ entrees, pastilles, onNavigate }: { entrees: EntreeNavigation[]; pastilles: Pastilles; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {entrees.map((e) => {
        const actif = estActif(pathname, e.href);
        const n = pastilles[e.href] ?? 0;
        return (
          <Link
            key={e.href}
            href={e.href}
            onClick={onNavigate}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-muted-foreground hover:bg-background hover:text-foreground",
              actif && "bg-accent font-semibold text-primary hover:bg-accent hover:text-primary",
            )}
          >
            {e.libelle}
            {n > 0 && (
              <span className="tabular min-w-6 rounded-full bg-err px-2 text-center text-sm font-bold text-white" aria-label={`${n} nouvelle${n > 1 ? "s" : ""}`}>
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre latérale fixe sur grand écran. */
export function MenuLateral({ entrees, pastilles, commune }: { entrees: EntreeNavigation[]; pastilles: Pastilles; commune: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
      <LogoCcas commune={commune} className="px-3" />
      <Liens entrees={entrees} pastilles={pastilles} />
    </aside>
  );
}

/** Bouton « Menu » + tiroir sur mobile et tablette. */
export function MenuMobile({ entrees, pastilles, commune }: { entrees: EntreeNavigation[]; pastilles: Pastilles; commune: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Ouvrir le menu" className="relative lg:hidden" />}>
        <Menu className="size-5" />
        {Object.values(pastilles).some((n) => (n ?? 0) > 0) && <span className="absolute -top-1 -right-1 size-3 rounded-full bg-err" aria-hidden />}
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-6 bg-card px-3 py-5">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <LogoCcas commune={commune} className="px-3" />
        <Liens entrees={entrees} pastilles={pastilles} onNavigate={() => setOuvert(false)} />
      </SheetContent>
    </Sheet>
  );
}
