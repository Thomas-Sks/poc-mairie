"use client";

import { useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { REPORT_LIBELLES, REPORTS } from "../domain/taches-du-jour";
import { marquerRappelFaitAction, reporterRappelAction, type ResultatAction } from "./actions";

/** Actions d'un rappel : « Fait » (action directe) et « Reporter » (menu de délais). */
export function ActionsRappel({ id, objet }: { id: string; objet: string }) {
  const [enCours, demarrer] = useTransition();

  const lancer = (action: () => Promise<ResultatAction>) =>
    demarrer(async () => {
      const r = await action();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" disabled={enCours} onClick={() => lancer(() => marquerRappelFaitAction(id))} aria-label={`Marquer comme fait : ${objet}`}>
        <Check aria-hidden />
        Fait
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" disabled={enCours} aria-label={`Reporter : ${objet}`}>
              Reporter
              <ChevronDown aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          {REPORTS.map((r) => (
            <DropdownMenuItem key={r} className="min-h-11 px-3 text-base" onClick={() => lancer(() => reporterRappelAction(id, r))}>
              {REPORT_LIBELLES[r]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
