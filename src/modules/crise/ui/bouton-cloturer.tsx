"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CircleStop } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cloturerAlerteAction } from "./actions";

/** E9-US7 : clôture de l'alerte, puis ouverture du rapport de campagne. */
export function BoutonCloturer({ alerteId, libelle }: { alerteId: string; libelle: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();

  const cloturer = () =>
    demarrer(async () => {
      const r = await cloturerAlerteAction(alerteId);
      if (!r.ok) {
        toast.error(r.erreur);
        return;
      }
      setOuvert(false);
      toast.success("Alerte clôturée. Le rapport de campagne est prêt.");
      router.push(r.campagneIds[0] ? `/campagnes/${r.campagneIds[0]}/rapport` : "/alertes");
      router.refresh();
    });

  return (
    <AlertDialog open={ouvert} onOpenChange={setOuvert}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <CircleStop aria-hidden />
        Clôturer l&apos;alerte
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clôturer l&apos;alerte « {libelle} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les campagnes liées s&apos;arrêtent : plus aucune vague d&apos;appels ne sera générée. Le rapport de campagne est généré
            automatiquement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={cloturer} disabled={enCours}>
            Clôturer et voir le rapport
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
