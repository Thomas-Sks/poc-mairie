"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EntreeNavigation } from "./navigation";

function estActif(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Liens({ entrees, onNavigate }: { entrees: EntreeNavigation[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {entrees.map((e) => {
        const actif = estActif(pathname, e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            onClick={onNavigate}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-muted-foreground hover:bg-background hover:text-foreground",
              actif && "bg-accent font-semibold text-primary hover:bg-accent hover:text-primary",
            )}
          >
            {e.libelle}
          </Link>
        );
      })}
    </nav>
  );
}

export function Marque({ commune, structure }: { commune: string; structure: string }) {
  return (
    <div className="flex flex-col px-3">
      <span className="font-bold leading-tight">{structure}</span>
      <span className="text-sm text-subtle-foreground">Registre des personnes vulnérables · {commune}</span>
    </div>
  );
}

/** Barre latérale fixe sur grand écran. */
export function MenuLateral({ entrees, commune, structure }: { entrees: EntreeNavigation[]; commune: string; structure: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
      <Marque commune={commune} structure={structure} />
      <Liens entrees={entrees} />
    </aside>
  );
}

/** Bouton « Menu » + tiroir sur mobile et tablette. */
export function MenuMobile({ entrees, commune, structure }: { entrees: EntreeNavigation[]; commune: string; structure: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Ouvrir le menu" className="lg:hidden" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-6 bg-card px-3 py-5">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Marque commune={commune} structure={structure} />
        <Liens entrees={entrees} onNavigate={() => setOuvert(false)} />
      </SheetContent>
    </Sheet>
  );
}
