"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueIndisponibilite } from "./dialogues-fiche";

export function BoutonDeclarerIndisponibilite({ beneficiaireId, aujourdhui }: { beneficiaireId: string; aujourdhui: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOuvert(true)}>
        <Plus aria-hidden />
        Déclarer une indisponibilité
      </Button>
      <DialogueIndisponibilite ouvert={ouvert} surChangement={setOuvert} beneficiaireId={beneficiaireId} aujourdhui={aujourdhui} />
    </>
  );
}
