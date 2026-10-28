"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Mois = { libelle: string; appels: number; appelsAlerte: number; visites: number };

const AXE = { fontSize: 14, fill: "var(--muted-foreground)" };

const SERIES = [
  { cle: "appels", libelle: "Appels de suivi", couleur: "var(--chart-1)" },
  { cle: "appelsAlerte", libelle: "Appels d'alerte", couleur: "var(--chart-4)" },
  { cle: "visites", libelle: "Visites", couleur: "var(--chart-3)" },
] as const;

function InfoBulle({ active, payload }: { active?: boolean; payload?: { payload: Mois }[] }) {
  const m = payload?.[0]?.payload;
  if (!active || !m) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm">
      <p className="font-semibold">{m.libelle}</p>
      <p className="tabular">Appels de suivi : {m.appels}</p>
      <p className="tabular">Appels pendant une alerte : {m.appelsAlerte}</p>
      <p className="tabular">Visites : {m.visites}</p>
    </div>
  );
}

/** Contacts par mois sur 12 mois : suivi courant, appels d'alerte et visites empilés. Légende en HTML (passe à la ligne sur mobile). */
export function GraphiqueActivite({ mois }: { mois: Mois[] }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {SERIES.map((serie) => (
          <li key={serie.cle} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm" style={{ background: serie.couleur }} />
            {serie.libelle}
          </li>
        ))}
      </ul>
      <div className="min-h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={256}>
          <BarChart data={mois} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tick={AXE} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<InfoBulle />} isAnimationActive={false} cursor={{ fill: "var(--muted)" }} />
            {SERIES.map((serie, k) => (
              <Bar
                key={serie.cle}
                name={serie.libelle}
                dataKey={serie.cle}
                stackId="contacts"
                fill={serie.couleur}
                radius={k === SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
                isAnimationActive={false}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
