"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pastille, Surface } from "@/shared/ui/elements";
import { creerDashboardAction } from "./actions";

type Ligne = { id: string; nom: string; predefini: boolean; partage: boolean; auteur: string | null; nbWidgets: number };

export function ListeDashboards({ dashboards }: { dashboards: Ligne[] }) {
  return (
    <Surface>
      <ul className="divide-y">
        {dashboards.map((d) => (
          <li key={d.id}>
            <Link href={`/statistiques/tableaux-de-bord/${d.id}`} className="flex min-h-11 items-center gap-4 p-5 hover:bg-muted">
              <LayoutDashboard className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-semibold text-primary">{d.nom}</span>
                <span className="text-sm text-muted-foreground">
                  {d.nbWidgets} widget{d.nbWidgets > 1 ? "s" : ""}
                  {d.auteur && !d.predefini ? ` · créé par ${d.auteur}` : ""}
                </span>
              </div>
              {d.predefini ? <Pastille ton="accent">Prédéfini</Pastille> : <Pastille ton="neutre">{d.partage ? "Partagé" : "Personnel"}</Pastille>}
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

export function NouveauDashboard() {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Button onClick={() => setOuvert(true)}>
        <Plus aria-hidden />
        Nouveau tableau de bord
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Nouveau tableau de bord</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">Il sera partagé avec l&apos;équipe ; vous y ajouterez ensuite des widgets.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              demarrer(async () => {
                const r = await creerDashboardAction(nom);
                if (r && !r.ok) toast.error(r.erreur);
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="nom-dashboard" className="font-medium">
                Nom
              </label>
              <Input id="nom-dashboard" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Conseil d'administration" maxLength={120} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={enCours || !nom.trim()}>
                Créer le tableau de bord
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
