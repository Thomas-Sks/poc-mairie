"use client";

/**
 * E3-US4 — Saisie rapide d'un appel en 2 clics depuis une ligne du tableau :
 * clic 1 ouvre la fenêtre, clic 2 enregistre le résultat. Le commentaire est facultatif.
 */
import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { RESULTATS_APPEL_RAPIDE, RESULTAT_APPEL_LIBELLES, type LigneBeneficiaire, type ResultatAppelRapide } from "../domain/tableau";
import { actionCommenterAppel, actionSaisirAppel } from "./actions";

export function AppelRapide({ ligne }: { ligne: LigneBeneficiaire }) {
  const id = useId();
  const client = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [enregistre, setEnregistre] = useState<{ interactionId: string; resultat: ResultatAppelRapide } | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [enCours, setEnCours] = useState(false);
  const demarrer = (f: () => Promise<void>) => {
    setEnCours(true);
    f().finally(() => setEnCours(false));
  };
  const nom = `${ligne.civilite} ${ligne.nom}`;

  const saisir = (resultat: ResultatAppelRapide) =>
    demarrer(async () => {
      const r = await actionSaisirAppel({ beneficiaireId: ligne.id, resultat });
      if (!r.ok) return void toast.error(r.erreur);
      setEnregistre({ interactionId: r.valeur, resultat });
      toast.success(`Appel enregistré pour ${nom}`);
      void client.invalidateQueries({ queryKey: ["registre", "tableau"] });
    });

  const commenter = () =>
    demarrer(async () => {
      if (!enregistre) return;
      const r = await actionCommenterAppel({ interactionId: enregistre.interactionId, commentaire });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success("Commentaire ajouté");
      setOuvert(false);
    });

  return (
    <Popover
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (o) {
          setEnregistre(null);
          setCommentaire("");
        }
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={`Saisir un appel pour ${nom} ${ligne.prenom}`} />}>
        <Phone aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] gap-3 p-4 text-base">
        <div className="flex flex-col gap-0.5">
          <PopoverTitle className="font-semibold">
            Appel à {nom} {ligne.prenom}
          </PopoverTitle>
          {(ligne.telephone || ligne.telephoneMobile) && (
            <span className="tabular text-muted-foreground">{[ligne.telephone, ligne.telephoneMobile].filter(Boolean).join(" · ")}</span>
          )}
        </div>
        {!enregistre ? (
          <div className="flex flex-col gap-2" role="group" aria-label="Résultat de l'appel">
            {RESULTATS_APPEL_RAPIDE.map((r) => (
              <Button key={r} variant="outline" className="justify-start" disabled={enCours} onClick={() => saisir(r)}>
                {RESULTAT_APPEL_LIBELLES[r]}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p role="status" className="flex items-center gap-2 font-medium text-ok">
              <Check className="size-5" aria-hidden /> {RESULTAT_APPEL_LIBELLES[enregistre.resultat]} : appel enregistré
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor={id} className="text-sm text-muted-foreground">
                Commentaire (facultatif)
              </label>
              <Textarea id={id} rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setOuvert(false)}>
                Fermer
              </Button>
              <Button variant="outline" disabled={enCours || !commentaire.trim()} onClick={commenter}>
                Ajouter le commentaire
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
