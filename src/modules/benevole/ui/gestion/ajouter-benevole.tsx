"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ajouterBenevoleAction } from "./actions";

const VIDE = { prenom: "", nom: "", telephone: "", email: "" };

/** Ajout d'un bénévole, puis ouverture de sa fiche pour lui confier des personnes. */
export function AjouterBenevole() {
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(VIDE);
  const [enCours, demarrer] = useTransition();
  const router = useRouter();

  const champ = (cle: keyof typeof VIDE, libelle: string, props: React.ComponentProps<"input"> = {}) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`benevole-${cle}`} className="text-base">
        {libelle}
      </Label>
      <Input id={`benevole-${cle}`} value={v[cle]} onChange={(e) => setV({ ...v, [cle]: e.target.value })} {...props} />
    </div>
  );

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus aria-hidden />
            Ajouter un bénévole
          </Button>
        }
      />
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Ajouter un bénévole</DialogTitle>
          <DialogDescription className="text-base">
            Il recevra un lien de connexion par e-mail. Il ne verra que les personnes que vous lui confiez, et seulement pendant une alerte.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            demarrer(async () => {
              const r = await ajouterBenevoleAction({ ...v, telephone: v.telephone.trim() || null });
              if (!r.ok) {
                toast.error(r.erreur);
                return;
              }
              toast.success(`${v.prenom} est ajouté. Invitation envoyée à ${v.email} (envoi simulé).`);
              setV(VIDE);
              setOuvert(false);
              router.push(`/benevoles/${r.valeur}`);
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {champ("prenom", "Prénom", { required: true, autoComplete: "off" })}
            {champ("nom", "Nom", { required: true, autoComplete: "off" })}
          </div>
          {champ("telephone", "Téléphone portable", { type: "tel", inputMode: "tel", autoComplete: "off" })}
          {champ("email", "Adresse e-mail", { type: "email", required: true, autoComplete: "off" })}
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose render={<Button type="button" variant="ghost" />}>Annuler</DialogClose>
            <Button type="submit" disabled={enCours}>
              Ajouter le bénévole
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
