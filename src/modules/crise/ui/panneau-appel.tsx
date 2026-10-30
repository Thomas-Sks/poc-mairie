"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formaterDateHeure } from "@/shared/domain/dates";
import { BESOIN_LIBELLES, STATUT_CIBLE_LIBELLES, type Besoin } from "@/shared/domain/vocabulaire";
import { Libelle, Pastille } from "@/shared/ui/elements";
import { RESULTAT_APPEL_LIBELLES, type ResultatAppel } from "../domain/resultat-appel";
import { tonStatut } from "../domain/tableau-de-bord";
import type { FicheAppel, NoteAlerte, ResultatVerrou } from "../application";
import { enregistrerResultatAction, libererVerrouAction, ouvrirAppelAction } from "./actions";
import type { CibleVue } from "./tableau-de-bord";
import { nomPersonne } from "./libelles";

const GROUPES: { titre: string; resultats: ResultatAppel[] }[] = [
  { titre: "La personne", resultats: ["joint_ras", "joint_besoin", "ne_repond_pas", "messagerie", "numero_invalide", "absent"] },
  { titre: "Urgence", resultats: ["danger", "evacuation"] },
  { titre: "Le cercle", resultats: ["couvert_proche", "proche_ne_repond_pas"] },
];
const BESOINS_RAPIDES: Besoin[] = ["eau", "courses", "medicaments", "visite", "chaleur", "chauffage", "logement", "autre"];

const tel = (n: string) => `tel:${n.replace(/\s/g, "")}`;

type Ouverture = { verrou: ResultatVerrou; fiche: FicheAppel; notesAlerte: NoteAlerte[] };

/** Traitement d'une cible depuis le tableau de bord CCAS : verrou, résultat, besoins, cercle. */
export function PanneauAppel({ cibleId, cible, onFermer, onEnregistre }: { cibleId: string | null; cible: CibleVue | null; onFermer: () => void; onEnregistre: () => void }) {
  const [ouverture, setOuverture] = useState<Ouverture | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatAppel | null>(null);
  const [besoins, setBesoins] = useState<Besoin[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [note, setNote] = useState("");
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (!cibleId) return;
    let annule = false;
    ouvrirAppelAction(cibleId).then((r) => {
      if (annule) return;
      if (!r.ok) setErreur(r.erreur);
      else {
        setOuverture({ verrou: r.verrou, fiche: r.fiche, notesAlerte: r.notesAlerte });
        setContactId(r.fiche.cercle[0]?.id ?? "");
      }
      onEnregistre();
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cibleId]);

  const reinitialiser = () => {
    setOuverture(null);
    setErreur(null);
    setResultat(null);
    setBesoins([]);
    setNote("");
  };

  const fermer = () => {
    if (cibleId && ouverture?.verrou.obtenu) void libererVerrouAction(cibleId);
    reinitialiser();
    onFermer();
  };

  const fiche = ouverture?.fiche;
  const bloque = ouverture && !ouverture.verrou.obtenu;
  const contact = fiche?.cercle.find((c) => c.id === contactId);
  const resultatCercle = resultat === "couvert_proche" || resultat === "proche_ne_repond_pas";

  const enregistrer = () => {
    if (!cibleId || !resultat) return;
    if (resultat === "joint_besoin" && besoins.length === 0) {
      setErreur("Choisissez au moins un besoin.");
      return;
    }
    if (resultatCercle && !contact) {
      setErreur("Choisissez le proche appelé.");
      return;
    }
    setErreur(null);
    demarrer(async () => {
      const r = await enregistrerResultatAction({
        cibleId,
        resultat,
        besoins: resultat === "joint_besoin" ? besoins : undefined,
        note: note.trim() || null,
        contactId: resultatCercle ? (contact?.id ?? null) : null,
        rangCercle: resultatCercle ? contact?.rang : undefined,
      });
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      for (const sms of r.smsSimules) toast(sms);
      onEnregistre();
      if (r.appelerCercle) {
        // RG-04 : la personne n'a pas pu être jointe, on passe au cercle (le verrou est conservé).
        const suivant = fiche?.cercle.find((c) => c.rang > (contact?.rang ?? 0)) ?? fiche?.cercle[0];
        toast.warning("Personne n'a répondu : appelez maintenant le cercle.");
        setResultat(null);
        setNote("");
        if (suivant) setContactId(suivant.id);
        return;
      }
      toast.success(`Résultat enregistré : ${STATUT_CIBLE_LIBELLES[r.statut]}.`);
      reinitialiser();
      onFermer();
    });
  };

  return (
    <Sheet open={cibleId !== null} onOpenChange={(o) => !o && fermer()}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 border-b p-5">
          <div className="flex flex-col gap-1">
            <SheetTitle className="text-xl font-semibold">{cible ? nomPersonne(cible) : "Appel"}</SheetTitle>
            <SheetDescription className="text-base">{fiche?.adresse ?? cible?.adresse}</SheetDescription>
            {cible && (
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Pastille ton={tonStatut(cible.statut)}>{STATUT_CIBLE_LIBELLES[cible.statut]}</Pastille>
                {cible.nbTentatives > 0 && `${cible.nbTentatives} tentative${cible.nbTentatives > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" aria-label="Fermer" onClick={fermer}>
            <X className="size-5" />
          </Button>
        </div>

        {!ouverture && !erreur && <p className="p-5 text-muted-foreground">Ouverture de la fiche…</p>}

        {bloque && (
          <p className="flex items-center gap-2 p-5 font-semibold text-primary">
            <Lock className="size-5" aria-hidden />
            En cours d&apos;appel par {ouverture.verrou.detenteur ? `${ouverture.verrou.detenteur.prenom} ${ouverture.verrou.detenteur.nom}` : "un collègue"}. Réessayez dans quelques minutes.
          </p>
        )}

        {fiche && !bloque && (
          <div className="flex flex-col divide-y">
            <div className="flex flex-col gap-3 p-5">
              {fiche.infoPrioritaire && <p className="font-semibold text-warn">{fiche.infoPrioritaire}</p>}
              <div className="flex flex-wrap gap-2">
                {[fiche.telephoneFixe, fiche.telephoneMobile].filter((n): n is string => Boolean(n)).map((n) => (
                  <a key={n} href={tel(n)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground tabular">
                    <Phone className="size-4" aria-hidden />
                    {n}
                  </a>
                ))}
                {!fiche.telephoneFixe && !fiche.telephoneMobile && <span className="text-muted-foreground">Pas de téléphone : visite nécessaire.</span>}
              </div>
            </div>

            {ouverture.notesAlerte.length > 0 && (
              <div className="flex flex-col gap-2 p-5">
                <Libelle>Notes de cette alerte</Libelle>
                <ul className="flex flex-col gap-2">
                  {ouverture.notesAlerte.map((n, i) => (
                    <li key={i} className="flex flex-col">
                      <span className="text-sm text-muted-foreground">
                        {n.auteur}, {formaterDateHeure(n.at)}
                      </span>
                      <span>{n.texte}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="flex flex-col gap-4 p-5">
              <legend className="sr-only">Résultat de l&apos;appel</legend>
              {GROUPES.filter((g) => g.titre !== "Le cercle" || fiche.cercle.length > 0).map((g) => (
                <div key={g.titre} className="flex flex-col gap-2">
                  <Libelle>{g.titre}</Libelle>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {g.resultats.map((r) => (
                      <label
                        key={r}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center rounded-lg border border-input px-3 py-2 font-medium has-focus-visible:outline-3 has-focus-visible:outline-ring",
                          resultat === r && "border-primary bg-accent text-primary",
                          resultat === r && (r === "danger" || r === "evacuation") && "border-err bg-err-soft text-err",
                        )}
                      >
                        <input type="radio" name="resultat" value={r} checked={resultat === r} onChange={() => setResultat(r)} className="sr-only" />
                        {RESULTAT_APPEL_LIBELLES[r]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>

            {resultat === "joint_besoin" && (
              <fieldset className="flex flex-col gap-2 p-5">
                <legend className="mb-2 font-medium">Besoin signalé</legend>
                <div className="grid grid-cols-2">
                  {BESOINS_RAPIDES.map((b) => (
                    <label key={b} className="flex min-h-11 items-center gap-3">
                      <Checkbox checked={besoins.includes(b)} onCheckedChange={(v) => setBesoins((x) => (v ? [...x, b] : x.filter((y) => y !== b)))} />
                      {BESOIN_LIBELLES[b]}
                    </label>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Une tâche est créée pour le CCAS.</p>
              </fieldset>
            )}

            {(resultatCercle || fiche.cercle.length > 0) && (resultatCercle || cible?.statut === "non_joint" || cible?.statut === "numero_invalide") && (
              <div className="flex flex-col gap-2 p-5">
                <span className="font-medium">Qui appeler ensuite ?</span>
                <ul className="flex flex-col gap-2">
                  {fiche.cercle.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-11 items-center gap-3">
                        <input type="radio" name="contact" checked={contactId === c.id} onChange={() => setContactId(c.id)} className="size-4 accent-[var(--primary)]" />
                        <span>
                          <span className="font-medium">
                            {c.rang}. {c.relation}
                          </span>{" "}
                          · {c.nom}
                          {c.possedeCles && <span className="text-muted-foreground"> · a les clés</span>}
                        </span>
                      </label>
                      {c.telephone && (
                        <a href={tel(c.telephone)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-input px-3 font-semibold text-primary tabular">
                          <Phone className="size-4" aria-hidden />
                          {c.telephone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2 p-5">
              <label htmlFor="note-appel" className="font-medium">
                {resultat === "danger" || resultat === "evacuation" ? "Précisez la situation en une phrase" : "Note (facultatif)"}
              </label>
              <Textarea id="note-appel" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              {(resultat === "danger" || resultat === "evacuation") && (
                <p className="font-semibold text-err">Urgence : 15 (SAMU), 18 (pompiers), 112, 114 (personnes sourdes). L&apos;admin et les agents sont prévenus.</p>
              )}
            </div>

            <div className="flex flex-col gap-3 p-5">
              {erreur && (
                <p role="alert" className="font-medium text-err">
                  {erreur}
                </p>
              )}
              <Button size="lg" onClick={enregistrer} disabled={!resultat || enCours}>
                Enregistrer le résultat
              </Button>
            </div>
          </div>
        )}
        {erreur && !fiche && (
          <p role="alert" className="p-5 font-medium text-err">
            {erreur}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
