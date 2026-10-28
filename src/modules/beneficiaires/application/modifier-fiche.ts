/**
 * E1-US3 — Modification d'une fiche : chaque changement est historisé (qui, quand, avant/après)
 * et le score RG-01 est recalculé.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { comparerFiches, verifierChampsObligatoires, type ErreursSaisie, type SaisieFiche } from "../domain/fiche";
import { geocoderFoyer } from "./creer-fiche";
import { FicheIntrouvable } from "./erreurs";
import type { DepsBeneficiaires, FicheComplete } from "./ports";
import { recalculerScore } from "./score";

export type ResultatModifierFiche = { statut: "modifiee"; nbChangements: number } | { statut: "invalide"; erreurs: ErreursSaisie };

/** Vue « saisie » d'une fiche existante (point de départ du formulaire de modification et de la comparaison). */
export function saisieDepuisFiche(fiche: FicheComplete): SaisieFiche {
  const f = fiche.foyer;
  return {
    beneficiaire: fiche.beneficiaire,
    sante: fiche.sante,
    foyer: {
      banId: f.banId,
      numero: f.numero,
      rep: f.rep,
      voie: f.voie,
      lon: f.lon,
      lat: f.lat,
      residence: f.residence,
      batiment: f.batiment,
      entree: f.entree,
      appartement: f.appartement,
      etage: f.etage,
      ascenseur: f.ascenseur,
      codeAcces: f.codeAcces,
      typeLogement: f.typeLogement,
      sousLesToits: f.sousLesToits,
      pieceFraiche: f.pieceFraiche,
      animaux: f.animaux,
    },
  };
}

export async function modifierFiche(
  deps: Pick<DepsBeneficiaires, "fiches" | "geocodeur">,
  ctx: Contexte,
  entree: { id: string; saisie: SaisieFiche },
): Promise<ResultatModifierFiche> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const existante = await deps.fiches.trouver(ctx.commune.id, entree.id);
  if (!existante) throw new FicheIntrouvable();

  const accesSante = peut(ctx.utilisateur.role, "fiches.sante");
  const saisie: SaisieFiche = { ...entree.saisie, sante: accesSante ? entree.saisie.sante : null };
  const erreurs = verifierChampsObligatoires(saisie, aujourdhui(ctx.maintenant));
  if (Object.keys(erreurs).length) return { statut: "invalide", erreurs };

  const avant = saisieDepuisFiche(existante);
  const adresseModifiee =
    avant.foyer.voie !== saisie.foyer.voie || avant.foyer.numero !== saisie.foyer.numero || avant.foyer.rep !== saisie.foyer.rep;

  let foyerComplement = { quartier: existante.foyer.quartier, adresseAVerifier: existante.foyer.adresseAVerifier };
  let foyer = saisie.foyer;
  if (adresseModifiee || saisie.foyer.banId === null) {
    const referentiels = await deps.fiches.referentiels(ctx.commune.id);
    const geocode = await geocoderFoyer(deps.geocodeur, ctx.commune.id, saisie.foyer, referentiels);
    foyer = geocode.foyer;
    foyerComplement = { quartier: geocode.quartier, adresseAVerifier: geocode.adresseAVerifier };
  }

  const apres: SaisieFiche = { ...saisie, foyer };
  const changements = comparerFiches(avant, apres);
  if (foyerComplement.adresseAVerifier !== existante.foyer.adresseAVerifier) {
    changements.push({
      champ: "Adresse à vérifier",
      ancienneValeur: existante.foyer.adresseAVerifier ? "Oui" : "Non",
      nouvelleValeur: foyerComplement.adresseAVerifier ? "Oui" : "Non",
    });
  }
  if (!changements.length) return { statut: "modifiee", nbChangements: 0 };

  await deps.fiches.mettreAJour(ctx.commune.id, entree.id, { ...apres, foyerComplement }, changements, ctx.utilisateur.id);
  await recalculerScore(deps, ctx, entree.id, { score: existante.score, niveauPriorite: existante.niveauPriorite });
  return { statut: "modifiee", nbChangements: changements.length };
}
