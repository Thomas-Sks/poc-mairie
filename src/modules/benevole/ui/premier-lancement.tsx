"use client";

import { useState } from "react";
import { ClipboardCheck, ListChecks, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Surface } from "@/shared/ui/elements";
import { accepterEngagementAction } from "./actions";

const ETAPES = [
  {
    icone: ListChecks,
    titre: "Votre liste de personnes à appeler",
    texte: "Quand une alerte est déclenchée, l'équipe vous confie quelques personnes. Elles apparaissent ici, les plus fragiles en premier.",
  },
  {
    icone: Phone,
    titre: "Un appel, une personne à la fois",
    texte: "Appuyez sur « Personne suivante », appelez, puis lisez simplement le texte proposé et cochez les réponses.",
  },
  {
    icone: ClipboardCheck,
    titre: "Un bouton pour dire comment ça s'est passé",
    texte: "Tout va bien, besoin d'aide, pas de réponse, urgence : l'équipe est prévenue tout de suite si quelqu'un a besoin d'elle.",
  },
] as const;

/** E10-US2 : explication en 3 étapes puis engagement de confidentialité horodaté. */
export function PremierLancement({ prenom }: { prenom: string }) {
  const [etape, setEtape] = useState(0);
  const [accepte, setAccepte] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  if (etape < ETAPES.length) {
    const { icone: Icone, titre, texte } = ETAPES[etape];
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <p className="text-muted-foreground">
          Bienvenue {prenom}. Étape {etape + 1} sur {ETAPES.length}
        </p>
        <Surface className="flex flex-col gap-4 p-6">
          <Icone className="size-10 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold">{titre}</h1>
          <p>{texte}</p>
        </Surface>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="h-14 flex-1 text-lg" onClick={() => setEtape(etape + 1)}>
            Continuer
          </Button>
          {etape > 0 && (
            <Button size="lg" variant="outline" className="h-14 text-lg" onClick={() => setEtape(etape - 1)}>
              Retour
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        setEnvoi(true);
        await accepterEngagementAction();
      }}
      className="mx-auto flex w-full max-w-xl flex-col gap-6"
    >
      <Surface className="flex flex-col gap-4 p-6">
        <ShieldCheck className="size-10 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">Confidentialité</h1>
        <p>Les personnes que vous appelez vous confient des informations personnelles. En les appelant, je m&apos;engage à :</p>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>ne rien répéter de ce que j&apos;entends ou lis ici, à personne ;</li>
          <li>ne pas noter ni garder ces informations ailleurs que dans cette application ;</li>
          <li>ne pas utiliser les numéros de téléphone pour autre chose que ces appels.</li>
        </ul>
        <label htmlFor="engagement" className="flex min-h-12 cursor-pointer items-center gap-4 border-t pt-4 font-semibold">
          <Checkbox id="engagement" checked={accepte} onCheckedChange={(v) => setAccepte(v === true)} className="size-6" />
          Je m&apos;engage à respecter la confidentialité
        </label>
      </Surface>
      <Button type="submit" size="lg" className="h-14 text-lg" disabled={!accepte || envoi}>
        J&apos;accepte et je commence
      </Button>
    </form>
  );
}
