"use client";

import { useId, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bandeau } from "@/shared/ui/elements";
import { formaterDateLongue, aujourdhui } from "@/shared/domain/dates";
import { formaterNom, formaterPrenom } from "@/shared/domain/normalisation";
import {
  DEPLACEMENTS,
  INDISPONIBILITE_LIBELLES,
  MODE_DE_VIE_LIBELLES,
  MODES_DE_VIE,
  CATEGORIES,
  PRISE_EN_CHARGE_LIBELLES,
  PROTECTION_LIBELLES,
  PROTECTIONS,
  RELATION_LIBELLES,
  RELATIONS,
  TYPES_INDISPONIBILITE,
  type TypeIndisponibilite,
} from "@/shared/domain/vocabulaire";
import { TYPES_INTERVENANT_FORMULAIRE } from "../../domain/formulaire";
import { contactVide, intervenantVide, type Erreurs, type Saisie } from "../../domain/etapes";
import { CaseACocher, ChampListe, ChampTexte, ChoixUnique, idChamp, MessageErreur, OuiNon } from "./champs";
import { ChampAdresse } from "./champ-adresse";

export type CommuneFormulaire = {
  nom: string;
  codePostal: string;
  structureNom: string;
  structureTelephone: string;
  rgpd: { responsable: string; conservation: string; dpo: string; droits: string };
};

export type ProprietesEtape = {
  saisie: Saisie;
  maj: (modifier: (s: Saisie) => void) => void;
  erreurs: Erreurs;
  commune: CommuneFormulaire;
  allerA: (etape: number) => void;
};

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Groupe de champs (une personne, un contact…) séparé par un filet, sans boîte. */
function Groupe({ titre, actions, children }: { titre: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-6 border-t border-input pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-xl font-bold">
          {titre}
        </h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

const LIBELLES_DEPLACEMENT: Record<(typeof DEPLACEMENTS)[number], string> = {
  seul: "Seul(e), sans aide",
  canne: "Avec une canne",
  deambulateur: "Avec un déambulateur",
  fauteuil: "En fauteuil roulant",
  immobilise: "Immobilisé(e), alité(e)",
};

const nomPersonne = (s: Saisie, i: number) => s.personnes[i].prenom.trim() || (i === 0 ? "la première personne" : "la deuxième personne");

// ─── 1. Qui remplit ? ─────────────────────────────────────────────────────────

export function EtapeQui({ saisie, maj, erreurs, commune }: ProprietesEtape) {
  return (
    <>
      <ChoixUnique
        cle="remplisseur"
        legende="Vous remplissez ce formulaire pour…"
        erreur={erreurs.remplisseur}
        valeur={saisie.remplisseur}
        onChange={(v) => maj((s) => void (s.remplisseur = v))}
        options={[
          { valeur: "moi", libelle: "Moi-même" },
          { valeur: "tiers", libelle: "Un proche ou une personne que j'aide", detail: "Enfant, voisin, aidant…" },
        ]}
      />
      {saisie.remplisseur === "tiers" && (
        <>
          <OuiNon
            cle="personneInformee"
            legende="La personne concernée est-elle informée de cette inscription et d'accord ?"
            aide="L'inscription au registre est volontaire."
            erreur={saisie.personneInformee === false ? undefined : erreurs.personneInformee}
            valeur={saisie.personneInformee}
            onChange={(v) => maj((s) => void (s.personneInformee = v))}
          />
          {saisie.personneInformee === false && (
            <Bandeau ton="err" className="flex flex-col gap-2 text-lg">
              <strong>L&apos;inscription ne peut pas être enregistrée.</strong>
              <span className="font-normal">
                Le registre des personnes vulnérables est à inscription volontaire : la personne doit être informée et d&apos;accord. Parlez-en
                d&apos;abord avec elle, puis revenez sur ce formulaire. Vous pouvez aussi appeler la {commune.structureNom} au{" "}
                <a className="font-semibold underline" href={`tel:${commune.structureTelephone.replace(/\s/g, "")}`}>
                  {commune.structureTelephone}
                </a>
                .
              </span>
            </Bandeau>
          )}
          {saisie.personneInformee === true && (
            <Groupe titre="Vos coordonnées">
              <ChampTexte cle="tiers.prenom" label="Votre prénom" facultatif autoComplete="given-name" valeur={saisie.tiers.prenom} onChange={(v) => maj((s) => void (s.tiers.prenom = v))} />
              <ChampTexte cle="tiers.nom" label="Votre nom" autoComplete="family-name" erreur={erreurs["tiers.nom"]} valeur={saisie.tiers.nom} onChange={(v) => maj((s) => void (s.tiers.nom = v))} />
              <ChampTexte cle="tiers.lien" label="Votre lien avec la personne" facultatif aide="Par exemple : fille, voisin, aide à domicile" valeur={saisie.tiers.lien} onChange={(v) => maj((s) => void (s.tiers.lien = v))} />
              <ChampTexte
                cle="tiers.telephone"
                label="Votre téléphone"
                aide="Format : 06 12 34 56 78"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                erreur={erreurs["tiers.telephone"]}
                valeur={saisie.tiers.telephone}
                onChange={(v) => maj((s) => void (s.tiers.telephone = v))}
              />
            </Groupe>
          )}
        </>
      )}
    </>
  );
}

// ─── 2. Personnes concernées ──────────────────────────────────────────────────

export function EtapePersonnes({ saisie, maj, erreurs }: ProprietesEtape) {
  return (
    <>
      <ChoixUnique
        cle="nombrePersonnes"
        legende="Combien de personnes souhaitez-vous inscrire ?"
        valeur={String(saisie.nombrePersonnes) as "1" | "2"}
        onChange={(v) => maj((s) => void (s.nombrePersonnes = v === "2" ? 2 : 1))}
        options={[
          { valeur: "1", libelle: "Une personne" },
          { valeur: "2", libelle: "Deux personnes du même foyer", detail: "Par exemple un couple" },
        ]}
      />
      {saisie.personnes.slice(0, saisie.nombrePersonnes).map((p, i) => {
        const e = (champ: string) => erreurs[`personnes.${i}.${champ}`];
        const majP = (f: (pers: Saisie["personnes"][number]) => void) => maj((s) => f(s.personnes[i]));
        return (
          <Groupe key={i} titre={saisie.nombrePersonnes === 2 ? (i === 0 ? "Première personne" : "Deuxième personne") : "Personne à inscrire"}>
            <ChoixUnique
              cle={`personnes.${i}.civilite`}
              legende="Civilité"
              enLigne
              erreur={e("civilite")}
              valeur={p.civilite}
              onChange={(v) => majP((x) => void (x.civilite = v))}
              options={[
                { valeur: "Mme", libelle: "Madame" },
                { valeur: "M.", libelle: "Monsieur" },
              ]}
            />
            <ChampTexte cle={`personnes.${i}.nom`} label="Nom" autoComplete={i === 0 && saisie.remplisseur === "moi" ? "family-name" : "off"} erreur={e("nom")} valeur={p.nom} onChange={(v) => majP((x) => void (x.nom = v))} />
            <ChampTexte cle={`personnes.${i}.prenom`} label="Prénom" autoComplete={i === 0 && saisie.remplisseur === "moi" ? "given-name" : "off"} erreur={e("prenom")} valeur={p.prenom} onChange={(v) => majP((x) => void (x.prenom = v))} />
            <ChampTexte
              cle={`personnes.${i}.dateNaissance`}
              label="Date de naissance"
              aide="Format : JJ/MM/AAAA, par exemple 12/03/1938"
              inputMode="numeric"
              placeholder="JJ/MM/AAAA"
              erreur={e("dateNaissance")}
              valeur={p.dateNaissance}
              onChange={(v) => majP((x) => void (x.dateNaissance = v))}
            />
            <ChampTexte
              cle={`personnes.${i}.telephone`}
              label="Téléphone"
              facultatif
              aide="Le numéro sur lequel la joindre en cas d'alerte. Format : 03 20 12 34 56"
              type="tel"
              inputMode="tel"
              erreur={e("telephone")}
              valeur={p.telephone}
              onChange={(v) => majP((x) => void (x.telephone = v))}
            />
            <ChampTexte cle={`personnes.${i}.email`} label="Adresse email" facultatif type="email" inputMode="email" erreur={e("email")} valeur={p.email} onChange={(v) => majP((x) => void (x.email = v))} />
          </Groupe>
        );
      })}
    </>
  );
}

// ─── 3. Adresse ───────────────────────────────────────────────────────────────

export function EtapeAdresse({ saisie, maj, erreurs, commune }: ProprietesEtape) {
  const a = saisie.adresse;
  const champ = (cle: keyof typeof a, label: string, props: Partial<React.ComponentProps<typeof ChampTexte>> = {}) => (
    <ChampTexte
      cle={`adresse.${cle}`}
      label={label}
      facultatif
      erreur={erreurs[`adresse.${cle}`]}
      valeur={String(a[cle] ?? "")}
      onChange={(v) => maj((s) => void ((s.adresse[cle] as string) = v))}
      {...props}
    />
  );
  return (
    <>
      <ChampAdresse
        adresse={a}
        codePostal={commune.codePostal}
        commune={commune.nom}
        erreur={erreurs["adresse.voie"]}
        onChange={(partiel) => maj((s) => void Object.assign(s.adresse, partiel))}
      />
      <p className="text-lg">
        <span className="text-muted-foreground">Commune : </span>
        {commune.codePostal} {commune.nom}
      </p>
      {champ("residence", "Résidence ou bâtiment")}
      <div className="grid gap-6 sm:grid-cols-2">
        {champ("entree", "Entrée")}
        {champ("appartement", "N° d'appartement")}
      </div>
      {champ("etage", "Étage", { inputMode: "numeric", aide: "0 pour le rez-de-chaussée", className: "max-w-60" })}
      <OuiNon cle="adresse.ascenseur" legende="Y a-t-il un ascenseur ?" facultatif valeur={a.ascenseur} onChange={(v) => maj((s) => void (s.adresse.ascenseur = v))} />
    </>
  );
}

// ─── 4. Situation personnelle ─────────────────────────────────────────────────

export function EtapeSituation({ saisie, maj, erreurs }: ProprietesEtape) {
  return (
    <>
      <ChoixUnique
        cle="modeDeVie"
        legende={saisie.nombrePersonnes === 2 ? "Le foyer" : "La personne vit…"}
        erreur={erreurs.modeDeVie}
        valeur={saisie.modeDeVie}
        onChange={(v) => maj((s) => void (s.modeDeVie = v))}
        options={MODES_DE_VIE.map((m) => ({ valeur: m, libelle: m === "tiers" ? "Avec un tiers (enfant, proche…)" : MODE_DE_VIE_LIBELLES[m] }))}
      />
      <ChoixUnique
        cle="categorie"
        legende="Situation"
        erreur={erreurs.categorie}
        valeur={saisie.categorie}
        onChange={(v) => maj((s) => void (s.categorie = v))}
        options={CATEGORIES.map((c) => ({ valeur: c, libelle: c === "senior" ? "Personne de 60 ans et plus" : "Personne en situation de handicap de moins de 60 ans" }))}
      />
      {saisie.personnes.slice(0, saisie.nombrePersonnes).map((p, i) => {
        const nom = nomPersonne(saisie, i);
        const e = (champ: string) => erreurs[`personnes.${i}.${champ}`];
        return (
          <Groupe key={i} titre={saisie.nombrePersonnes === 2 ? `Pour ${nom}` : "Autonomie"}>
            <ChoixUnique
              cle={`personnes.${i}.deplacement`}
              legende={`Comment ${saisie.nombrePersonnes === 2 ? nom : "la personne"} se déplace-t-elle dans son domicile ?`}
              erreur={e("deplacement")}
              valeur={p.deplacement}
              onChange={(v) => maj((s) => void (s.personnes[i].deplacement = v))}
              options={DEPLACEMENTS.map((d) => ({ valeur: d, libelle: LIBELLES_DEPLACEMENT[d] }))}
            />
            <ChoixUnique
              cle={`personnes.${i}.protection`}
              legende="Existe-t-il une mesure de protection ?"
              erreur={e("protection")}
              valeur={p.protection}
              onChange={(v) => maj((s) => void (s.personnes[i].protection = v))}
              options={PROTECTIONS.map((x) => ({ valeur: x, libelle: x === "non" ? "Non" : PROTECTION_LIBELLES[x] }))}
            />
            {p.protection && p.protection !== "non" && (
              <>
                <ChampTexte cle={`personnes.${i}.protectionStructure`} label="Structure ou personne qui exerce la mesure" erreur={e("protectionStructure")} valeur={p.protectionStructure} onChange={(v) => maj((s) => void (s.personnes[i].protectionStructure = v))} />
                <ChampTexte cle={`personnes.${i}.protectionTelephone`} label="Son téléphone" facultatif type="tel" inputMode="tel" erreur={e("protectionTelephone")} valeur={p.protectionTelephone} onChange={(v) => maj((s) => void (s.personnes[i].protectionTelephone = v))} />
              </>
            )}
          </Groupe>
        );
      })}
    </>
  );
}

// ─── 5. Intervenants ──────────────────────────────────────────────────────────

export function EtapeIntervenants({ saisie, maj, erreurs }: ProprietesEtape) {
  return (
    <>
      <OuiNon
        cle="servicesADomicile"
        legende="Des services ou des professionnels interviennent-ils au domicile ?"
        aide="Aide à domicile, portage de repas, infirmier, téléalarme, kinésithérapeute, médecin traitant…"
        erreur={erreurs.servicesADomicile}
        valeur={saisie.servicesADomicile}
        onChange={(v) => maj((s) => void (s.servicesADomicile = v))}
      />
      {saisie.servicesADomicile && (
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold">Cochez les intervenants concernés</p>
          <p className="text-base text-muted-foreground">
            Indiquer les jours et heures de passage habituels est facultatif : cela nous évite d&apos;appeler pendant une alerte quand un intervenant passe déjà.
          </p>
          {erreurs.intervenants && <MessageErreur id={`${idChamp("intervenants")}-erreur`}>{erreurs.intervenants}</MessageErreur>}
          <div id={idChamp("intervenants")} tabIndex={-1} className="flex flex-col outline-none">
            {TYPES_INTERVENANT_FORMULAIRE.map((type) => {
              const index = saisie.intervenants.findIndex((x) => x.type === type);
              const it = index >= 0 ? saisie.intervenants[index] : null;
              const e = (champ: string) => erreurs[`intervenants.${index}.${champ}`];
              const majI = (f: (x: NonNullable<typeof it>) => void) => maj((s) => f(s.intervenants[index]));
              return (
                <div key={type} className="flex flex-col gap-5 border-t border-input py-4">
                  <CaseACocher
                    cle={`intervenant-${type}`}
                    label={PRISE_EN_CHARGE_LIBELLES[type]}
                    coche={it !== null}
                    onChange={(coche) =>
                      maj((s) => {
                        s.intervenants = coche ? [...s.intervenants, intervenantVide(type)] : s.intervenants.filter((x) => x.type !== type);
                      })
                    }
                  />
                  {it && (
                    <div className="flex flex-col gap-5 sm:pl-9">
                      <ChampTexte cle={`intervenants.${index}.nom`} label="Nom du service ou de l'intervenant" erreur={e("nom")} valeur={it.nom} onChange={(v) => majI((x) => void (x.nom = v))} />
                      <ChampTexte cle={`intervenants.${index}.telephone`} label="Téléphone" facultatif type="tel" inputMode="tel" erreur={e("telephone")} valeur={it.telephone} onChange={(v) => majI((x) => void (x.telephone = v))} />
                      <CaseACocher cle={`intervenants.${index}.possedeCles`} label="Possède les clés du logement" coche={it.possedeCles} onChange={(v) => majI((x) => void (x.possedeCles = v))} />
                      <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-lg font-semibold">
                          Jours de passage habituels <span className="font-normal text-muted-foreground">(facultatif)</span>
                        </legend>
                        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
                          {JOURS.map((jour, j) => (
                            <CaseACocher
                              key={jour}
                              cle={`intervenants.${index}.jour-${j + 1}`}
                              label={jour}
                              coche={it.joursPassage.includes(j + 1)}
                              onChange={(v) =>
                                majI((x) => {
                                  x.joursPassage = v ? [...x.joursPassage, j + 1] : x.joursPassage.filter((n) => n !== j + 1);
                                })
                              }
                            />
                          ))}
                        </div>
                      </fieldset>
                      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                        <ChampTexte cle={`intervenants.${index}.heurePassage`} label="Arrivée vers" facultatif type="time" erreur={e("heurePassage")} valeur={it.heurePassage} onChange={(v) => majI((x) => void (x.heurePassage = v))} />
                        <ChampTexte cle={`intervenants.${index}.heureFinPassage`} label="Départ vers" facultatif type="time" erreur={e("heureFinPassage")} valeur={it.heureFinPassage} onChange={(v) => majI((x) => void (x.heureFinPassage = v))} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── 6. Personnes à prévenir ──────────────────────────────────────────────────

export function EtapeContacts({ saisie, maj, erreurs }: ProprietesEtape) {
  return (
    <>
      <Bandeau ton="accent" className="text-lg">
        Il est fortement conseillé aux proches de prendre fréquemment des nouvelles des personnes inscrites lorsque le plan est déclenché.
      </Bandeau>
      <p className="text-lg">Indiquez au moins une personne à prévenir en cas d&apos;urgence, et jusqu&apos;à cinq, dans l&apos;ordre où il faut les appeler.</p>
      {erreurs.contactsUrgence && <MessageErreur id={`${idChamp("contactsUrgence")}-erreur`}>{erreurs.contactsUrgence}</MessageErreur>}
      {saisie.contactsUrgence.map((c, i) => {
        const e = (champ: string) => erreurs[`contactsUrgence.${i}.${champ}`];
        const majC = (f: (x: typeof c) => void) => maj((s) => f(s.contactsUrgence[i]));
        return (
          <Groupe
            key={i}
            titre={`Personne à prévenir n° ${i + 1}`}
            actions={
              saisie.contactsUrgence.length > 1 && (
                <Button variant="ghost" onClick={() => maj((s) => void s.contactsUrgence.splice(i, 1))}>
                  <Trash2 aria-hidden />
                  Retirer<span className="sr-only"> la personne n° {i + 1}</span>
                </Button>
              )
            }
          >
            <ChampTexte cle={`contactsUrgence.${i}.prenom`} label="Prénom" erreur={e("prenom")} valeur={c.prenom} onChange={(v) => majC((x) => void (x.prenom = v))} />
            <ChampTexte cle={`contactsUrgence.${i}.nom`} label="Nom" erreur={e("nom")} valeur={c.nom} onChange={(v) => majC((x) => void (x.nom = v))} />
            <ChampListe
              cle={`contactsUrgence.${i}.relation`}
              label="Lien avec la personne"
              erreur={e("relation")}
              valeur={c.relation}
              onChange={(v) => majC((x) => void (x.relation = v as typeof x.relation))}
              options={RELATIONS.map((r) => ({ valeur: r, libelle: RELATION_LIBELLES[r] }))}
            />
            <ChampTexte cle={`contactsUrgence.${i}.telephone`} label="Téléphone" aide="Format : 06 12 34 56 78" type="tel" inputMode="tel" erreur={e("telephone")} valeur={c.telephone} onChange={(v) => majC((x) => void (x.telephone = v))} />
            <ChampTexte cle={`contactsUrgence.${i}.ville`} label="Ville où elle habite" facultatif valeur={c.ville} onChange={(v) => majC((x) => void (x.ville = v))} />
            <CaseACocher cle={`contactsUrgence.${i}.possedeCles`} label="Possède les clés du logement" coche={c.possedeCles} onChange={(v) => majC((x) => void (x.possedeCles = v))} />
          </Groupe>
        );
      })}
      {saisie.contactsUrgence.length < 5 && (
        <Button variant="outline" size="lg" className="self-start" onClick={() => maj((s) => void s.contactsUrgence.push(contactVide()))}>
          <Plus aria-hidden />
          Ajouter une personne à prévenir
        </Button>
      )}
    </>
  );
}

// ─── 7. Absences ──────────────────────────────────────────────────────────────

export function EtapeAbsences({ saisie, maj, erreurs }: ProprietesEtape) {
  return (
    <>
      <p className="text-lg">
        Vous prévoyez de vous absenter (vacances, séjour chez un proche, hospitalisation programmée) ? Indiquez-le : nous ne chercherons pas à vous joindre à
        domicile pendant ces périodes.
      </p>
      {saisie.absences.length === 0 && <p className="text-lg text-muted-foreground">Aucune absence prévue pour l&apos;instant. Vous pouvez passer à l&apos;étape suivante.</p>}
      {saisie.absences.map((a, i) => {
        const e = (champ: string) => erreurs[`absences.${i}.${champ}`];
        return (
          <Groupe
            key={i}
            titre={`Absence n° ${i + 1}`}
            actions={
              <Button variant="ghost" onClick={() => maj((s) => void s.absences.splice(i, 1))}>
                <Trash2 aria-hidden />
                Retirer<span className="sr-only"> l&apos;absence n° {i + 1}</span>
              </Button>
            }
          >
            <ChampListe
              cle={`absences.${i}.type`}
              label="Motif"
              valeur={a.type}
              onChange={(v) => maj((s) => void (s.absences[i].type = (v || "vacances") as TypeIndisponibilite))}
              options={TYPES_INDISPONIBILITE.map((t) => ({ valeur: t, libelle: INDISPONIBILITE_LIBELLES[t] }))}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <ChampTexte cle={`absences.${i}.debut`} label="Date de départ" type="date" erreur={e("debut")} valeur={a.debut} onChange={(v) => maj((s) => void (s.absences[i].debut = v))} />
              <ChampTexte cle={`absences.${i}.fin`} label="Date de retour" type="date" erreur={e("fin")} valeur={a.fin} onChange={(v) => maj((s) => void (s.absences[i].fin = v))} />
            </div>
          </Groupe>
        );
      })}
      <Button variant="outline" size="lg" className="self-start" onClick={() => maj((s) => void s.absences.push({ type: "vacances", debut: "", fin: "" }))}>
        <Plus aria-hidden />
        Ajouter une absence
      </Button>
    </>
  );
}

// ─── 8. Informations complémentaires ──────────────────────────────────────────

export function EtapeComplements({ saisie, maj }: ProprietesEtape) {
  return (
    <>
      <p className="text-lg text-muted-foreground">Ces questions sont facultatives, mais elles nous aident à mieux vous protéger pendant une canicule.</p>
      <OuiNon cle="sousLesToits" legende="Le logement est-il situé sous les toits ?" facultatif valeur={saisie.sousLesToits} onChange={(v) => maj((s) => void (s.sousLesToits = v))} />
      <OuiNon cle="pieceFraiche" legende="Le logement dispose-t-il d'une pièce qui reste fraîche ?" facultatif valeur={saisie.pieceFraiche} onChange={(v) => maj((s) => void (s.pieceFraiche = v))} />
      <OuiNon cle="troublesAuditifs" legende="La personne entend-elle mal au téléphone ?" facultatif valeur={saisie.troublesAuditifs} onChange={(v) => maj((s) => void (s.troublesAuditifs = v))} />
      <ChoixUnique
        cle="preferenceHoraire"
        legende="À quel moment préférez-vous être appelé(e) ?"
        facultatif
        valeur={saisie.preferenceHoraire as "Le matin" | "L'après-midi" | "En fin de journée" | "Indifférent"}
        onChange={(v) => maj((s) => void (s.preferenceHoraire = v))}
        options={["Le matin", "L'après-midi", "En fin de journée", "Indifférent"].map((v) => ({ valeur: v as "Le matin", libelle: v }))}
      />
      <OuiNon
        cle="accordAppelIa"
        legende="Acceptez-vous d'être appelé(e) par un assistant téléphonique automatique pendant une alerte ?"
        aide="Il pose quelques questions simples. Un agent du CCAS vous rappelle toujours en cas de besoin ou si vous le demandez."
        facultatif
        valeur={saisie.accordAppelIa}
        onChange={(v) => maj((s) => void (s.accordAppelIa = v))}
      />
    </>
  );
}

// ─── 9. Consentement ──────────────────────────────────────────────────────────

export function EtapeConsentement({ saisie, maj, erreurs, commune, allerA }: ProprietesEtape) {
  const personnes = saisie.personnes
    .slice(0, saisie.nombrePersonnes)
    .map((p) => `${p.civilite === "Mme" ? "Madame" : "Monsieur"} ${formaterPrenom(p.prenom)} ${formaterNom(p.nom)}`)
    .join(", ");
  const recap = [
    { libelle: saisie.nombrePersonnes === 2 ? "Personnes" : "Personne", valeur: personnes, etape: 1 },
    { libelle: "Adresse", valeur: `${saisie.adresse.libelle}${saisie.adresse.etage ? `, étage ${saisie.adresse.etage}` : ""}`, etape: 2 },
    {
      libelle: "À prévenir",
      valeur: saisie.contactsUrgence.map((c) => `${c.prenom} ${c.nom} (${c.telephone})`).join(", "),
      etape: 5,
    },
  ];
  return (
    <>
      <section aria-labelledby="titre-recap" className="flex flex-col gap-3">
        <h2 id="titre-recap" className="text-xl font-bold">
          Vérifiez votre demande
        </h2>
        <dl className="flex flex-col divide-y divide-input border-y border-input">
          {recap.map((r) => (
            <div key={r.libelle} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <dt className="text-base text-muted-foreground">{r.libelle}</dt>
                <dd className="text-lg break-words">{r.valeur}</dd>
              </div>
              <Button variant="ghost" onClick={() => allerA(r.etape)}>
                Modifier<span className="sr-only"> : {r.libelle}</span>
              </Button>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="titre-rgpd" className="flex flex-col gap-3 text-base">
        <h2 id="titre-rgpd" className="text-xl font-bold">
          Protection de vos données
        </h2>
        <p>
          Les informations recueillies alimentent le registre nominatif des personnes vulnérables prévu par l&apos;article L121-6-1 du Code de l&apos;action sociale et des
          familles. Elles ne servent qu&apos;à vous contacter et à vous porter assistance en cas de déclenchement d&apos;un plan d&apos;alerte et d&apos;urgence (canicule, grand froid,
          inondation…).
        </p>
        <p>
          <strong>Responsable du traitement :</strong> {commune.rgpd.responsable}.
        </p>
        <p>
          <strong>Conservation :</strong> {commune.rgpd.conservation}
        </p>
        <p>
          <strong>Vos droits :</strong> {commune.rgpd.droits}
        </p>
        <p>
          <strong>Délégué à la protection des données :</strong>{" "}
          <a className="font-semibold text-primary underline" href={`mailto:${commune.rgpd.dpo}`}>
            {commune.rgpd.dpo}
          </a>
        </p>
      </section>
      <CaseACocher
        cle="consentement"
        label="J'accepte que ces informations soient enregistrées dans le registre des personnes vulnérables."
        detail="Cette case remplace votre signature."
        erreur={erreurs.consentement}
        coche={saisie.consentement}
        onChange={(v) => maj((s) => void (s.consentement = v))}
      />
      <p className="text-lg text-muted-foreground">
        Fait à {commune.nom}, le {formaterDateLongue(aujourdhui())}.
      </p>
    </>
  );
}
