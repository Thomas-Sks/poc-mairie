"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Mois = { libelle: string; appels: number; appelsAlerte: number; visites: number };

const AXE = { fontSize: 14, fill: "var(--muted-foreground)" };

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

/** Contacts par mois sur 12 mois : suivi courant, appels d'alerte et visites empilés. */
export function GraphiqueActivite({ mois }: { mois: Mois[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={256}>
      <BarChart data={mois} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" minTickGap={8} />
        <YAxis allowDecimals={false} tick={AXE} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<InfoBulle />} isAnimationActive={false} cursor={{ fill: "var(--muted)" }} />
        <Legend verticalAlign="top" align="right" height={32} iconType="square" wrapperStyle={{ fontSize: 14 }} />
        <Bar name="Appels de suivi" dataKey="appels" stackId="contacts" fill="var(--chart-1)" isAnimationActive={false} maxBarSize={36} />
        <Bar name="Appels d'alerte" dataKey="appelsAlerte" stackId="contacts" fill="var(--chart-4)" isAnimationActive={false} maxBarSize={36} />
        <Bar name="Visites" dataKey="visites" stackId="contacts" fill="var(--chart-3)" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
