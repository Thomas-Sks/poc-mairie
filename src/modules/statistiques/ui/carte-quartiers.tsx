"use client";

import "./grille.css";
import { MapContainer, Polygon, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import { formaterEffectif, type LigneAffichee } from "../domain/secret";
import type { QuartierCarte } from "../application/ports";

/** Teinte unique (accent de la DA) : l'intensité porte l'effectif. Leaflet exige une couleur littérale. */
const ACCENT = "#1d6670";

/** Carte de densité par quartier (choroplèthe), étiquette permanente « Quartier · effectif ». */
export function CarteQuartiers({ quartiers, lignes }: { quartiers: QuartierCarte[]; lignes: LigneAffichee[] }) {
  if (!quartiers.length) return <p className="p-4 text-muted-foreground">Aucun quartier n&apos;est défini pour la commune.</p>;
  const max = Math.max(1, ...lignes.map((l) => l.n ?? 0));
  const formes = quartiers.map((q) => ({ ...q, points: q.contour.map(([lon, lat]) => [lat, lon] as LatLngTuple) }));
  const tous = formes.flatMap((q) => q.points);
  const bornes: LatLngBoundsExpression = [
    [Math.min(...tous.map((p) => p[0])), Math.min(...tous.map((p) => p[1]))],
    [Math.max(...tous.map((p) => p[0])), Math.max(...tous.map((p) => p[1]))],
  ];

  return (
    <MapContainer bounds={bornes} scrollWheelZoom={false} zoomControl={false} attributionControl className="z-0 size-full" style={{ minHeight: 192 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      {formes.map((q) => {
        const ligne = lignes.find((l) => l.cle === q.nom);
        const n = ligne?.n ?? 0;
        const intensite = ligne?.n === null ? 0.15 : 0.08 + 0.62 * (n / max);
        return (
          <Polygon key={q.nom} positions={q.points} pathOptions={{ color: ACCENT, weight: 1.5, fillColor: ACCENT, fillOpacity: intensite }}>
            <Tooltip permanent direction="center" className="etiquette-quartier">
              {q.nom} · {ligne ? formaterEffectif(ligne.n) : "0"}
            </Tooltip>
          </Polygon>
        );
      })}
    </MapContainer>
  );
}
