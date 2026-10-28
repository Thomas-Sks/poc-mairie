"use client";

/**
 * Points d'extension des actions groupées du tableau (E8-US8).
 *
 * « Ajouter à une campagne » appartient au module Crise : il remplace `ACTION_AJOUTER_A_UNE_CAMPAGNE`
 * (ou ajoute une entrée à `ACTIONS_GROUPEES_EXTERNES`). Le composant reçoit la sélection et le
 * filtre courant ; il ouvre sa propre fenêtre et appelle `fermer()` à la fin.
 * Pour une campagne « à partir d'un filtre », le module Crise peut utiliser côté serveur
 * `rechercherBeneficiaireIds(ctx, filtre)` (`@/modules/registre/infrastructure`).
 */
import type { ComponentType } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Filtre } from "../domain/filtre";

export type ProprietesActionGroupee = {
  /** Personnes sélectionnées (ids), dans l'ordre d'affichage. */
  ids: string[];
  /** Filtre courant (pour une campagne dynamique). */
  filtre: Filtre;
  /** Liste en cours de consultation, le cas échéant. */
  listeId?: string;
  ouvert: boolean;
  fermer: () => void;
};

export type ActionGroupeeExterne = {
  id: string;
  libelle: string;
  icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  Fenetre: ComponentType<ProprietesActionGroupee>;
};

/** Fenêtre provisoire, remplacée par le module Crise. */
function FenetreCampagneProvisoire({ ids, ouvert, fermer }: ProprietesActionGroupee) {
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && fermer()}>
      <DialogContent className="gap-4 p-6 text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Ajouter à une campagne</DialogTitle>
          <DialogDescription className="text-base">
            {ids.length} personne{ids.length > 1 ? "s" : ""} sélectionnée{ids.length > 1 ? "s" : ""}. Les campagnes se gèrent depuis « Alertes et campagnes ».
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 bg-card p-4">
          <Button variant="outline" onClick={fermer}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ACTION_AJOUTER_A_UNE_CAMPAGNE: ActionGroupeeExterne = {
  id: "campagne",
  libelle: "Ajouter à une campagne",
  icone: Megaphone,
  Fenetre: FenetreCampagneProvisoire,
};

export const ACTIONS_GROUPEES_EXTERNES: ActionGroupeeExterne[] = [ACTION_AJOUTER_A_UNE_CAMPAGNE];
