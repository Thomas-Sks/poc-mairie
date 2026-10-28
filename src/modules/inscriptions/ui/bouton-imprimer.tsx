"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BoutonImprimer({ libelle = "Imprimer" }: { libelle?: string }) {
  return (
    <Button size="lg" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      {libelle}
    </Button>
  );
}
