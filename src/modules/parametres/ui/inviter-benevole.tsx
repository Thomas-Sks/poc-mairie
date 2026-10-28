"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviterBenevoleAction } from "./actions";
import { useEnvoi } from "./champs";

const VIDE = { prenom: "", nom: "", telephone: "", email: "" };

/** E13-US1 (simplifié) : création d'un compte bénévole, envoi du lien simulé. */
export function InviterBenevole() {
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(VIDE);
  const { enCours, envoyer } = useEnvoi();

  const champ = (cle: keyof typeof VIDE, libelle: string, props: React.ComponentProps<"input"> = {}) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`invitation-${cle}`} className="text-base">
        {libelle}
      </Label>
      <Input id={`invitation-${cle}`} value={v[cle]} onChange={(e) => setV({ ...v, [cle]: e.target.value })} {...props} />
    </div>
  );

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <UserPlus aria-hidden />
            Inviter un bénévole
          </Button>
        }
      />
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Inviter un bénévole</DialogTitle>
          <DialogDescription className="text-base">
            Le bénévole recevra un lien de connexion par e-mail. Il n&apos;aura accès qu&apos;aux appels qui lui sont assignés.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            envoyer(
              () => inviterBenevoleAction({ ...v, telephone: v.telephone.trim() || null }),
              () => {
                setV(VIDE);
                setOuvert(false);
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {champ("prenom", "Prénom", { required: true, autoComplete: "off" })}
            {champ("nom", "Nom", { required: true, autoComplete: "off" })}
          </div>
          {champ("telephone", "Téléphone", { type: "tel", inputMode: "tel", autoComplete: "off" })}
          {champ("email", "Adresse e-mail", { type: "email", required: true, autoComplete: "off" })}
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose render={<Button type="button" variant="ghost" />}>Annuler</DialogClose>
            <Button type="submit" disabled={enCours}>
              Envoyer l&apos;invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
