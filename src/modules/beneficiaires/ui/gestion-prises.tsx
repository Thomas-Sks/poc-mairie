"use client";
/**
 * E6-US1 / E6-US2 / E6-US7 — Prises en charge, planning récurrent et exceptions.
 */
import { useState } from "react";
import { CalendarClock, CalendarX, KeyRound, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formaterDate } from "@/shared/domain/dates";
import { PRISE_EN_CHARGE_LIBELLES, TYPES_PRISE_EN_CHARGE } from "@/shared/domain/vocabulaire";
import { Pastille, Section } from "@/shared/ui/elements";
import { estActive, formaterCreneau, joursAvantEcheance, JOURS_LONGS, PRISES_AVEC_PASSAGES } from "../domain/planning";
import type { CreneauVue, PriseEnChargeVue } from "../application/ports";
import { enregistrerCreneauAction, enregistrerPriseEnChargeAction, retirerCreneauAction, retirerPriseEnChargeAction } from "./actions";
import { CaseACocher, ChampSelect, ChampTexte, GroupeCases, lancer } from "./champs";
import { DialogueConfirmation, DialogueFormulaire } from "./dialogue-formulaire";
import { options } from "./libelles";

type Option = { id: string; nom: string };

function DialoguePrise({
  ouvert,
  surChangement,
  beneficiaireId,
  prise,
  structures,
  cercle,
}: {
  ouvert: boolean;
  surChangement: (o: boolean) => void;
  beneficiaireId: string;
  prise: PriseEnChargeVue | null;
  structures: Option[];
  cercle: Option[];
}) {
  const [type, setType] = useState(prise?.type ?? "aide_domicile");
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre={prise ? "Modifier la prise en charge" : "Ajouter une prise en charge"}
      action={enregistrerPriseEnChargeAction.bind(null, { beneficiaireId, priseEnChargeId: prise?.id ?? null })}
      libelleValider={prise ? "Enregistrer" : "Ajouter"}
    >
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampSelect
              libelle="Type"
              name="type"
              value={type}
              onChange={(ev) => setType(ev.target.value as typeof type)}
              options={options(TYPES_PRISE_EN_CHARGE, PRISE_EN_CHARGE_LIBELLES)}
              erreur={e.type}
              requis
            />
            <ChampSelect
              libelle="Structure"
              name="structureId"
              defaultValue={prise?.structureId ?? ""}
              vide="Aucune / autre"
              options={structures.map((s) => ({ valeur: s.id, libelle: s.nom }))}
            />
            <ChampTexte libelle="Organisme ou intervenant" name="intervenantNom" defaultValue={prise?.intervenantNom ?? ""} erreur={e.intervenantNom} />
            <ChampTexte libelle="Téléphone" name="telephone" type="tel" defaultValue={prise?.telephone ?? ""} erreur={e.telephone} />
            <ChampTexte libelle="Début" name="dateDebut" type="date" defaultValue={prise?.dateDebut ?? ""} />
            <ChampTexte libelle="Fin" name="dateFin" type="date" defaultValue={prise?.dateFin ?? ""} erreur={e.dateFin} aide="Une alerte s'affiche 30 jours avant." />
            {type === "apa" && (
              <ChampSelect libelle="GIR" name="gir" defaultValue={prise?.gir?.toString() ?? ""} vide="Inconnu" options={[1, 2, 3, 4, 5, 6].map((g) => ({ valeur: String(g), libelle: `GIR ${g}` }))} />
            )}
            <ChampTexte
              libelle="Heures ou visites par semaine"
              name="heuresParSemaine"
              inputMode="decimal"
              defaultValue={prise?.heuresParSemaine ?? ""}
              erreur={e.heuresParSemaine}
            />
            <ChampSelect
              libelle="Contact référent (cercle)"
              name="contactId"
              defaultValue={prise?.contactId ?? ""}
              vide="Aucun"
              options={cercle.map((c) => ({ valeur: c.id, libelle: c.nom }))}
              className="sm:col-span-2"
            />
          </div>
          <CaseACocher name="possedeCles" defaultChecked={prise?.possedeCles} libelle="L'intervenant possède les clés" />
        </>
      )}
    </DialogueFormulaire>
  );
}

function DialogueCreneau({
  ouvert,
  surChangement,
  prise,
  creneau,
  aujourdhui,
}: {
  ouvert: boolean;
  surChangement: (o: boolean) => void;
  prise: PriseEnChargeVue;
  creneau: CreneauVue | null;
  aujourdhui: string;
}) {
  const [exceptions, setExceptions] = useState<string[]>(creneau?.exceptions ?? []);
  const [nouvelle, setNouvelle] = useState("");
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre={creneau ? "Modifier le créneau de passage" : "Ajouter un créneau de passage"}
      description={`${PRISE_EN_CHARGE_LIBELLES[prise.type]}${prise.intervenantNom ? ` · ${prise.intervenantNom}` : ""}. Les passages du jour évitent les appels en doublon pendant une alerte.`}
      action={enregistrerCreneauAction.bind(null, { priseEnChargeId: prise.id, creneauId: creneau?.id ?? null })}
      libelleValider="Enregistrer le créneau"
    >
      {(e) => (
        <>
          <GroupeCases
            legende="Jours de passage"
            name="joursSemaine"
            options={JOURS_LONGS.map((j, i) => ({ valeur: String(i + 1), libelle: j.slice(0, 3) }))}
            valeurs={(creneau?.joursSemaine ?? [1, 2, 3, 4, 5]).map(String)}
            erreur={e.joursSemaine}
            colonnes={7}
          />
          <div className="grid grid-cols-2 gap-4">
            <ChampTexte libelle="De" name="heureDebut" type="time" defaultValue={creneau?.heureDebut ?? "09:00"} erreur={e.heureDebut} requis />
            <ChampTexte libelle="À" name="heureFin" type="time" defaultValue={creneau?.heureFin ?? "10:00"} erreur={e.heureFin} requis />
          </div>
          <fieldset className="flex flex-col gap-2 border-t pt-4">
            <legend className="text-[0.9375rem] font-medium">Exceptions (jours sans passage : férié, congés…)</legend>
            {exceptions.map((d) => (
              <span key={d} className="flex items-center justify-between gap-2">
                <input type="hidden" name="exceptions" value={d} />
                <span>{formaterDate(d)}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Retirer l'exception du ${formaterDate(d)}`} onClick={() => setExceptions(exceptions.filter((x) => x !== d))}>
                  <X aria-hidden />
                </Button>
              </span>
            ))}
            <div className="flex items-end gap-2">
              <ChampTexte libelle="Ajouter une date" type="date" min={aujourdhui} value={nouvelle} onChange={(ev) => setNouvelle(ev.target.value)} className="flex-1" />
              <Button
                type="button"
                variant="outline"
                disabled={!nouvelle}
                onClick={() => {
                  if (nouvelle && !exceptions.includes(nouvelle)) setExceptions([...exceptions, nouvelle].sort());
                  setNouvelle("");
                }}
              >
                Ajouter
              </Button>
            </div>
          </fieldset>
        </>
      )}
    </DialogueFormulaire>
  );
}

type Edition =
  | { genre: "prise"; prise: PriseEnChargeVue | null }
  | { genre: "creneau"; prise: PriseEnChargeVue; creneau: CreneauVue | null }
  | { genre: "retirerPrise"; prise: PriseEnChargeVue }
  | { genre: "retirerCreneau"; creneau: CreneauVue }
  | null;

export function GestionPrises({
  beneficiaireId,
  prises,
  structures,
  cercle,
  aujourdhui,
  modifiable,
}: {
  beneficiaireId: string;
  prises: PriseEnChargeVue[];
  structures: Option[];
  cercle: Option[];
  aujourdhui: string;
  modifiable: boolean;
}) {
  const [edition, setEdition] = useState<Edition>(null);
  const fermer = (o: boolean) => !o && setEdition(null);
  // Clé de remontage : chaque ouverture repart des valeurs de l'élément édité.
  const cle = edition ? JSON.stringify([edition.genre, "prise" in edition ? edition.prise?.id : null, "creneau" in edition ? edition.creneau?.id : null]) : "aucune";

  return (
    <Section
      titre="Prises en charge"
      actions={
        modifiable && (
          <Button variant="outline" onClick={() => setEdition({ genre: "prise", prise: null })}>
            <Plus aria-hidden />
            Ajouter une prise en charge
          </Button>
        )
      }
    >
      {prises.length === 0 ? (
        <p className="text-warn">Aucune prise en charge : la personne est « invisible » (aucun passage à domicile).</p>
      ) : (
        <ul className="divide-y">
          {prises.map((p) => {
            const active = estActive(p, aujourdhui);
            const echeance = joursAvantEcheance(p, aujourdhui);
            const avecPassages = PRISES_AVEC_PASSAGES.includes(p.type);
            return (
              <li key={p.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{PRISE_EN_CHARGE_LIBELLES[p.type]}</span>
                      <span className="text-muted-foreground">{p.structureNom ?? p.intervenantNom}</span>
                      {p.possedeCles && (
                        <span className="inline-flex items-center text-primary" title="Possède les clés">
                          <KeyRound className="size-4" aria-hidden />
                          <span className="sr-only">Possède les clés</span>
                        </span>
                      )}
                      {!active && <Pastille ton="neutre">{p.dateDebut && p.dateDebut > aujourdhui ? "À venir" : "Terminée"}</Pastille>}
                      {echeance !== null && (
                        <Pastille ton="warn">{echeance === 0 ? "Se termine aujourd'hui" : `Se termine dans ${echeance} jour${echeance > 1 ? "s" : ""}`}</Pastille>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        p.structureNom && p.intervenantNom && p.intervenantNom !== p.structureNom ? p.intervenantNom : null,
                        p.dateDebut && `depuis le ${formaterDate(p.dateDebut)}`,
                        p.dateFin && `jusqu'au ${formaterDate(p.dateFin)}`,
                        p.gir && `GIR ${p.gir}`,
                        p.heuresParSemaine && `${p.heuresParSemaine} h/semaine`,
                        p.contactNom && `référent : ${p.contactNom}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {p.telephone && (
                      <Button variant="ghost" nativeButton={false} render={<a href={`tel:${p.telephone.replace(/\s/g, "")}`} />} className="tabular">
                        <Phone aria-hidden />
                        {p.telephone}
                      </Button>
                    )}
                    {modifiable && (
                      <>
                        <Button variant="ghost" size="icon" aria-label="Modifier la prise en charge" onClick={() => setEdition({ genre: "prise", prise: p })}>
                          <Pencil aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Retirer la prise en charge" onClick={() => setEdition({ genre: "retirerPrise", prise: p })}>
                          <Trash2 aria-hidden />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {(p.creneaux.length > 0 || (avecPassages && modifiable)) && (
                  <ul className="flex flex-col gap-1 sm:pl-4">
                    {p.creneaux.map((c) => {
                      const aVenir = c.exceptions.filter((d) => d >= aujourdhui);
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <CalendarClock className="size-4 text-subtle-foreground" aria-hidden />
                          <span>{formaterCreneau(c)}</span>
                          {aVenir.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-sm text-warn">
                              <CalendarX className="size-4" aria-hidden />
                              Pas de passage le {aVenir.map(formaterDate).join(", ")}
                            </span>
                          )}
                          {modifiable && (
                            <span className="flex">
                              <Button variant="ghost" onClick={() => setEdition({ genre: "creneau", prise: p, creneau: c })}>
                                Modifier
                              </Button>
                              <Button variant="ghost" onClick={() => setEdition({ genre: "retirerCreneau", creneau: c })}>
                                Retirer
                              </Button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {modifiable && (
                      <li>
                        <Button variant="ghost" onClick={() => setEdition({ genre: "creneau", prise: p, creneau: null })}>
                          <Plus aria-hidden />
                          Ajouter un créneau de passage
                        </Button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modifiable && (
        <div key={cle}>
          <DialoguePrise
            ouvert={edition?.genre === "prise"}
            surChangement={fermer}
            beneficiaireId={beneficiaireId}
            prise={edition?.genre === "prise" ? edition.prise : null}
            structures={structures}
            cercle={cercle}
          />
          {edition?.genre === "creneau" && (
            <DialogueCreneau ouvert surChangement={fermer} prise={edition.prise} creneau={edition.creneau} aujourdhui={aujourdhui} />
          )}
          <DialogueConfirmation
            ouvert={edition?.genre === "retirerPrise"}
            surChangement={fermer}
            titre="Retirer cette prise en charge ?"
            description="Elle et son planning de passages seront supprimés. Le score de priorité sera recalculé."
            libelleValider="Retirer"
            destructif
            surConfirmation={() => (edition?.genre === "retirerPrise" ? lancer(() => retirerPriseEnChargeAction(edition.prise.id)) : Promise.resolve())}
          />
          <DialogueConfirmation
            ouvert={edition?.genre === "retirerCreneau"}
            surChangement={fermer}
            titre="Retirer ce créneau ?"
            description={edition?.genre === "retirerCreneau" ? formaterCreneau(edition.creneau) : ""}
            libelleValider="Retirer"
            destructif
            surConfirmation={() => (edition?.genre === "retirerCreneau" ? lancer(() => retirerCreneauAction(edition.creneau.id)) : Promise.resolve())}
          />
        </div>
      )}
    </Section>
  );
}
