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
export function FormulaireAlerte({ aujourdhui, listeId }: { aujourdhui: string; /** Sélection venue du tableau des bénéficiaires. */ listeId?: string }) {
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
      toast.success("Alerte déclenchée. Choisissez maintenant qui appeler.");
      router.push(`/alertes/${r.alerteId}/campagne${listeId ? `?liste=${listeId}` : ""}`);
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

        <Champ id="debut" libelle="Début" className="max-w-xs">
          <Input id="debut" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} required />
        </Champ>

        <details className="border-t pt-4">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-primary">Plus de détails (facultatif)</summary>
          <div className="mt-4 flex flex-col gap-6">
            <Champ id="fin" libelle="Fin prévue" aide="Les appels s'arrêtent à cette date.">
              <Input id="fin" type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} className="max-w-xs" />
            </Champ>
            <div className="flex flex-col gap-3">
              <ChoixSegmente
                nom="perimetre"
                libelle="Où ?"
                valeur={zone}
                onChange={setZone}
                options={[
                  { valeur: "commune", libelle: "Toute la commune" },
                  { valeur: "zone", libelle: "Une partie de la commune" },
                ]}
              />
              {zone === "zone" && (
                <Champ id="zone" libelle="Zone concernée" aide="Ex. « Rue du Marais ». Vous choisirez les personnes précises à l'étape suivante.">
                  <Input id="zone" value={perimetre} onChange={(e) => setPerimetre(e.target.value)} />
                </Champ>
              )}
            </div>
            <Champ id="message" libelle="Message pour l'équipe">
              <Textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Champ>
          </div>
        </details>

        {erreur && (
          <p role="alert" className="font-medium text-err">
            {erreur}
          </p>
        )}

        <div className="flex flex-wrap gap-3 border-t pt-5">
          <Button type="submit" size="lg" disabled={enCours}>
            <BellRing aria-hidden />
            Continuer : qui appeler ?
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => router.push("/alertes")}>
            Annuler
          </Button>
        </div>
      </form>
    </Surface>
  );
}
