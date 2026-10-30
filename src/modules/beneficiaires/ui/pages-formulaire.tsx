/** Pages de création (E1-US1) et de modification (E1-US3) d'une fiche. */
import { notFound } from "next/navigation";
import { z } from "zod";
import { contexteAvec } from "@/shared/infrastructure/session";
import { aujourdhui } from "@/shared/domain/dates";
import { peut } from "@/shared/domain/permissions";
import { EnTetePage, LienRetour, Page } from "@/shared/ui/elements";
import { libelleAdresse, nomComplet, SANTE_VIDE, type SaisieFiche } from "../domain/fiche";
import { saisieDepuisFiche } from "../application/modifier-fiche";
import { casDUsage } from "../infrastructure";
import { creerFicheAction, modifierFicheAction } from "./actions";
import { FormulaireFiche } from "./formulaire-fiche";

function saisieVide(jour: string): SaisieFiche {
  return {
    beneficiaire: {
      civilite: "Mme",
      nom: "",
      nomNaissance: null,
      prenom: "",
      sexe: "F",
      dateNaissance: "",
      telephoneFixe: null,
      telephoneMobile: null,
      pasDeTelephone: false,
      email: null,
      langue: "Français",
      preferenceContact: null,
      creneauxAppel: null,
      modeDeVie: null,
      caisseRetraite: null,
      aideCaisseRetraite: false,
      origineInscription: "ccas",
      categorie: "senior",
      protection: "non",
      mandataireStructure: null,
      mandataireTelephone: null,
      habitudes: null,
      centresInteret: null,
      tags: [],
      infoPrioritaire: null,
      consentementRegistre: true,
      personneInformee: true,
      consentementIa: false,
      consentementPartage: false,
      consentementDate: jour,
      consentementCanal: "Accueil",
    },
    sante: SANTE_VIDE,
    foyer: {
      banId: null,
      numero: null,
      rep: null,
      voie: "",
      lon: null,
      lat: null,
      residence: null,
      batiment: null,
      entree: null,
      appartement: null,
      etage: null,
      ascenseur: null,
      codeAcces: null,
      typeLogement: null,
      sousLesToits: false,
      pieceFraiche: null,
      animaux: null,
    },
  };
}

export async function PageNouvelleFiche() {
  const ctx = await contexteAvec("fiches.ecrire");
  const referentiels = await casDUsage.consulterReferentiels(ctx);
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        retour={<LienRetour href="/beneficiaires">Bénéficiaires</LienRetour>}
        titre="Nouvelle fiche"
        description="Les champs marqués d'un astérisque sont obligatoires. Le score de priorité est calculé automatiquement."
      />
      <FormulaireFiche
        mode="creation"
        initiale={saisieVide(aujourdhui(ctx.maintenant))}
        adresseInitiale={null}
        tags={referentiels.tags}
        codePostal={referentiels.commune.codePostal}
        droitSante={peut(ctx.utilisateur.role, "fiches.sante")}
        action={creerFicheAction}
        annulerHref="/beneficiaires"
      />
    </Page>
  );
}

export async function PageModifierFiche({ id }: { id: string }) {
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await contexteAvec("fiches.ecrire");
  const [consultation, referentiels] = await Promise.all([casDUsage.consulterFiche(ctx, { id }), casDUsage.consulterReferentiels(ctx)]);
  if (!consultation) notFound();
  const { fiche } = consultation;
  const saisie = saisieDepuisFiche({ ...fiche, sante: fiche.sante ?? SANTE_VIDE });
  const f = fiche.foyer;
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        retour={<LienRetour href={`/beneficiaires/${id}`}>Retour à la fiche</LienRetour>}
        titre={`Modifier la fiche de ${nomComplet(fiche.beneficiaire)}`}
        description="Chaque modification est enregistrée dans l'historique de la fiche et le score de priorité est recalculé."
      />
      <FormulaireFiche
        mode="modification"
        initiale={{ ...saisie, sante: fiche.sante }}
        adresseInitiale={{ banId: f.banId, numero: f.numero, rep: f.rep, voie: f.voie, lon: f.lon, lat: f.lat, libelle: libelleAdresse(f) }}
        tags={[...new Set([...referentiels.tags, ...fiche.beneficiaire.tags])]}
        codePostal={referentiels.commune.codePostal}
        droitSante={consultation.droits.sante}
        action={modifierFicheAction.bind(null, id)}
        annulerHref={`/beneficiaires/${id}`}
      />
    </Page>
  );
}
