"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BoutonImprimer() {
  return (
    <Button size="lg" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      Imprimer / PDF
    </Button>
  );
}
