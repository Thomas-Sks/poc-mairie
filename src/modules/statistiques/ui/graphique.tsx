"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TypeGraphique } from "../domain/catalogue";
import { formaterEffectif, type ResultatAffiche } from "../domain/secret";
import type { QuartierCarte } from "../application/ports";

const CarteQuartiers = dynamic(() => import("./carte-quartiers").then((m) => m.CarteQuartiers), {
  ssr: false,
  loading: () => <div className="h-full min-h-48 bg-muted" aria-hidden />,
});

/** Couleurs de la DA, dans un ordre fixe qui alterne clair et foncé pour bien séparer les parts voisines. */
export const COULEURS_CATEGORIES = ["var(--chart-1)", "var(--chart-4)", "var(--chart-2)", "var(--chart-5)", "var(--chart-3)"];
const COULEUR_PERIODE = "var(--chart-1)";
const COULEUR_COMPARAISON = "var(--chart-2)";

const AXE = { fontSize: 14, fill: "var(--muted-foreground)" };

type Point = { libelle: string; valeur: number; etiquette: string; comparaison: number; etiquetteComparaison: string; libelleComparaison?: string };

function points(r: ResultatAffiche): Point[] {
  return r.lignes.map((l) => ({
    libelle: l.libelle,
    valeur: l.n ?? 0,
    etiquette: formaterEffectif(l.n),
    comparaison: l.nComparaison ?? 0,
    etiquetteComparaison: l.nComparaison === null ? "" : formaterEffectif(l.nComparaison),
    libelleComparaison: l.libelleComparaison,
  }));
}

function InfoBulle({ active, payload, comparer }: { active?: boolean; payload?: { payload: Point }[]; comparer: boolean }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm">
      <p className="font-semibold">{p.libelle}</p>
      <p className="tabular">
        {comparer ? "Période : " : ""}
        {p.etiquette}
      </p>
      {comparer && (
        <p className="tabular text-muted-foreground">
          Comparaison{p.libelleComparaison ? ` (${p.libelleComparaison})` : ""} : {p.etiquetteComparaison}
        </p>
      )}
    </div>
  );
}

export function Graphique({
  resultat,
  type,
  quartiers,
  hauteur,
  libellesSeries = ["Période", "Comparaison"],
}: {
  resultat: ResultatAffiche;
  type: TypeGraphique;
  quartiers?: QuartierCarte[];
  /** Hauteur fixe ; sinon le graphique remplit son conteneur. */
  hauteur?: number;
  libellesSeries?: [string, string];
}) {
  const data = points(resultat);
  const comparer = resultat.totalComparaison !== null;
  const h = hauteur ?? "100%";

  if (type === "carte") {
    return (
      <div style={{ height: hauteur ?? "100%" }} className="min-h-48 overflow-hidden rounded-lg">
        <CarteQuartiers quartiers={quartiers ?? []} lignes={resultat.lignes} />
      </div>
    );
  }

  if (type === "camembert") {
    return (
      <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center" style={{ height: hauteur }}>
        <div className="aspect-square h-full max-h-64 min-h-40 self-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="valeur" nameKey="libelle" innerRadius="55%" outerRadius="95%" stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COULEURS_CATEGORIES[i % COULEURS_CATEGORIES.length]} />
                ))}
              </Pie>
              <Tooltip content={<InfoBulle comparer={false} />} isAnimationActive={false} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-col gap-2">
          {data.map((p, i) => (
            <li key={p.libelle} className="flex items-center gap-2">
              <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: COULEURS_CATEGORIES[i % COULEURS_CATEGORIES.length] }} />
              <span>{p.libelle}</span>
              <span className="tabular font-semibold">{p.etiquette}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (type === "courbe") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="libelle" tick={AXE} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
          <YAxis allowDecimals={false} tick={AXE} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<InfoBulle comparer={comparer} />} isAnimationActive={false} cursor={{ stroke: "var(--input)" }} />
          {comparer && <Legend verticalAlign="top" height={32} iconType="plainline" wrapperStyle={{ fontSize: 14 }} />}
          <Line
            name={libellesSeries[0]}
            dataKey="valeur"
            stroke={COULEUR_PERIODE}
            strokeWidth={2}
            dot={{ r: 3, fill: COULEUR_PERIODE, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          {comparer && (
            <Line
              name={libellesSeries[1]}
              dataKey="comparaison"
              stroke={COULEUR_COMPARAISON}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Barres horizontales : libellés lisibles même longs, et sur mobile.
  const hauteurBarres = hauteur ?? "100%";
  const largeurLibelles = Math.min(150, Math.max(40, ...data.map((p) => p.libelle.length * 7.5 + 12)));
  return (
    <ResponsiveContainer width="100%" height={hauteurBarres}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={comparer ? "20%" : "25%"} barGap={2}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={AXE} tickLine={false} axisLine={false} hide />
        <YAxis type="category" dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} width={largeurLibelles} interval={0} />
        <Tooltip content={<InfoBulle comparer={comparer} />} isAnimationActive={false} cursor={{ fill: "var(--muted)" }} />
        {comparer && <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 14 }} />}
        <Bar name={libellesSeries[0]} dataKey="valeur" fill={COULEUR_PERIODE} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
          <LabelList dataKey="etiquette" position="right" style={{ fontSize: 14, fill: "var(--foreground)" }} />
        </Bar>
        {comparer && (
          <Bar name={libellesSeries[1]} dataKey="comparaison" fill={COULEUR_COMPARAISON} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
            <LabelList dataKey="etiquetteComparaison" position="right" style={{ fontSize: 14, fill: "var(--muted-foreground)" }} />
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Hauteur conseillée pour un graphique en barres horizontales. */
export function hauteurBarres(nbLignes: number, comparer: boolean): number {
  return Math.max(160, nbLignes * (comparer ? 56 : 40) + (comparer ? 40 : 8));
}
