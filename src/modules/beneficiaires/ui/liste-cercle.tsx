"use client";
/**
 * E2-US1 / E2-US2 / E2-US4 — Liste du cercle triée par rang d'appel, ajout (nouveau contact ou contact
 * existant partagé), modification (répercutée sur toutes les fiches liées) et retrait.
 */
import { useEffect, useState } from "react";
import { KeyRound, Pencil, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pastille, Section } from "@/shared/ui/elements";
import { RELATION_LIBELLES, RELATIONS } from "@/shared/domain/vocabulaire";
import type { ContactTrouve, LienCercleVue } from "../application/ports";
import { ajouterAuCercleAction, chercherContactsAction, modifierMembreCercleAction, retirerDuCercleAction } from "./actions";
import { CaseACocher, ChampSelect, ChampTexte, lancer } from "./champs";
import { DialogueConfirmation, DialogueFormulaire } from "./dialogue-formulaire";
import { options } from "./libelles";

const nomDe = (c: { prenom: string | null; nom: string }) => [c.prenom, c.nom].filter(Boolean).join(" ");

function ChampsContact({ e, contact }: { e: Partial<Record<string, string>>; contact?: LienCercleVue["contact"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChampTexte libelle="Prénom" name="prenom" defaultValue={contact?.prenom ?? ""} erreur={e.prenom} />
      <ChampTexte libelle="Nom" name="nom" defaultValue={contact?.nom ?? ""} erreur={e.nom} requis />
      <ChampTexte libelle="Téléphone" name="telephone" type="tel" defaultValue={contact?.telephone ?? ""} erreur={e.telephone} />
      <ChampTexte libelle="Autre téléphone" name="telephone2" type="tel" defaultValue={contact?.telephone2 ?? ""} erreur={e.telephone2} />
      <ChampTexte libelle="Email" name="email" type="email" defaultValue={contact?.email ?? ""} erreur={e.email} />
      <ChampTexte libelle="Ville" name="ville" defaultValue={contact?.ville ?? ""} aide="Pour savoir s'il peut se déplacer rapidement." />
      <ChampTexte libelle="Structure (si professionnel)" name="structure" defaultValue={contact?.structure ?? ""} />
      <ChampTexte libelle="Disponibilités" name="disponibilites" defaultValue={contact?.disponibilites ?? ""} placeholder="Ex. le soir après 18h" />
    </div>
  );
}

function ChampsLien({ e, lien, rangDefaut }: { e: Partial<Record<string, string>>; lien?: LienCercleVue; rangDefaut: number }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampSelect libelle="Lien avec la personne" name="relation" defaultValue={lien?.relation ?? ""} vide="Choisir" options={options(RELATIONS, RELATION_LIBELLES)} erreur={e.relation} requis />
        <ChampTexte libelle="Rang d'appel" name="rangAppel" type="number" min={1} max={20} defaultValue={lien?.rangAppel ?? rangDefaut} erreur={e.rangAppel} aide="1 = appelé en premier si la personne ne répond pas." requis />
      </div>
      <div className="flex flex-col">
        <CaseACocher name="possedeCles" defaultChecked={lien?.possedeCles} libelle="Possède les clés du logement" />
        <CaseACocher name="estUrgence" defaultChecked={lien?.estUrgence ?? true} libelle="Personne à prévenir en cas d'urgence" />
        <CaseACocher name="estRepresentantLegal" defaultChecked={lien?.estRepresentantLegal} libelle="Représentant légal" />
      </div>
    </>
  );
}

/** Recherche d'un contact déjà connu (gardienne, infirmière libérale…) pour le partager. */
function RechercheContact({ choisi, surChoix }: { choisi: ContactTrouve | null; surChoix: (c: ContactTrouve | null) => void }) {
  const [texte, setTexte] = useState("");
  const [resultats, setResultats] = useState<ContactTrouve[]>([]);
  useEffect(() => {
    if (texte.trim().length < 2) return;
    let actif = true;
    const minuterie = setTimeout(async () => {
      const r = await chercherContactsAction(texte).catch(() => []);
      if (actif) setResultats(r);
    }, 250);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [texte]);

  if (choisi) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <input type="hidden" name="contactExistantId" value={choisi.id} />
        <div className="flex flex-col">
          <span className="font-semibold">{nomDe(choisi)}</span>
          <span className="text-sm text-muted-foreground">
            {[choisi.structure, choisi.telephone, `déjà lié à ${choisi.nbBeneficiaires} bénéficiaire${choisi.nbBeneficiaires > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          </span>
        </div>
        <Button type="button" variant="ghost" onClick={() => surChoix(null)}>
          Choisir un autre contact
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <ChampTexte
        libelle={
          <span className="flex items-center gap-2">
            <Search className="size-4" aria-hidden />
            Contact déjà connu ?
          </span>
        }
        value={texte}
        onChange={(ev) => {
          setTexte(ev.target.value);
          if (ev.target.value.trim().length < 2) setResultats([]);
        }}
        placeholder="Nom, structure ou téléphone"
        aide="Une même personne (gardienne, infirmière…) peut suivre plusieurs bénéficiaires : ses coordonnées restent uniques."
        autoComplete="off"
      />
      {texte.trim().length >= 2 && (
        <ul className="divide-y" aria-label="Contacts trouvés">
          {resultats.length === 0 && <li className="py-2 text-muted-foreground">Aucun contact trouvé : remplissez la fiche ci-dessous.</li>}
          {resultats.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => surChoix(c)} className="flex min-h-11 w-full flex-col items-start py-2 text-left hover:text-primary">
                <span className="font-medium">{nomDe(c)}</span>
                <span className="text-sm text-muted-foreground">{[c.structure, c.telephone, c.ville].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DialogueAjoutContact({ ouvert, surChangement, beneficiaireId, rangDefaut }: { ouvert: boolean; surChangement: (o: boolean) => void; beneficiaireId: string; rangDefaut: number }) {
  const [existant, setExistant] = useState<ContactTrouve | null>(null);
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={(o) => {
        if (!o) setExistant(null);
        surChangement(o);
      }}
      titre="Ajouter un contact au cercle"
      action={ajouterAuCercleAction.bind(null, beneficiaireId)}
      libelleValider="Ajouter au cercle"
    >
      {(e) => (
        <>
          <RechercheContact choisi={existant} surChoix={setExistant} />
          {!existant && <ChampsContact e={e} />}
          <ChampsLien e={e} rangDefaut={rangDefaut} />
        </>
      )}
    </DialogueFormulaire>
  );
}

export function ListeCercle({ beneficiaireId, liens, modifiable }: { beneficiaireId: string; liens: LienCercleVue[]; modifiable: boolean }) {
  const [ajout, setAjout] = useState(false);
  const [edition, setEdition] = useState<LienCercleVue | null>(null);
  const [retrait, setRetrait] = useState<LienCercleVue | null>(null);
  const rangSuivant = liens.reduce((max, l) => Math.max(max, l.rangAppel), 0) + 1;

  return (
    <Section
      titre="Contacts par ordre d'appel"
      actions={
        modifiable && (
          <Button variant="outline" onClick={() => setAjout(true)}>
            <Plus aria-hidden />
            Ajouter un contact
          </Button>
        )
      }
    >
      {liens.length === 0 ? (
        <p className="text-muted-foreground">Aucun contact dans le cercle. Ajoutez au moins une personne à prévenir en cas d&apos;urgence.</p>
      ) : (
        <ol className="divide-y">
          {liens.map((l) => (
            <li key={l.lienId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
              <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-primary" aria-label={`Rang ${l.rangAppel}`}>
                {l.rangAppel}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{nomDe(l.contact)}</span>
                  {l.possedeCles && (
                    <span className="inline-flex items-center gap-1 text-primary" title="Possède les clés">
                      <KeyRound className="size-4" aria-hidden />
                      <span className="sr-only">Possède les clés</span>
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {RELATION_LIBELLES[l.relation]}
                    {l.contact.structure && ` · ${l.contact.structure}`}
                    {l.contact.ville && ` · ${l.contact.ville}`}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {l.estUrgence && <Pastille ton="accent">Urgence</Pastille>}
                  {l.estRepresentantLegal && <Pastille ton="neutre">Représentant légal</Pastille>}
                  {l.partageAvec > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="size-4" aria-hidden />
                      Partagé avec {l.partageAvec} autre{l.partageAvec > 1 ? "s" : ""} bénéficiaire{l.partageAvec > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {l.contact.disponibilites && <p className="text-sm text-muted-foreground">{l.contact.disponibilites}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                {l.contact.telephone && (
                  <Button variant="ghost" nativeButton={false} render={<a href={`tel:${l.contact.telephone.replace(/\s/g, "")}`} />} className="tabular">
                    <Phone aria-hidden />
                    {l.contact.telephone}
                  </Button>
                )}
                {modifiable && (
                  <>
                    <Button variant="ghost" size="icon" aria-label={`Modifier ${nomDe(l.contact)}`} onClick={() => setEdition(l)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Retirer ${nomDe(l.contact)} du cercle`} onClick={() => setRetrait(l)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {modifiable && (
        <>
          <DialogueAjoutContact ouvert={ajout} surChangement={setAjout} beneficiaireId={beneficiaireId} rangDefaut={rangSuivant} />
          <DialogueFormulaire
            ouvert={edition !== null}
            surChangement={(o) => !o && setEdition(null)}
            titre={edition ? `Modifier ${nomDe(edition.contact)}` : "Modifier le contact"}
            description={
              edition && edition.partageAvec > 0
                ? `Ce contact est partagé avec ${edition.partageAvec} autre${edition.partageAvec > 1 ? "s" : ""} bénéficiaire${edition.partageAvec > 1 ? "s" : ""} : ses coordonnées seront mises à jour partout.`
                : undefined
            }
            action={modifierMembreCercleAction.bind(null, edition?.lienId ?? "")}
            libelleValider="Enregistrer"
          >
            {(e) =>
              edition && (
                <>
                  <ChampsContact e={e} contact={edition.contact} />
                  <div className="flex flex-col gap-4 border-t pt-4">
                    <ChampsLien e={e} lien={edition} rangDefaut={edition.rangAppel} />
                  </div>
                </>
              )
            }
          </DialogueFormulaire>
          <DialogueConfirmation
            ouvert={retrait !== null}
            surChangement={(o) => !o && setRetrait(null)}
            titre="Retirer ce contact du cercle ?"
            description={
              retrait
                ? `${nomDe(retrait.contact)} ne sera plus contacté pour cette personne.${retrait.partageAvec > 0 ? " Il reste lié aux autres bénéficiaires." : ""}`
                : ""
            }
            libelleValider="Retirer du cercle"
            destructif
            surConfirmation={() => lancer(() => retirerDuCercleAction(retrait!.lienId))}
          />
        </>
      )}
    </Section>
  );
}
