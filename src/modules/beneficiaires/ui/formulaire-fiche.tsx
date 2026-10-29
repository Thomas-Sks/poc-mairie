"use client";
/**
 * E1-US1 / E1-US3 — Formulaire de fiche (création et modification), découpé en sections lisibles.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bandeau, Surface } from "@/shared/ui/elements";
import {
  CAISSE_RETRAITE_LIBELLES,
  CAISSES_RETRAITE,
  ORIGINE_INSCRIPTION_LIBELLES,
  ORIGINES_INSCRIPTION,
  CATEGORIE_LIBELLES,
  CATEGORIES,
  CIVILITES,
  DEPLACEMENT_LIBELLES,
  DEPLACEMENTS,
  MODE_DE_VIE_LIBELLES,
  MODES_DE_VIE,
  PREFERENCE_CONTACT_LIBELLES,
  PREFERENCES_CONTACT,
  PROTECTION_LIBELLES,
  PROTECTIONS,
  SEXE_LIBELLES,
  SEXES,
  TYPE_LOGEMENT_LIBELLES,
  TYPES_LOGEMENT,
} from "@/shared/domain/vocabulaire";
import type { SaisieFiche } from "../domain/fiche";
import { ChampAdresse, type AdresseInitiale } from "./champ-adresse";
import { CaseACocher, ChampSelect, ChampTexte, ChampZoneTexte, ChoixOuiNon, GroupeCases, useFormulaire } from "./champs";
import type { EtatAction } from "./etat-action";
import { options } from "./libelles";

const APPAREILLAGES = ["Canne", "Déambulateur", "Fauteuil roulant", "Oxygène", "Lit médicalisé", "Appareil auditif"];

function SectionFormulaire({ titre, description, children }: { titre: string; description?: string; children: ReactNode }) {
  return (
    <Surface className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{titre}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </Surface>
  );
}

export function FormulaireFiche({
  mode,
  initiale,
  adresseInitiale,
  tags,
  codePostal,
  droitSante,
  action,
  annulerHref,
}: {
  mode: "creation" | "modification";
  initiale: SaisieFiche;
  adresseInitiale: AdresseInitiale | null;
  tags: string[];
  codePostal: string;
  droitSante: boolean;
  action: (etat: EtatAction, fd: FormData) => Promise<EtatAction>;
  annulerHref: string;
}) {
  const { etat, onSubmit, enCours } = useFormulaire(action);
  const b = initiale.beneficiaire;
  const sante = initiale.sante;
  const f = initiale.foyer;
  const e = etat.erreurs ?? {};
  const [pasDeTelephone, setPasDeTelephone] = useState(b.pasDeTelephone);
  const [protection, setProtection] = useState(b.protection);
  const [teleassistance, setTeleassistance] = useState(sante?.teleassistance ?? false);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <SectionFormulaire titre="Identité">
        <ChampSelect libelle="Civilité" name="civilite" defaultValue={b.civilite} options={CIVILITES.map((c) => ({ valeur: c, libelle: c }))} erreur={e.civilite} requis />
        <ChampSelect libelle="Sexe" name="sexe" defaultValue={b.sexe} options={options(SEXES, SEXE_LIBELLES)} erreur={e.sexe} requis />
        <ChampTexte libelle="Nom" name="nom" defaultValue={b.nom} erreur={e.nom} requis autoComplete="off" />
        <ChampTexte libelle="Prénom" name="prenom" defaultValue={b.prenom} erreur={e.prenom} requis autoComplete="off" />
        <ChampTexte libelle="Nom de naissance" name="nomNaissance" defaultValue={b.nomNaissance ?? ""} autoComplete="off" />
        <ChampTexte
          libelle="Date de naissance"
          name="dateNaissance"
          type="date"
          defaultValue={b.dateNaissance}
          erreur={e.dateNaissance}
          aide="L'âge est calculé automatiquement."
          requis
        />
      </SectionFormulaire>

      <SectionFormulaire titre="Adresse et logement">
        <ChampAdresse initiale={adresseInitiale} erreur={e.adresse ?? e.voie} codePostal={codePostal} />
        <ChampTexte libelle="Résidence" name="residence" defaultValue={f.residence ?? ""} />
        <ChampTexte libelle="Bâtiment" name="batiment" defaultValue={f.batiment ?? ""} />
        <ChampTexte libelle="Entrée" name="entree" defaultValue={f.entree ?? ""} />
        <ChampTexte libelle="N° d'appartement" name="appartement" defaultValue={f.appartement ?? ""} />
        <ChampTexte libelle="Étage" name="etage" type="number" min={0} max={40} inputMode="numeric" defaultValue={f.etage ?? ""} erreur={e.etage} />
        <ChampTexte libelle="Code d'accès / digicode" name="codeAcces" defaultValue={f.codeAcces ?? ""} />
        <ChoixOuiNon libelle="Ascenseur" name="ascenseur" valeur={f.ascenseur} />
        <ChampSelect libelle="Type de logement" name="typeLogement" defaultValue={f.typeLogement ?? ""} vide="Non renseigné" options={options(TYPES_LOGEMENT, TYPE_LOGEMENT_LIBELLES)} />
        <ChoixOuiNon libelle="Logement climatisé ou pièce fraîche" name="pieceFraiche" valeur={f.pieceFraiche} />
        <CaseACocher name="sousLesToits" defaultChecked={f.sousLesToits} libelle="Logement sous les toits" className="self-end" />
        <ChampTexte libelle="Animaux" name="animaux" defaultValue={f.animaux ?? ""} placeholder="Ex. un chat" className="sm:col-span-2" />
      </SectionFormulaire>

      <SectionFormulaire titre="Coordonnées" description="Au moins un téléphone, ou cochez « Pas de téléphone » (une visite sera alors nécessaire).">
        <ChampTexte libelle="Téléphone fixe" name="telephoneFixe" type="tel" defaultValue={b.telephoneFixe ?? ""} erreur={e.telephoneFixe ?? e.telephone} disabled={pasDeTelephone} placeholder="01 23 45 67 89" />
        <ChampTexte libelle="Téléphone mobile" name="telephoneMobile" type="tel" defaultValue={b.telephoneMobile ?? ""} erreur={e.telephoneMobile} disabled={pasDeTelephone} placeholder="06 12 34 56 78" />
        <CaseACocher
          name="pasDeTelephone"
          checked={pasDeTelephone}
          onChange={(ev) => setPasDeTelephone(ev.target.checked)}
          libelle="Pas de téléphone"
          className="sm:col-span-2"
        />
        <ChampTexte libelle="Email" name="email" type="email" defaultValue={b.email ?? ""} erreur={e.email} />
        <ChampTexte libelle="Langue parlée" name="langue" defaultValue={b.langue} />
        <ChampSelect
          libelle="Préférence de contact"
          name="preferenceContact"
          defaultValue={b.preferenceContact ?? ""}
          vide="Non renseignée"
          options={options(PREFERENCES_CONTACT, PREFERENCE_CONTACT_LIBELLES)}
        />
        <ChampTexte libelle="Créneaux préférés pour être appelé(e)" name="creneauxAppel" defaultValue={b.creneauxAppel ?? ""} placeholder="Ex. le matin après 10h" />
      </SectionFormulaire>

      <SectionFormulaire titre="Situation">
        <ChampSelect libelle="Mode de vie" name="modeDeVie" defaultValue={b.modeDeVie ?? ""} vide="Non renseigné" options={options(MODES_DE_VIE, MODE_DE_VIE_LIBELLES)} />
        <ChampSelect libelle="Catégorie" name="categorie" defaultValue={b.categorie} options={options(CATEGORIES, CATEGORIE_LIBELLES)} />
        <ChampSelect
          libelle="Mesure de protection"
          name="protection"
          value={protection}
          onChange={(ev) => setProtection(ev.target.value as typeof protection)}
          options={options(PROTECTIONS, PROTECTION_LIBELLES)}
        />
        <div className="hidden sm:block" />
        {protection !== "non" && (
          <>
            <ChampTexte libelle="Structure du mandataire" name="mandataireStructure" defaultValue={b.mandataireStructure ?? ""} erreur={e.mandataireStructure} requis />
            <ChampTexte libelle="Téléphone du mandataire" name="mandataireTelephone" type="tel" defaultValue={b.mandataireTelephone ?? ""} erreur={e.mandataireTelephone} />
          </>
        )}
      </SectionFormulaire>

      <SectionFormulaire titre="Aides et droits">
        <ChampSelect
          libelle="Caisse de retraite"
          name="caisseRetraite"
          defaultValue={b.caisseRetraite ?? ""}
          vide="Non renseignée"
          options={options(CAISSES_RETRAITE, CAISSE_RETRAITE_LIBELLES)}
        />
        <ChampSelect
          libelle="Origine de l'inscription"
          name="origineInscription"
          defaultValue={b.origineInscription}
          options={options(ORIGINES_INSCRIPTION, ORIGINE_INSCRIPTION_LIBELLES)}
        />
        <CaseACocher name="aideCaisseRetraite" defaultChecked={b.aideCaisseRetraite} libelle="Reçoit une aide de sa caisse de retraite" />
        <p className="text-sm text-muted-foreground sm:col-span-2">L&apos;APA et la PCH se déclarent dans l&apos;onglet Intervenants, avec le niveau GIR.</p>
      </SectionFormulaire>

      {droitSante && sante && (
        <SectionFormulaire titre="Autonomie et santé" description="Données sensibles : visibles uniquement par les personnes habilitées.">
          <ChampSelect
            libelle="Déplacement dans le domicile"
            name="deplacement"
            defaultValue={sante.deplacement ?? ""}
            vide="Non renseigné"
            options={options(DEPLACEMENTS, DEPLACEMENT_LIBELLES)}
          />
          <ChampSelect
            libelle="Niveau GIR (si connu)"
            name="gir"
            defaultValue={sante.gir?.toString() ?? ""}
            vide="Inconnu"
            options={[1, 2, 3, 4, 5, 6].map((g) => ({ valeur: String(g), libelle: `GIR ${g}` }))}
          />
          <div className="flex flex-col sm:col-span-2 sm:flex-row sm:gap-6">
            <CaseACocher name="troublesAuditifs" defaultChecked={sante.troublesAuditifs} libelle="Troubles auditifs" />
            <CaseACocher name="troublesVisuels" defaultChecked={sante.troublesVisuels} libelle="Troubles visuels" />
            <CaseACocher name="troublesCognitifs" defaultChecked={sante.troublesCognitifs} libelle="Troubles cognitifs" />
          </div>
          <ChampTexte libelle="Handicap" name="handicap" defaultValue={sante.handicap ?? ""} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <GroupeCases legende="Appareillage" name="appareillage" options={APPAREILLAGES.map((a) => ({ valeur: a, libelle: a }))} valeurs={sante.appareillage} colonnes={3} />
          </div>
          <CaseACocher
            name="teleassistance"
            checked={teleassistance}
            onChange={(ev) => setTeleassistance(ev.target.checked)}
            libelle="Téléassistance"
            className="self-end"
          />
          {teleassistance ? (
            <ChampTexte libelle="Fournisseur de téléassistance" name="teleassistanceFournisseur" defaultValue={sante.teleassistanceFournisseur ?? ""} />
          ) : (
            <div className="hidden sm:block" />
          )}
          <ChampTexte libelle="Médecin traitant" name="medecinTraitant" defaultValue={sante.medecinTraitant ?? ""} />
        </SectionFormulaire>
      )}

      <SectionFormulaire titre="Habitudes et informations prioritaires">
        <ChampTexte
          libelle="Informations prioritaires"
          name="infoPrioritaire"
          defaultValue={b.infoPrioritaire ?? ""}
          maxLength={140}
          erreur={e.infoPrioritaire}
          aide="Texte court toujours affiché en haut de la fiche, y compris pour les bénévoles. Ex. « Malentendante – laisser sonner longtemps »."
          className="sm:col-span-2"
        />
        <ChampZoneTexte libelle="Habitudes" name="habitudes" defaultValue={b.habitudes ?? ""} placeholder="Ex. sort au marché le mardi matin, fait la sieste de 14h à 16h" className="sm:col-span-2" />
        <ChampTexte libelle="Centres d'intérêt" name="centresInteret" defaultValue={b.centresInteret ?? ""} className="sm:col-span-2" />
        {tags.length > 0 && (
          <div className="sm:col-span-2">
            <GroupeCases legende="Étiquettes" name="tags" options={tags.map((t) => ({ valeur: t, libelle: t }))} valeurs={b.tags} colonnes={3} />
          </div>
        )}
      </SectionFormulaire>

      <SectionFormulaire titre="Consentements">
        <div className="flex flex-col sm:col-span-2">
          <CaseACocher name="consentementRegistre" defaultChecked={b.consentementRegistre} libelle="La personne consent à son inscription au registre" />
          <CaseACocher name="personneInformee" defaultChecked={b.personneInformee} libelle="La personne concernée est informée (inscription par un tiers)" />
          <CaseACocher name="consentementPartage" defaultChecked={b.consentementPartage} libelle="Accepte le partage d'informations avec ses intervenants" />
          <CaseACocher name="consentementIa" defaultChecked={b.consentementIa} libelle="Accepte d'être appelée par l'assistant automatique (IA)" />
        </div>
        <ChampTexte libelle="Date du recueil" name="consentementDate" type="date" defaultValue={b.consentementDate ?? ""} />
        <ChampTexte libelle="Canal du recueil" name="consentementCanal" defaultValue={b.consentementCanal ?? ""} placeholder="Ex. accueil, téléphone, formulaire papier" />
      </SectionFormulaire>

      {etat.doublons && etat.doublons.length > 0 && (
        <Bandeau ton="warn" className="flex flex-col gap-3">
          <p className="font-semibold">Cette personne semble déjà inscrite. Vérifiez avant de créer une nouvelle fiche.</p>
          <ul className="flex flex-col gap-2 font-normal">
            {etat.doublons.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{d.nom}</span>
                <span>né(e) le {d.dateNaissance}</span>
                <span>· {d.motifs.join(", ").toLowerCase()}</span>
                <Link href={`/beneficiaires/${d.id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline underline-offset-4">
                  Ouvrir la fiche existante
                  <ExternalLink className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Bandeau>
      )}
      {!etat.ok && etat.message && !etat.doublons && (
        <p role="alert" className="font-medium text-err">
          {etat.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" nativeButton={false} render={<Link href={annulerHref} />}>
          Annuler
        </Button>
        {etat.doublons && etat.doublons.length > 0 && (
          <Button type="submit" variant="outline" name="ignorerDoublons" value="1" disabled={enCours}>
            Créer quand même
          </Button>
        )}
        <Button type="submit" disabled={enCours}>
          {mode === "creation" ? "Enregistrer la fiche" : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
