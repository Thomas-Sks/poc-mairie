"use client";

import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { STATUT_CIBLE_LIBELLES } from "@/shared/domain/vocabulaire";
import { CATEGORIES_COUVERTURE, categorieCouverture, COUVERTURE_LIBELLES, COUVERTURE_TONS } from "../domain/tableau-de-bord";
import { COULEUR_TON, nomPersonne } from "./libelles";
import type { CibleVue } from "./tableau-de-bord";

const LOMME: [number, number] = [50.6448, 2.9877];

/** Carte des statuts de la vague (tuiles OpenStreetMap). Chargée sans SSR. */
export function CarteStatuts({ cibles }: { cibles: CibleVue[] }) {
  const points = cibles.filter((c) => c.lat !== null && c.lon !== null);
  const centre: [number, number] = points.length
    ? [points.reduce((s, c) => s + c.lat!, 0) / points.length, points.reduce((s, c) => s + c.lon!, 0) / points.length]
    : LOMME;
  const lats = points.map((c) => c.lat!);
  const lons = points.map((c) => c.lon!);
  const etendue = points.length ? Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons)) : 0.05;
  const zoom = etendue < 0.004 ? 17 : etendue < 0.01 ? 16 : etendue < 0.03 ? 14 : 13;

  return (
    <div className="isolate flex flex-col">
      <MapContainer center={centre} zoom={zoom} scrollWheelZoom={false} className="h-80 w-full border-t" aria-label="Carte des statuts des personnes de la campagne">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((c) => {
          const couleur = COULEUR_TON[COUVERTURE_TONS[categorieCouverture(c.statut)]];
          return (
            <CircleMarker key={c.id} center={[c.lat!, c.lon!]} radius={7} pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: couleur, fillOpacity: 0.95 }}>
              <Tooltip>
                {nomPersonne(c)} · {STATUT_CIBLE_LIBELLES[c.statut]}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t px-5 py-3 text-sm" aria-label="Légende">
        {CATEGORIES_COUVERTURE.map((cat) => (
          <li key={cat} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: COULEUR_TON[COUVERTURE_TONS[cat]] }} aria-hidden />
            {COUVERTURE_LIBELLES[cat]}
          </li>
        ))}
      </ul>
    </div>
  );
}
