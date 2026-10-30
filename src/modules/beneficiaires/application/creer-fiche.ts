/**
 * E1-US1 — Création d'une fiche : champs obligatoires, géocodage (sinon « adresse à vérifier »),
 * détection de doublon et calcul du score RG-01.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger, peut } from "@/shared/domain/permissions";
import { calculerScore } from "@/shared/domain/priorite";
import { meilleureCorrespondance, quartierContenant } from "../domain/adresse";
import { normaliserTelephone, trouverDoublons, type Doublon } from "../domain/doublons";
import { extraireFaits } from "../domain/faits-priorite";
import { libelleAdresse, SANTE_VIDE, verifierChampsObligatoires, type ErreursSaisie, type SaisieFiche, type SaisieFoyer } from "../domain/fiche";
import type { DepsBeneficiaires, Geocodeur, Referentiels } from "./ports";

export type EntreeCreerFiche = { saisie: SaisieFiche; ignorerDoublons: boolean };

export type ResultatCreerFiche =
  | { statut: "creee"; id: string; adresseAVerifier: boolean }
  | { statut: "doublons"; doublons: Doublon[] }
  | { statut: "invalide"; erreurs: ErreursSaisie };

/**
 * Une adresse choisie dans les suggestions (identifiant BAN + coordonnées) est déjà géocodée.
 * Sinon on tente un géocodage du texte saisi ; en cas d'échec, la fiche est marquée « adresse à vérifier ».
 */
export async function geocoderFoyer(
  geocodeur: Geocodeur,
  communeId: string,
  foyer: SaisieFoyer,
  referentiels: Pick<Referentiels, "quartiers" | "commune">,
): Promise<{ foyer: SaisieFoyer; quartier: string | null; adresseAVerifier: boolean }> {
  let resultat = foyer;
  if (foyer.banId === null || foyer.lon === null || foyer.lat === null) {
    const suggestions = await geocodeur.rechercher(communeId, libelleAdresse(foyer), referentiels.commune.codePostal).catch(() => []);
    const trouvee = meilleureCorrespondance(suggestions);
    resultat = trouvee
      ? { ...foyer, banId: trouvee.banId, numero: trouvee.numero, rep: trouvee.rep, voie: trouvee.voie, lon: trouvee.lon, lat: trouvee.lat }
      : { ...foyer, banId: null, lon: null, lat: null };
  }
  const geocode = resultat.lon !== null && resultat.lat !== null;
  return {
    foyer: resultat,
    quartier: geocode ? quartierContenant(resultat.lon!, resultat.lat!, referentiels.quartiers) : null,
    adresseAVerifier: !geocode,
  };
}

export async function creerFiche(
  deps: Pick<DepsBeneficiaires, "fiches" | "geocodeur">,
  ctx: Contexte,
  entree: EntreeCreerFiche,
): Promise<ResultatCreerFiche> {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const jour = aujourdhui(ctx.maintenant);
  // Sans accès aux données de santé, on ne peut pas en saisir.
  const saisie: SaisieFiche = { ...entree.saisie, sante: peut(ctx.utilisateur.role, "fiches.sante") ? (entree.saisie.sante ?? SANTE_VIDE) : SANTE_VIDE };

  const erreurs = verifierChampsObligatoires(saisie, jour);
  if (Object.keys(erreurs).length) return { statut: "invalide", erreurs };

  const b = saisie.beneficiaire;
  if (!entree.ignorerDoublons) {
    const telephones = [b.telephoneFixe, b.telephoneMobile].map(normaliserTelephone).filter((t): t is string => t !== null);
    const candidats = await deps.fiches.candidatsDoublons(ctx.commune.id, { dateNaissance: b.dateNaissance, telephones });
    const doublons = trouverDoublons({ nom: b.nom, dateNaissance: b.dateNaissance, telephones }, candidats);
    if (doublons.length) return { statut: "doublons", doublons };
  }

  const referentiels = await deps.fiches.referentiels(ctx.commune.id);
  const { foyer, quartier, adresseAVerifier } = await geocoderFoyer(deps.geocodeur, ctx.commune.id, saisie.foyer, referentiels);

  const grille = await deps.fiches.grilleScore(ctx.commune.id);
  const sante = saisie.sante ?? SANTE_VIDE;
  const { score, niveau } = calculerScore(
    extraireFaits({
      beneficiaire: {
        dateNaissance: b.dateNaissance,
        modeDeVie: b.modeDeVie,
        deplacement: sante.deplacement,
        protection: b.protection,
        troublesCognitifs: sante.troublesCognitifs,
        pasDeTelephone: b.pasDeTelephone,
        retourHospitalisationLe: null,
        gir: sante.gir,
        aideCaisseRetraite: b.aideCaisseRetraite,
      },
      foyer: { sousLesToits: foyer.sousLesToits, pieceFraiche: foyer.pieceFraiche, etage: foyer.etage, typeLogement: foyer.typeLogement },
      cercle: [],
      prisesEnCharge: [],
      aujourdhui: jour,
    }),
    grille,
  );

  const id = await deps.fiches.creer(ctx.commune.id, {
    beneficiaire: b,
    sante,
    foyer,
    foyerComplement: { codePostal: referentiels.commune.codePostal, ville: referentiels.commune.nom, quartier, adresseAVerifier },
    score,
    niveauPriorite: niveau,
    dateInscription: jour,
  });
  return { statut: "creee", id, adresseAVerifier };
}
