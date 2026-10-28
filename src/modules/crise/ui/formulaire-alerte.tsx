"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/shared/ui/elements";
import { ALERTE_LIBELLES, NIVEAUX_ALERTE, TYPES_ALERTE, type NiveauAlerte, type TypeAlerte } from "@/shared/domain/vocabulaire";
import { declencherAlerteAction } from "./actions";
import { Champ, ChoixSegmente, classeSelect } from "./champs";
import { NIVEAU_ALERTE_LIBELLES } from "./libelles";

/** E9-US1 : déclenchement d'une alerte par l'admin. */
export function FormulaireAlerte({ aujourdhui }: { aujourdhui: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [type, setType] = useState<TypeAlerte>("canicule");
  const [niveau, setNiveau] = useState<NiveauAlerte>("orange");
  const [debut, setDebut] = useState(aujourdhui);
  const [fin, setFin] = useState("");
  const [zone, setZone] = useState<"commune" | "zone">("commune");
  const [perimetre, setPerimetre] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (zone === "zone" && !perimetre.trim()) {
      setErreur("Précisez la zone concernée.");
      return;
    }
    demarrer(async () => {
      const r = await declencherAlerteAction({
        type,
        niveau,
        debut,
        finPrevue: fin || null,
        perimetre: zone === "commune" ? "Toute la commune" : perimetre.trim(),
        message: message.trim() || null,
      });
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      toast.success("Alerte déclenchée. Créez maintenant la campagne d'appels.");
      router.push(`/alertes/${r.alerteId}/campagne`);
    });
  };

  return (
    <Surface className="max-w-3xl p-5 sm:p-6">
      <form onSubmit={soumettre} className="flex flex-col gap-6" noValidate>
        <Champ id="type" libelle="Type d'alerte">
          <select id="type" className={classeSelect} value={type} onChange={(e) => setType(e.target.value as TypeAlerte)}>
            {TYPES_ALERTE.map((t) => (
              <option key={t} value={t}>
                {ALERTE_LIBELLES[t]}
              </option>
            ))}
          </select>
        </Champ>

        <ChoixSegmente
          nom="niveau"
          libelle="Niveau"
          valeur={niveau}
          onChange={setNiveau}
          options={NIVEAUX_ALERTE.map((n) => ({ valeur: n, libelle: NIVEAU_ALERTE_LIBELLES[n] }))}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Champ id="debut" libelle="Début">
            <Input id="debut" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} required />
          </Champ>
          <Champ id="fin" libelle="Fin prévue" aide="Facultatif : la campagne s'arrête à cette date.">
            <Input id="fin" type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
          </Champ>
        </div>

        <div className="flex flex-col gap-3">
          <ChoixSegmente
            nom="perimetre"
            libelle="Périmètre"
            valeur={zone}
            onChange={setZone}
            options={[
              { valeur: "commune", libelle: "Toute la commune" },
              { valeur: "zone", libelle: "Zone géographique" },
            ]}
          />
          {zone === "zone" && (
            <Champ id="zone" libelle="Zone concernée" aide="Ex. « Rue du Marais et abords de la Deûle ». Le ciblage précis se fait à la création de la campagne.">
              <Input id="zone" value={perimetre} onChange={(e) => setPerimetre(e.target.value)} />
            </Champ>
          )}
        </div>

        <Champ id="message" libelle="Message interne" aide="Visible par l'équipe du CCAS.">
          <Textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Champ>

        {erreur && (
          <p role="alert" className="font-medium text-err">
            {erreur}
          </p>
        )}

        <div className="flex flex-wrap gap-3 border-t pt-5">
          <Button type="submit" size="lg" disabled={enCours}>
            <BellRing aria-hidden />
            Déclencher l&apos;alerte
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => router.push("/alertes")}>
            Annuler
          </Button>
        </div>
      </form>
    </Surface>
  );
}
