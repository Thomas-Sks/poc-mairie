"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GitMerge, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fusionnerFicheAction, rejeterInscriptionAction, validerInscriptionAction, type ResultatAction } from "./actions";

function useAction() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const lancer = (action: () => Promise<ResultatAction>, succes: string, ensuite?: string) =>
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(succes);
      if (ensuite) router.push(ensuite);
      else router.refresh();
    });
  return { enCours, lancer };
}

/** Valider (fiches → active) et rejeter avec motif (E7-US3). */
export function ActionsInscription({ id, noms, nbFiches }: { id: string; noms: string; nbFiches: number }) {
  const { enCours, lancer } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");

  return (
    <>
      <Button variant="destructive" disabled={enCours} onClick={() => setOuvert(true)}>
        <X aria-hidden />
        Rejeter
      </Button>
      <Button disabled={enCours} onClick={() => lancer(() => validerInscriptionAction({ id }), `Inscription validée : ${noms} ${nbFiches > 1 ? "sont inscrits" : "est inscrit(e)"} au registre.`, "/inscriptions")}>
        <Check aria-hidden />
        Valider l&apos;inscription
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="gap-5 p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Rejeter l&apos;inscription</DialogTitle>
            <DialogDescription className="text-base">
              Les fiches en attente de {noms} seront supprimées. Les réponses du formulaire et le motif restent consultables.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="motif-rejet" className="font-semibold">
              Motif du rejet
            </label>
            <textarea
              id="motif-rejet"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Par exemple : personne domiciliée hors de la commune"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button
              variant="destructive"
              disabled={enCours || motif.trim().length < 3}
              onClick={() => lancer(() => rejeterInscriptionAction({ id, motif }), "Inscription rejetée.", "/inscriptions")}
            >
              Rejeter l&apos;inscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Fusion d'une fiche en attente avec une fiche existante (doublon détecté). */
export function BoutonFusion({
  inscriptionId,
  ficheEnAttenteId,
  ficheExistanteId,
  libelleExistante,
  libelleEnAttente,
}: {
  inscriptionId: string;
  ficheEnAttenteId: string;
  ficheExistanteId: string;
  libelleExistante: string;
  libelleEnAttente: string;
}) {
  const { enCours, lancer } = useAction();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Button variant="outline" disabled={enCours} onClick={() => setOuvert(true)}>
        <GitMerge aria-hidden />
        Fusionner avec cette fiche
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="gap-5 p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Fusionner avec la fiche existante</DialogTitle>
            <DialogDescription className="text-base">
              La fiche de {libelleExistante} est conservée. Les personnes à prévenir, les intervenants, les absences et les coordonnées manquantes de
              l&apos;inscription de {libelleEnAttente} y sont ajoutés, puis le score de priorité est recalculé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button
              disabled={enCours}
              onClick={() =>
                lancer(
                  () => fusionnerFicheAction({ inscriptionId, ficheEnAttenteId, ficheExistanteId }),
                  `Inscription rattachée à la fiche de ${libelleExistante}.`,
                )
              }
            >
              Fusionner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
