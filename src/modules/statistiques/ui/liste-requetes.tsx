"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { supprimerRequeteAction } from "./actions";

export function SupprimerRequete({ id, nom }: { id: string; nom: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Supprimer la requête « ${nom} »`} disabled={enCours} />}>
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette requête ?</AlertDialogTitle>
          <AlertDialogDescription>« {nom} » ne sera plus proposée. Les tableaux de bord qui l&apos;affichent gardent leurs widgets.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="bg-transparent">
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              demarrer(async () => {
                const r = await supprimerRequeteAction(id);
                if (r.ok) toast.success("Requête supprimée");
                else toast.error(r.erreur);
              })
            }
          >
            Supprimer la requête
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
