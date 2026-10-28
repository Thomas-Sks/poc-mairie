"use client";

/**
 * E8-US4 — Carte des bénéficiaires (points colorés par priorité) et E8-US3 (S) — sélection d'une zone
 * par polygone ou cercle. Dessin implémenté directement avec Leaflet (sans extension).
 * Chargé uniquement côté navigateur (`dynamic(..., { ssr: false })`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Check, Circle as IconeCercle, Pentagon, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";
import { distanceMetres, type Coordonnee, type ZoneCarte } from "../domain/filtre";
import type { PointCarte } from "./types";

const CENTRE_PAR_DEFAUT: Coordonnee = [50.6435, 2.996];

/** Couleurs de la DA lues depuis les variables CSS (P1 = err, P2 = warn, P3 = gris). */
function useCouleurs() {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const lire = (v: string, defaut: string) => css.getPropertyValue(v).trim() || defaut;
    return {
      P1: lire("--err", "#b42318"),
      P2: lire("--warn", "#b54708"),
      P3: lire("--subtle-foreground", "#8a8a8a"),
      accent: lire("--primary", "#0f6e6e"),
      contour: lire("--card", "#ffffff"),
    } satisfies Record<NiveauPriorite | "accent" | "contour", string>;
  }, []);
}

type Mode = { type: "aucun" } | { type: "polygone"; points: Coordonnee[] } | { type: "cercle"; centre: Coordonnee | null; curseur: Coordonnee | null };

function Ajuster({ points, cle }: { points: PointCarte[]; cle: string }) {
  const map = useMap();
  const derniere = useRef<string | null>(null);
  useEffect(() => {
    if (derniere.current === cle || points.length === 0) return;
    derniere.current = cle;
    const bornes = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bornes, { padding: [32, 32], maxZoom: 17, animate: false });
  }, [map, points, cle]);
  return null;
}

function Dessin({ mode, setMode, onCercle }: { mode: Mode; setMode: (m: Mode) => void; onCercle: (centre: Coordonnee, bord: Coordonnee) => void }) {
  const map = useMap();
  useEffect(() => {
    if (mode.type === "aucun") {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    } else {
      map.doubleClickZoom.disable();
      map.getContainer().style.cursor = "crosshair";
    }
  }, [map, mode.type]);
  useMapEvents({
    click(e) {
      const p: Coordonnee = [e.latlng.lat, e.latlng.lng];
      if (mode.type === "polygone") setMode({ ...mode, points: [...mode.points, p] });
      if (mode.type === "cercle") {
        if (mode.centre) onCercle(mode.centre, p);
        else setMode({ ...mode, centre: p });
      }
    },
    mousemove(e) {
      if (mode.type === "cercle" && mode.centre) setMode({ ...mode, curseur: [e.latlng.lat, e.latlng.lng] });
    },
  });
  return null;
}

export default function CarteLeaflet({
  points,
  cleFiltre,
  zone,
  onZone,
  peutDessiner = true,
}: {
  points: PointCarte[];
  /** Change quand le filtre change : la carte se recadre alors sur les résultats. */
  cleFiltre: string;
  zone?: ZoneCarte;
  onZone: (zone: ZoneCarte | undefined) => void;
  peutDessiner?: boolean;
}) {
  const couleurs = useCouleurs();
  const [mode, setMode] = useState<Mode>({ type: "aucun" });

  const terminerCercle = (centre: Coordonnee, bord: Coordonnee) => {
    const rayon = Math.max(20, Math.round(distanceMetres(centre, bord)));
    onZone({ type: "cercle", centre, rayonMetres: rayon });
    setMode({ type: "aucun" });
  };

  const consigne =
    mode.type === "polygone"
      ? mode.points.length < 3
        ? "Cliquez sur la carte pour placer au moins 3 sommets."
        : "Ajoutez des sommets ou terminez la zone."
      : mode.type === "cercle"
        ? mode.centre
          ? "Cliquez à nouveau pour fixer le rayon du cercle."
          : "Cliquez sur la carte pour placer le centre du cercle."
        : null;

  return (
    <div className="flex flex-col">
      {peutDessiner && (
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {mode.type === "aucun" ? (
            <>
              <span className="mr-1 text-muted-foreground">Sélectionner une zone :</span>
              <Button variant="outline" onClick={() => setMode({ type: "polygone", points: [] })}>
                <Pentagon aria-hidden /> Polygone
              </Button>
              <Button variant="outline" onClick={() => setMode({ type: "cercle", centre: null, curseur: null })}>
                <IconeCercle aria-hidden /> Cercle
              </Button>
              {zone && (
                <Button variant="ghost" onClick={() => onZone(undefined)}>
                  <Trash2 aria-hidden /> Effacer la zone
                </Button>
              )}
            </>
          ) : (
            <>
              <span role="status" className="mr-1 font-medium">
                {consigne}
              </span>
              {mode.type === "polygone" && (
                <Button
                  disabled={mode.points.length < 3}
                  onClick={() => {
                    onZone({ type: "polygone", points: mode.points });
                    setMode({ type: "aucun" });
                  }}
                >
                  <Check aria-hidden /> Terminer la zone
                </Button>
              )}
              <Button variant="outline" onClick={() => setMode({ type: "aucun" })}>
                <X aria-hidden /> Annuler
              </Button>
            </>
          )}
        </div>
      )}
      <div className="relative isolate h-[60vh] min-h-[22rem]">
        <MapContainer center={CENTRE_PAR_DEFAUT} zoom={14} className="size-full rounded-b-lg" scrollWheelZoom fadeAnimation={false} zoomAnimation={false} markerZoomAnimation={false}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>'
            maxZoom={19}
          />
          <Ajuster points={points} cle={cleFiltre} />
          <Dessin mode={mode} setMode={setMode} onCercle={terminerCercle} />

          {zone?.type === "polygone" && mode.type === "aucun" && (
            <Polygon positions={zone.points} pathOptions={{ color: couleurs.accent, weight: 2, fillOpacity: 0.08 }} />
          )}
          {zone?.type === "cercle" && mode.type === "aucun" && (
            <Circle center={zone.centre} radius={zone.rayonMetres} pathOptions={{ color: couleurs.accent, weight: 2, fillOpacity: 0.08 }} />
          )}

          {mode.type === "polygone" && mode.points.length > 0 && (
            <>
              <Polyline positions={mode.points} pathOptions={{ color: couleurs.accent, weight: 2, dashArray: "6 6" }} />
              {mode.points.map((p, i) => (
                <CircleMarker
                  key={i}
                  center={p}
                  radius={5}
                  pathOptions={{ color: couleurs.accent, fillColor: couleurs.contour, fillOpacity: 1, weight: 2 }}
                  eventHandlers={
                    i === 0 && mode.points.length >= 3
                      ? {
                          click: (e) => {
                            L.DomEvent.stopPropagation(e);
                            onZone({ type: "polygone", points: mode.points });
                            setMode({ type: "aucun" });
                          },
                        }
                      : undefined
                  }
                />
              ))}
            </>
          )}
          {mode.type === "cercle" && mode.centre && (
            <>
              <CircleMarker center={mode.centre} radius={4} interactive={false} pathOptions={{ color: couleurs.accent, fillOpacity: 1 }} />
              {mode.curseur && (
                <Circle
                  center={mode.centre}
                  radius={distanceMetres(mode.centre, mode.curseur)}
                  interactive={false}
                  pathOptions={{ color: couleurs.accent, weight: 2, dashArray: "6 6", fillOpacity: 0.05 }}
                />
              )}
            </>
          )}

          {points.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={p.niveau === "P1" ? 8 : 7}
              interactive={mode.type === "aucun"}
              pathOptions={{ color: couleurs.contour, weight: 1.5, fillColor: couleurs[p.niveau], fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="flex flex-col gap-1 text-[0.9375rem]">
                  <Link href={`/beneficiaires/${p.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {p.nom}
                  </Link>
                  <span>{p.adresse}</span>
                  <span className="text-muted-foreground">Priorité {p.niveau}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
