"use client";
import { useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { lancer } from "./champs";
import type { EtatAction } from "./etat-action";

/** Bouton déclenchant une Server Action ponctuelle (ex. « Marquer comme fait »), avec retour en toast. */
export function BoutonAction({
  action,
  children,
  variant = "outline",
  size = "default",
  ariaLabel,
}: {
  action: () => Promise<EtatAction>;
  children: ReactNode;
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm";
  ariaLabel?: string;
}) {
  const [enCours, demarrer] = useTransition();
  return (
    <Button variant={variant} size={size} aria-label={ariaLabel} disabled={enCours} onClick={() => demarrer(async () => void (await lancer(action)))}>
      {children}
    </Button>
  );
}
