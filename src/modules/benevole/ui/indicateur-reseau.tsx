"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { messageFile } from "../domain/file-hors-ligne";
import { synchroniser, useEtatFile } from "./file-attente";

/**
 * E10-US8 : indication discrète du réseau et des résultats en attente, et synchronisation
 * automatique au retour du réseau (puis toutes les 10 s tant qu'il reste des envois).
 */
export function IndicateurReseau() {
  const router = useRouter();
  const { enAttente, enLigne } = useEtatFile();

  useEffect(() => {
    const essayer = async () => {
      if ((await synchroniser()) > 0) router.refresh();
    };
    void essayer();
    window.addEventListener("online", essayer);
    const minuterie = window.setInterval(essayer, 10_000);
    return () => {
      window.removeEventListener("online", essayer);
      window.clearInterval(minuterie);
    };
  }, [router]);

  const message = messageFile(enAttente, enLigne);
  if (!message) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-muted-foreground">
      <CloudOff className="size-5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Rafraîchit « Ma liste » pour voir arriver les nouvelles personnes assignées (temps réel par polling). */
export function RafraichissementAuto({ intervalleMs = 5_000 }: { intervalleMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const minuterie = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    }, intervalleMs);
    return () => window.clearInterval(minuterie);
  }, [router, intervalleMs]);
  return null;
}
