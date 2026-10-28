/**
 * NF-07 : export de secours de la liste de campagne (CSV lisible par Excel en français). Fonction pure.
 */
export type LigneExport = Record<string, string | number | null | undefined>;

const echapper = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Séparateur « ; » et BOM UTF-8 pour une ouverture directe dans Excel. */
export function versCsv(colonnes: string[], lignes: LigneExport[]): string {
  const entete = colonnes.map(echapper).join(";");
  const corps = lignes.map((l) => colonnes.map((c) => echapper(l[c])).join(";"));
  return `﻿${[entete, ...corps].join("\r\n")}\r\n`;
}
