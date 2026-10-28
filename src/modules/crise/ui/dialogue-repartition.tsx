"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ROLE_LIBELLES, type Role } from "@/shared/domain/vocabulaire";
import { repartirAction } from "./actions";

type Membre = { id: string; prenom: string; nom: string; role: Role };

/** E8-US6 : répartition automatique des appels restants entre les appelants choisis (ordre RG-02, tourniquet). */
export function DialogueRepartition({ campagneId, membres, equipe, onFait }: { campagneId: string; membres: Membre[]; equipe: string[]; onFait: () => void }) {
  const appelants = membres.filter((m) => m.role === "agent" || m.role === "benevole");
  const parDefaut = appelants.filter((m) => equipe.includes(m.id) && m.role === "benevole").map((m) => m.id);
  const [ouvert, setOuvert] = useState(false);
  const [choisis, setChoisis] = useState<string[]>(parDefaut);
  const [enCours, demarrer] = useTransition();

  const valider = () =>
    demarrer(async () => {
      const r = await repartirAction(campagneId, choisis);
      if (!r.ok) {
        toast.error(r.erreur);
        return;
      }
      setOuvert(false);
      toast.success(`${r.nbCibles} appels répartis entre ${choisis.length} personne${choisis.length > 1 ? "s" : ""}.`);
      for (const sms of r.smsSimules) toast(sms);
      onFait();
    });

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={<Button />}>
        <Users aria-hidden />
        Répartir les appels
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Répartir les appels</DialogTitle>
          <DialogDescription className="text-base">
            Les appels restants de la vague du jour sont répartis équitablement, dans l&apos;ordre de priorité. Les appels déjà traités ne bougent pas.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col">
          <legend className="sr-only">Appelants</legend>
          {appelants.map((m) => (
            <label key={m.id} className="flex min-h-11 items-center gap-3 text-base">
              <Checkbox checked={choisis.includes(m.id)} onCheckedChange={(v) => setChoisis((c) => (v ? [...c, m.id] : c.filter((x) => x !== m.id)))} />
              <span>
                {m.prenom} {m.nom} <span className="text-muted-foreground">· {ROLE_LIBELLES[m.role]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button onClick={valider} disabled={enCours || choisis.length === 0}>
            Répartir entre {choisis.length} personne{choisis.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
