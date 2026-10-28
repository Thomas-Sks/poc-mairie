"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DECOUPAGES } from "../domain/catalogue";
import { nomFichierCsv, versCsv } from "../domain/csv";
import { evolution } from "../domain/resultat";
import { formaterEffectif, type ResultatAffiche } from "../domain/secret";

const enCellule = (n: number | null) => (n === null ? `< 5` : n);

/** E12-US6 : export CSV côté navigateur. */
export function telechargerCsv(titre: string, r: ResultatAffiche, libellesSeries: [string, string]) {
  const comparer = r.totalComparaison !== null;
  const titreColonne = r.decoupage ? DECOUPAGES[r.decoupage].libelle : "Total";
  const entetes = comparer ? [titreColonne, libellesSeries[0], libellesSeries[1]] : [titreColonne, "Effectif"];
  const lignes = r.lignes.map((l) => (comparer ? [l.libelle, enCellule(l.n), enCellule(l.nComparaison)] : [l.libelle, enCellule(l.n)]));
  lignes.push(comparer ? ["Total", enCellule(r.total), enCellule(r.totalComparaison)] : ["Total", enCellule(r.total)]);
  const blob = new Blob([versCsv(entetes, lignes)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichierCsv(titre);
  a.click();
  URL.revokeObjectURL(url);
}

export function BoutonCsv({ titre, resultat, libellesSeries = ["Période", "Comparaison"], compact }: { titre: string; resultat: ResultatAffiche; libellesSeries?: [string, string]; compact?: boolean }) {
  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size={compact ? "icon" : "default"}
      onClick={() => telechargerCsv(titre, resultat, libellesSeries)}
      aria-label={compact ? `Exporter « ${titre} » en CSV` : undefined}
      title="Exporter en CSV"
    >
      <Download aria-hidden />
      {!compact && "Exporter en CSV"}
    </Button>
  );
}

/** Tableau croisé : une ligne par catégorie, total, et colonnes de comparaison si besoin. */
export function TableauResultat({ resultat, libellesSeries = ["Période", "Comparaison"] }: { resultat: ResultatAffiche; libellesSeries?: [string, string] }) {
  const comparer = resultat.totalComparaison !== null;
  const multi = resultat.decoupage ? DECOUPAGES[resultat.decoupage].multiValeur : false;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-left">
        <thead>
          <tr className="border-b text-sm text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-semibold">
              {resultat.decoupage ? DECOUPAGES[resultat.decoupage].libelle : ""}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">
              {comparer ? libellesSeries[0] : "Effectif"}
            </th>
            {comparer && (
              <>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  {libellesSeries[1]}
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Évolution
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {resultat.lignes.map((l) => {
            const evo = l.n !== null && l.nComparaison !== null ? evolution(l.n, l.nComparaison) : null;
            return (
              <tr key={l.cle}>
                <th scope="row" className="py-2 pr-4 font-normal">
                  {l.libelle}
                  {l.libelleComparaison && <span className="text-sm text-muted-foreground"> / {l.libelleComparaison}</span>}
                </th>
                <td className="tabular py-2 pr-4 text-right font-semibold">{formaterEffectif(l.n)}</td>
                {comparer && (
                  <>
                    <td className="tabular py-2 pr-4 text-right">{l.nComparaison === null ? "< 5" : formaterEffectif(l.nComparaison)}</td>
                    <td className="tabular py-2 text-right text-muted-foreground">{evo === null ? "–" : `${evo > 0 ? "+" : ""}${evo} %`}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2">
            <th scope="row" className="py-2 pr-4 font-semibold">
              Total{multi ? " (sans doublon)" : ""}
            </th>
            <td className="tabular py-2 pr-4 text-right font-bold">{formaterEffectif(resultat.total)}</td>
            {comparer && (
              <>
                <td className="tabular py-2 pr-4 text-right font-semibold">{formaterEffectif(resultat.totalComparaison)}</td>
                <td />
              </>
            )}
          </tr>
        </tfoot>
      </table>
      {multi && <p className="mt-2 text-sm text-muted-foreground">Une même personne peut compter dans plusieurs lignes.</p>}
    </div>
  );
}
