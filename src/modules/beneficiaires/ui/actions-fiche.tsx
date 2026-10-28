"use client";
/** Barre d'actions de la fiche : une action principale + menu « Autres actions ». */
import Link from "next/link";
import { useState } from "react";
import { Archive, BellPlus, ChevronDown, Gauge, Pencil, PhoneCall, PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { NiveauPriorite } from "@/shared/domain/vocabulaire";
import type { DroitsFiche } from "../application/consulter-fiche";
import { DialogueArchivage, DialogueIndisponibilite, DialogueInteraction, DialoguePriorite, DialogueRappel, type Personne } from "./dialogues-fiche";

type Dialogue = "interaction" | "rappel" | "indisponibilite" | "priorite" | "archivage" | null;

export function ActionsFiche({
  beneficiaireId,
  droits,
  archivee,
  cercle,
  equipe,
  moiId,
  maintenantLocal,
  aujourdhui,
  demain,
  niveauCalcule,
  niveauForce,
}: {
  beneficiaireId: string;
  droits: DroitsFiche;
  archivee: boolean;
  cercle: Personne[];
  equipe: Personne[];
  moiId: string;
  maintenantLocal: string;
  aujourdhui: string;
  demain: string;
  niveauCalcule: NiveauPriorite;
  niveauForce: NiveauPriorite | null;
}) {
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  if (!droits.ecrire) return null;
  const changer = (d: Exclude<Dialogue, null>) => (ouvert: boolean) => setDialogue(ouvert ? d : null);

  return (
    <>
      <Button onClick={() => setDialogue("interaction")}>
        <PhoneCall aria-hidden />
        Enregistrer une interaction
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Autres actions
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <DropdownMenuItem className="min-h-11 text-base" render={<Link href={`/beneficiaires/${beneficiaireId}/modifier`} />}>
            <Pencil aria-hidden />
            Modifier la fiche
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 text-base" onClick={() => setDialogue("rappel")}>
            <BellPlus aria-hidden />
            Créer un rappel
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 text-base" onClick={() => setDialogue("indisponibilite")}>
            <PlaneTakeoff aria-hidden />
            Déclarer une indisponibilité
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 text-base" onClick={() => setDialogue("priorite")}>
            <Gauge aria-hidden />
            Forcer le niveau de priorité
          </DropdownMenuItem>
          {droits.archiver && !archivee && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11 text-base" variant="destructive" onClick={() => setDialogue("archivage")}>
                <Archive aria-hidden />
                Archiver la fiche
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogueInteraction
        ouvert={dialogue === "interaction"}
        surChangement={changer("interaction")}
        beneficiaireId={beneficiaireId}
        cercle={cercle}
        equipe={equipe}
        moiId={moiId}
        maintenantLocal={maintenantLocal}
      />
      <DialogueRappel ouvert={dialogue === "rappel"} surChangement={changer("rappel")} beneficiaireId={beneficiaireId} equipe={equipe} moiId={moiId} demain={demain} />
      <DialogueIndisponibilite ouvert={dialogue === "indisponibilite"} surChangement={changer("indisponibilite")} beneficiaireId={beneficiaireId} aujourdhui={aujourdhui} />
      <DialoguePriorite
        ouvert={dialogue === "priorite"}
        surChangement={changer("priorite")}
        beneficiaireId={beneficiaireId}
        niveauCalcule={niveauCalcule}
        niveauForce={niveauForce}
      />
      {droits.archiver && <DialogueArchivage ouvert={dialogue === "archivage"} surChangement={changer("archivage")} beneficiaireId={beneficiaireId} />}
    </>
  );
}
