"use client";

/** Renommer / supprimer une liste enregistrée. */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actionRenommerListe, actionSupprimerListe } from "./actions";
import { Fenetre } from "./fenetres";

export function ActionsListe({ id, nom }: { id: string; nom: string }) {
  const router = useRouter();
  const idChamp = useId();
  const [fenetre, setFenetre] = useState<"renommer" | "supprimer" | null>(null);
  const [nouveauNom, setNouveauNom] = useState(nom);
  const [enCours, demarrer] = useTransition();

  const renommer = () =>
    demarrer(async () => {
      const r = await actionRenommerListe({ id, nom: nouveauNom });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success("Liste renommée");
      setFenetre(null);
      router.refresh();
    });
  const supprimer = () =>
    demarrer(async () => {
      const r = await actionSupprimerListe({ id });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success(`Liste « ${nom} » supprimée`);
      router.push("/listes");
    });

  return (
    <>
      <Button variant="outline" onClick={() => setFenetre("renommer")}>
        Renommer
      </Button>
      <Button variant="destructive" onClick={() => setFenetre("supprimer")}>
        Supprimer
      </Button>
      {fenetre === "renommer" && (
        <Fenetre
          ouvert
          fermer={() => setFenetre(null)}
          titre="Renommer la liste"
          pied={
            <>
              <Button variant="outline" onClick={() => setFenetre(null)}>
                Annuler
              </Button>
              <Button disabled={enCours || !nouveauNom.trim()} onClick={renommer}>
                Renommer la liste
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idChamp} className="font-medium">
              Nom de la liste
            </label>
            <Input id={idChamp} value={nouveauNom} maxLength={120} onChange={(e) => setNouveauNom(e.target.value)} />
          </div>
        </Fenetre>
      )}
      {fenetre === "supprimer" && (
        <Fenetre
          ouvert
          fermer={() => setFenetre(null)}
          titre="Supprimer la liste ?"
          description="Les fiches des bénéficiaires ne sont pas modifiées : seule la liste disparaît."
          pied={
            <>
              <Button variant="outline" onClick={() => setFenetre(null)}>
                Annuler
              </Button>
              <Button variant="destructive" disabled={enCours} onClick={supprimer}>
                Supprimer la liste
              </Button>
            </>
          }
        >
          <p>« {nom} »</p>
        </Fenetre>
      )}
    </>
  );
}
