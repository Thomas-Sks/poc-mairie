"use client";

/** E8-US7 — Indicateur de présence : qui consulte la même liste en ce moment (polling 2,5 s). */
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import type { Membre } from "./types";

export function IndicateurPresence({ ressource }: { ressource: string }) {
  const { data: presents = [] } = useQuery({
    queryKey: ["registre", "presence", ressource],
    queryFn: async () => {
      const r = await fetch("/api/registre/presence", { method: "POST", body: JSON.stringify({ ressource }) });
      return r.ok ? ((await r.json()) as Membre[]) : [];
    },
    refetchInterval: 2500,
  });
  if (presents.length === 0) return null;
  const noms = presents.map((m) => m.prenom);
  const texte = noms.length === 1 ? `${noms[0]} consulte aussi cette liste` : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)} consultent aussi cette liste`;
  return (
    <p role="status" className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground">
      <Users className="size-4 text-primary" aria-hidden />
      {texte}
    </p>
  );
}
