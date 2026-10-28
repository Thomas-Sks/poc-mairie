/**
 * E12-US6 — Export CSV d'un tableau (séparateur « ; » et BOM UTF-8 : s'ouvre correctement dans Excel en français).
 */
export type CelluleCsv = string | number | null;

function echapper(v: CelluleCsv): string {
  if (v === null) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function versCsv(entetes: string[], lignes: CelluleCsv[][]): string {
  return "﻿" + [entetes, ...lignes].map((l) => l.map(echapper).join(";")).join("\r\n");
}

/** Nom de fichier sûr à partir d'un titre (« Population suivie » → « population-suivie.csv »). */
export function nomFichierCsv(titre: string): string {
  const base = titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "statistiques"}.csv`;
}
