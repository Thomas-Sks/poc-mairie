"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/shared/ui/elements";
import type { TextesRgpd } from "../domain/parametres";
import { enregistrerRgpdAction } from "./actions";
import { PiedFormulaire, useEnvoi } from "./champs";

const CHAMPS: { cle: keyof TextesRgpd; libelle: string; aide: string; long: boolean }[] = [
  { cle: "responsable", libelle: "Responsable du traitement", aide: "Affiché sur le formulaire d'inscription.", long: false },
  { cle: "dpo", libelle: "Contact du délégué à la protection des données", aide: "Adresse e-mail ou postale.", long: false },
  { cle: "conservation", libelle: "Durée de conservation", aide: "Phrase lue par la personne qui s'inscrit.", long: true },
  { cle: "droits", libelle: "Exercice des droits", aide: "Comment accéder à ses données, les rectifier ou se désinscrire.", long: true },
];

export function FormulaireRgpd({ initiaux }: { initiaux: TextesRgpd }) {
  const [t, setT] = useState<TextesRgpd>(initiaux);
  const { enCours, envoyer } = useEnvoi();

  return (
    <Surface>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(() => enregistrerRgpdAction(t));
        }}
      >
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          {CHAMPS.map((c) => (
            <div key={c.cle} className="flex flex-col gap-2">
              <Label htmlFor={`rgpd-${c.cle}`} className="text-base font-semibold">
                {c.libelle}
              </Label>
              <p id={`rgpd-${c.cle}-aide`} className="-mt-1 text-sm text-muted-foreground">
                {c.aide}
              </p>
              {c.long ? (
                <Textarea id={`rgpd-${c.cle}`} aria-describedby={`rgpd-${c.cle}-aide`} value={t[c.cle]} onChange={(e) => setT({ ...t, [c.cle]: e.target.value })} required />
              ) : (
                <Input id={`rgpd-${c.cle}`} aria-describedby={`rgpd-${c.cle}-aide`} value={t[c.cle]} onChange={(e) => setT({ ...t, [c.cle]: e.target.value })} required />
              )}
            </div>
          ))}
        </div>
        <PiedFormulaire>
          <Button type="submit" variant="outline" disabled={enCours}>
            Enregistrer les textes RGPD
          </Button>
        </PiedFormulaire>
      </form>
    </Surface>
  );
}
