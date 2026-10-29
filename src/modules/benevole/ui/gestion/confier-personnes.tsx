"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PastillePriorite } from "@/shared/ui/elements";
import type { PersonneTrouvee } from "../../application/ports";
import { confierPersonnesAction, rechercherPersonnesAction } from "./actions";

/** Recherche par nom ou par rue, cases à cocher, un seul bouton pour confier. */
export function ConfierPersonnes({ benevoleId, prenom }: { benevoleId: string; prenom: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [resultats, setResultats] = useState<PersonneTrouvee[]>([]);
  const [choisis, setChoisis] = useState<Map<string, string>>(new Map());
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (texte.trim().length < 2) return;
    const minuteur = setTimeout(async () => {
      const r = await rechercherPersonnesAction({ benevoleId, texte });
      if (r.ok) setResultats(r.valeur);
    }, 250);
    return () => clearTimeout(minuteur);
  }, [texte, benevoleId]);

  const basculer = (p: PersonneTrouvee) =>
    setChoisis((c) => {
      const n = new Map(c);
      if (n.has(p.id)) n.delete(p.id);
      else n.set(p.id, `${p.prenom} ${p.nom}`);
      return n;
    });

  const fermer = () => {
    setOuvert(false);
    setTexte("");
    setResultats([]);
    setChoisis(new Map());
  };

  const affiches = texte.trim().length < 2 ? [] : resultats;

  return (
    <Dialog open={ouvert} onOpenChange={(o) => (o ? setOuvert(true) : fermer())}>
      <DialogTrigger
        render={
          <Button>
            <UserRoundPlus aria-hidden />
            Confier des personnes
          </Button>
        }
      />
      <DialogContent className="gap-5 p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Confier des personnes à {prenom}</DialogTitle>
          <DialogDescription className="text-base">
            Cherchez par nom ou par rue, puis cochez les personnes. Pendant une alerte, elles arriveront directement dans sa liste d&apos;appels.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="recherche-personne" className="text-base">
            Nom ou rue
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-subtle-foreground" aria-hidden />
            <Input
              id="recherche-personne"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex. Dupont, rue du Marais"
              autoComplete="off"
              className="pl-10"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto" aria-live="polite">
          {texte.trim().length >= 2 && affiches.length === 0 ? (
            <p className="py-4 text-muted-foreground">Aucune personne trouvée.</p>
          ) : (
            <ul className="divide-y">
              {affiches.map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-primary"
                      checked={p.dejaConfiee || choisis.has(p.id)}
                      disabled={p.dejaConfiee}
                      onChange={() => basculer(p)}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">
                        {p.civilite} {p.prenom} {p.nom}, {p.age} ans
                      </span>
                      <span className="truncate text-sm text-muted-foreground">{p.dejaConfiee ? "Déjà confiée" : p.adresse}</span>
                    </span>
                    <PastillePriorite niveau={p.niveau} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <DialogClose render={<Button type="button" variant="ghost" />}>Annuler</DialogClose>
          <Button
            disabled={enCours || choisis.size === 0}
            onClick={() =>
              demarrer(async () => {
                const r = await confierPersonnesAction({ benevoleId, beneficiaireIds: [...choisis.keys()] });
                if (!r.ok) {
                  toast.error(r.erreur);
                  return;
                }
                toast.success(`${r.valeur} personne${r.valeur > 1 ? "s confiées" : " confiée"} à ${prenom}.`);
                fermer();
              })
            }
          >
            {choisis.size === 0 ? "Confier" : `Confier ${choisis.size} personne${choisis.size > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
