"use client";

/**
 * Points d'extension des actions groupées du tableau (E8-US8).
 *
 * « Ajouter à une campagne » est fourni par le module Crise (`FenetreAjoutCampagne`). Le composant reçoit la sélection et le
 * filtre courant ; il ouvre sa propre fenêtre et appelle `fermer()` à la fin.
 * Pour une campagne « à partir d'un filtre », le module Crise peut utiliser côté serveur
 * `rechercherBeneficiaireIds(ctx, filtre)` (`@/modules/registre/infrastructure`).
 */
import type { ComponentType } from "react";
import { Megaphone } from "lucide-react";
import { FenetreAjoutCampagne } from "@/modules/crise/ui/fenetre-ajout-campagne";
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

export const ACTION_AJOUTER_A_UNE_CAMPAGNE: ActionGroupeeExterne = {
  id: "campagne",
  libelle: "Ajouter à une campagne",
  icone: Megaphone,
  Fenetre: FenetreAjoutCampagne,
};

export const ACTIONS_GROUPEES_EXTERNES: ActionGroupeeExterne[] = [ACTION_AJOUTER_A_UNE_CAMPAGNE];
