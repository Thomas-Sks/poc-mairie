"use client";

import { Button } from "@/components/ui/button";
import { Surface } from "@/shared/ui/elements";
import type { ReponseRegistre } from "../domain/reponse";

/** Réponse de l'assistant, posée au-dessus du tableau des bénéficiaires (une seule à la fois). */
export function ReponseQuestion({ reponse, poser }: { reponse: ReponseRegistre; poser: (question: string) => void }) {
  if (reponse.type === "recherche") return null;
  if (reponse.type === "message") {
    return (
      <div className="flex flex-col gap-2">
        <p>{reponse.phrase}</p>
        {reponse.suggestions.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {reponse.suggestions.map((s) => (
              <li key={s}>
                <Button variant="outline" className="h-auto min-h-11 py-2 text-left whitespace-normal" onClick={() => poser(s)}>
                  {s}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <Surface className="flex flex-col gap-3 p-5 sm:p-6">
      {/* Pour une liste, le nombre de personnes est déjà affiché au-dessus du tableau. */}
      {reponse.type === "chiffre" && <p className="tabular text-2xl font-bold">{reponse.phrase}</p>}
      {reponse.compris.length > 0 && <p className="text-muted-foreground">J&apos;ai compris : {reponse.compris.join(" · ")}</p>}
      {reponse.lignes.length > 0 && (
        <ul className={reponse.type === "chiffre" ? "flex flex-col gap-3 border-t pt-4" : "flex flex-col gap-3"}>
          {reponse.lignes.map((l) => (
            <li key={l.libelle} className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3">
              <span className="truncate">{l.libelle}</span>
              <span className="h-3 rounded-sm bg-accent" aria-hidden>
                <span className="block h-full rounded-sm bg-primary" style={{ width: `${Math.round(l.part * 100)}%` }} />
              </span>
              <span className="tabular font-semibold">{l.effectif}</span>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
