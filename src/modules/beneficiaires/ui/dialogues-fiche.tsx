"use client";
/**
 * Boîtes de dialogue des actions de fiche : interaction (E3-US1), rappel (E4-US2), indisponibilité (E5-US1),
 * niveau de priorité forcé (RG-01), archivage (E1-US4).
 */
import { useState } from "react";
import {
  BESOIN_LIBELLES,
  BESOINS,
  INDISPONIBILITE_LIBELLES,
  INTERACTION_LIBELLES,
  MOTIF_ARCHIVAGE_LIBELLES,
  MOTIFS_ARCHIVAGE,
  STATUT_CIBLE_LIBELLES,
  TYPES_INDISPONIBILITE,
  TYPES_INTERACTION,
  type NiveauPriorite,
} from "@/shared/domain/vocabulaire";
import {
  archiverFicheAction,
  creerRappelAction,
  declarerIndisponibiliteAction,
  enregistrerInteractionAction,
  forcerPrioriteAction,
} from "./actions";
import { CaseACocher, ChampSelect, ChampTexte, ChampZoneTexte, GroupeCases } from "./champs";
import { DialogueFormulaire } from "./dialogue-formulaire";
import { options, RESULTATS_INTERACTION } from "./libelles";

export type Personne = { id: string; nom: string };
type Commun = { ouvert: boolean; surChangement: (o: boolean) => void; beneficiaireId: string };

const optionsEquipe = (equipe: Personne[], moiId: string) =>
  equipe.map((u) => ({ valeur: u.id, libelle: u.id === moiId ? `${u.nom} (moi)` : u.nom }));

export function DialogueInteraction({
  ouvert,
  surChangement,
  beneficiaireId,
  cercle,
  equipe,
  moiId,
  maintenantLocal,
}: Commun & { cercle: Personne[]; equipe: Personne[]; moiId: string; maintenantLocal: string }) {
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre="Enregistrer une interaction"
      description="Appel, visite, SMS… Une action de suivi crée automatiquement un rappel."
      action={enregistrerInteractionAction.bind(null, beneficiaireId)}
      libelleValider="Enregistrer l'interaction"
    >
      {(e) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampSelect libelle="Type" name="type" defaultValue="appel_sortant" options={options(TYPES_INTERACTION, INTERACTION_LIBELLES)} erreur={e.type} requis />
            <ChampTexte libelle="Date et heure" name="survenueLe" type="datetime-local" defaultValue={maintenantLocal} max={maintenantLocal} erreur={e.survenueLe} requis />
            <ChampSelect
              libelle="Interlocuteur"
              name="interlocuteurContactId"
              defaultValue=""
              vide="La personne elle-même"
              options={cercle.map((c) => ({ valeur: c.id, libelle: c.nom }))}
            />
            <ChampTexte libelle="Durée (minutes)" name="dureeMinutes" type="number" min={0} inputMode="numeric" erreur={e.dureeMinutes} />
            <ChampSelect
              libelle="Résultat"
              name="resultat"
              defaultValue=""
              vide="Non précisé"
              options={RESULTATS_INTERACTION.map((s) => ({ valeur: s, libelle: STATUT_CIBLE_LIBELLES[s] }))}
              className="sm:col-span-2"
            />
          </div>
          <ChampZoneTexte libelle="Compte rendu" name="compteRendu" />
          <GroupeCases legende="Besoins détectés" name="besoins" options={options(BESOINS, BESOIN_LIBELLES)} colonnes={3} />
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <ChampTexte libelle="Action de suivi à prévoir" name="actionSuivi" placeholder="Ex. rappeler sa fille" className="sm:col-span-2" />
            <ChampTexte libelle="Pour le" name="echeanceSuivi" type="date" erreur={e.echeanceSuivi} aide="Par défaut : demain." />
            <ChampSelect libelle="Assigné à" name="assigneSuivi" defaultValue={moiId} options={optionsEquipe(equipe, moiId)} />
          </div>
        </>
      )}
    </DialogueFormulaire>
  );
}

export function DialogueRappel({ ouvert, surChangement, beneficiaireId, equipe, moiId, demain }: Commun & { equipe: Personne[]; moiId: string; demain: string }) {
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre="Créer un rappel"
      action={creerRappelAction.bind(null, beneficiaireId)}
      libelleValider="Créer le rappel"
    >
      {(e) => (
        <>
          <ChampTexte libelle="Objet" name="objet" placeholder="Ex. rappeler après sa sortie d'hôpital" erreur={e.objet} requis />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampTexte libelle="Date" name="echeance" type="date" defaultValue={demain} erreur={e.echeance} requis />
            <ChampSelect libelle="Assigné à" name="assigneA" defaultValue={moiId} options={optionsEquipe(equipe, moiId)} />
          </div>
          <CaseACocher name="urgent" libelle="Urgent" />
        </>
      )}
    </DialogueFormulaire>
  );
}

export function DialogueIndisponibilite({ ouvert, surChangement, beneficiaireId, aujourdhui }: Commun & { aujourdhui: string }) {
  const [sansFin, setSansFin] = useState(false);
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre="Déclarer une indisponibilité"
      description="Pendant l'absence, la personne est exclue des campagnes d'appel. Un rappel « Vérifier le retour » est créé à la date de fin."
      action={declarerIndisponibiliteAction.bind(null, beneficiaireId)}
      libelleValider="Déclarer l'indisponibilité"
    >
      {(e) => (
        <>
          <ChampSelect libelle="Type" name="type" defaultValue="vacances" options={options(TYPES_INDISPONIBILITE, INDISPONIBILITE_LIBELLES)} erreur={e.type} requis />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampTexte libelle="Du" name="debut" type="date" defaultValue={aujourdhui} erreur={e.debut} requis />
            <ChampTexte libelle="Au" name="fin" type="date" disabled={sansFin} erreur={e.fin} />
          </div>
          <CaseACocher name="jusquANouvelOrdre" checked={sansFin} onChange={(ev) => setSansFin(ev.target.checked)} libelle="Jusqu'à nouvel ordre" />
          <ChampTexte libelle="Où la joindre pendant l'absence" name="joignabilite" placeholder="Ex. joignable sur le mobile de sa fille" />
          <ChampTexte libelle="Source de l'information" name="source" placeholder="Ex. appel de sa fille" />
        </>
      )}
    </DialogueFormulaire>
  );
}

export function DialoguePriorite({
  ouvert,
  surChangement,
  beneficiaireId,
  niveauCalcule,
  niveauForce,
}: Commun & { niveauCalcule: NiveauPriorite; niveauForce: NiveauPriorite | null }) {
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre="Forcer le niveau de priorité"
      description={`Le niveau calculé automatiquement est ${niveauCalcule}. Un niveau forcé reste appliqué jusqu'à ce que vous reveniez au calcul automatique.`}
      action={forcerPrioriteAction.bind(null, beneficiaireId)}
      libelleValider="Appliquer"
    >
      {(e) => (
        <>
          <ChampSelect
            libelle="Niveau"
            name="niveau"
            defaultValue={niveauForce ?? "P1"}
            options={[
              { valeur: "P1", libelle: "P1 – priorité haute" },
              { valeur: "P2", libelle: "P2 – priorité moyenne" },
              { valeur: "P3", libelle: "P3 – priorité basse" },
              { valeur: "auto", libelle: `Revenir au calcul automatique (${niveauCalcule})` },
            ]}
            erreur={e.niveau}
          />
          <ChampZoneTexte libelle="Justification" name="justification" erreur={e.justification} aide="Obligatoire pour forcer un niveau." />
        </>
      )}
    </DialogueFormulaire>
  );
}

export function DialogueArchivage({ ouvert, surChangement, beneficiaireId }: Commun) {
  return (
    <DialogueFormulaire
      ouvert={ouvert}
      surChangement={surChangement}
      titre="Archiver la fiche"
      description="La fiche n'apparaîtra plus dans les listes ni les campagnes, mais restera dans les statistiques."
      action={archiverFicheAction.bind(null, beneficiaireId)}
      libelleValider="Archiver la fiche"
      destructif
    >
      {(e) => (
        <>
          <ChampSelect libelle="Motif" name="motif" defaultValue="" vide="Choisir un motif" options={options(MOTIFS_ARCHIVAGE, MOTIF_ARCHIVAGE_LIBELLES)} erreur={e.motif} requis />
          <ChampZoneTexte libelle="Commentaire" name="commentaire" erreur={e.commentaire} aide="Obligatoire si le motif est « Autre »." />
        </>
      )}
    </DialogueFormulaire>
  );
}
