"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageErreur, useFormulaire } from "./champs";
import type { EtatAction } from "./etat-action";

type Proprietes = {
  ouvert: boolean;
  surChangement: (ouvert: boolean) => void;
  titre: string;
  description?: ReactNode;
  action: (etat: EtatAction, fd: FormData) => Promise<EtatAction>;
  libelleValider: string;
  destructif?: boolean;
  children: (erreurs: Partial<Record<string, string>>) => ReactNode;
};

/** Boîte de dialogue contenant un formulaire de Server Action ; se ferme d'elle-même en cas de succès. */
export function DialogueFormulaire({ ouvert, surChangement, titre, description, ...reste }: Proprietes) {
  return (
    <Dialog open={ouvert} onOpenChange={surChangement}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] gap-5 overflow-y-auto p-5 text-base sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-tight">{titre}</DialogTitle>
          {description && <DialogDescription className="text-base">{description}</DialogDescription>}
        </DialogHeader>
        {/* Monté seulement quand la boîte est ouverte : l'état du formulaire repart de zéro à chaque ouverture. */}
        <ContenuFormulaire {...reste} fermer={() => surChangement(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ContenuFormulaire({
  action,
  libelleValider,
  destructif,
  children,
  fermer,
}: Omit<Proprietes, "ouvert" | "surChangement" | "titre" | "description"> & { fermer: () => void }) {
  const { etat, onSubmit, enCours } = useFormulaire(action, fermer);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {children(etat.erreurs ?? {})}
      <MessageErreur etat={etat} />
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <DialogClose render={<Button variant="outline" type="button" />}>Annuler</DialogClose>
        <Button type="submit" variant={destructif ? "destructive" : "default"} disabled={enCours}>
          {libelleValider}
        </Button>
      </div>
    </form>
  );
}

/** Confirmation simple d'une action ponctuelle (retirer, signaler un retour…). */
export function DialogueConfirmation({
  ouvert,
  surChangement,
  titre,
  description,
  libelleValider,
  destructif,
  surConfirmation,
}: {
  ouvert: boolean;
  surChangement: (ouvert: boolean) => void;
  titre: string;
  description: ReactNode;
  libelleValider: string;
  destructif?: boolean;
  surConfirmation: () => Promise<unknown>;
}) {
  return (
    <Dialog open={ouvert} onOpenChange={surChangement}>
      <DialogContent showCloseButton={false} className="gap-5 p-5 text-base sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-tight">{titre}</DialogTitle>
          <DialogDescription className="text-base">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <DialogClose render={<Button variant="outline" type="button" />}>Annuler</DialogClose>
          <Button
            variant={destructif ? "destructive" : "default"}
            onClick={async () => {
              await surConfirmation();
              surChangement(false);
            }}
          >
            {libelleValider}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
