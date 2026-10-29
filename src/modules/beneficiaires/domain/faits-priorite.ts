/**
 * Extraction des faits nécessaires au score RG-01 depuis une fiche, son foyer, son cercle
 * et ses prises en charge. Utilisé à la création, à chaque modification et par le seed.
 */
import { calculerAge, ecartEnJours, type DateISO } from "@/shared/domain/dates";
import type { FaitsPriorite } from "@/shared/domain/priorite";
import type { Deplacement, ModeDeVie, Protection, Relation, TypeLogement, TypePriseEnCharge } from "@/shared/domain/vocabulaire";

/** Communes considérées « à proximité » pour qu'un proche puisse se déplacer rapidement. */
const VILLES_PROCHES = ["lomme", "lille", "lambersart", "sequedin", "haubourdin", "capinghem", "englos", "loos", "saint-andré-lez-lille", "marquette-lez-lille"];

const RELATIONS_PROCHES: Relation[] = ["enfant", "conjoint", "famille", "voisin", "ami", "gardien"];
const PRISES_A_DOMICILE: TypePriseEnCharge[] = ["aide_domicile", "portage_repas", "soins_infirmiers", "ssiad", "kine"];

export type EntreeFaits = {
  beneficiaire: {
    dateNaissance: DateISO;
    modeDeVie: ModeDeVie | null;
    deplacement: Deplacement | null;
    protection: Protection;
    troublesCognitifs: boolean;
    pasDeTelephone: boolean;
    retourHospitalisationLe: DateISO | null;
    gir: number | null;
    aideCaisseRetraite: boolean;
  };
  foyer: { sousLesToits: boolean; pieceFraiche: boolean | null; etage: number | null; typeLogement: TypeLogement | null };
  cercle: { relation: Relation; possedeCles: boolean; ville: string | null; telephone: string | null }[];
  prisesEnCharge: { type: TypePriseEnCharge; possedeCles: boolean; dateFin: DateISO | null; gir: number | null }[];
  aujourdhui: DateISO;
};

export function estProche(ville: string | null): boolean {
  return ville !== null && VILLES_PROCHES.includes(ville.trim().toLowerCase());
}

export function extraireFaits(e: EntreeFaits): FaitsPriorite {
  const prisesActives = e.prisesEnCharge.filter((p) => p.dateFin === null || p.dateFin >= e.aujourdhui);
  const apa = prisesActives.find((p) => p.type === "apa");
  return {
    age: calculerAge(e.beneficiaire.dateNaissance, e.aujourdhui),
    modeDeVie: e.beneficiaire.modeDeVie,
    deplacement: e.beneficiaire.deplacement,
    protection: e.beneficiaire.protection,
    troublesCognitifs: e.beneficiaire.troublesCognitifs,
    quelquUnPossedeLesCles: e.cercle.some((c) => c.possedeCles) || prisesActives.some((p) => p.possedeCles),
    aUnProcheJoignable: e.cercle.some((c) => RELATIONS_PROCHES.includes(c.relation) && c.telephone !== null && estProche(c.ville)),
    sousLesToits: e.foyer.sousLesToits,
    pieceFraiche: e.foyer.pieceFraiche,
    rezDeChaussee: e.foyer.typeLogement === "maison" || e.foyer.etage === 0,
    nbPrisesEnChargeADomicile: prisesActives.filter((p) => PRISES_A_DOMICILE.includes(p.type)).length,
    retourHospitalisationRecent:
      e.beneficiaire.retourHospitalisationLe !== null &&
      ecartEnJours(e.beneficiaire.retourHospitalisationLe, e.aujourdhui) <= 30 &&
      ecartEnJours(e.beneficiaire.retourHospitalisationLe, e.aujourdhui) >= 0,
    pasDeTelephone: e.beneficiaire.pasDeTelephone,
    apa: apa ? { gir: apa.gir ?? e.beneficiaire.gir } : null,
    pch: prisesActives.some((p) => p.type === "pch"),
    aideCaisseRetraite: e.beneficiaire.aideCaisseRetraite,
  };
}
