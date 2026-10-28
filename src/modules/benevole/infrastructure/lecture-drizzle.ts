import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { verrouActif } from "@/shared/domain/campagne";
import { calculerAge } from "@/shared/domain/dates";
import { db } from "@/shared/infrastructure/db/client";
import { beneficiaires, campagnes, ciblesCampagne, contacts, liensCercle, utilisateurs } from "@/shared/infrastructure/db/schema";
import type { FicheAppel, LectureBenevole, PersonneDeMaListe } from "../application/ports";

/** Filtre RG-07 : vague du jour, assignée au bénévole, campagne active de la commune, non exclue. */
const perimetre = (communeId: string, benevoleId: string, jour: string) =>
  and(
    eq(campagnes.communeId, communeId),
    eq(campagnes.statut, "active"),
    eq(ciblesCampagne.vagueDate, jour),
    eq(ciblesCampagne.assigneA, benevoleId),
    eq(ciblesCampagne.exclue, false),
  );

const verrouilleParAutre = (verrouPar: string | null, verrouAt: Date | null, benevoleId: string, maintenant: Date) =>
  verrouPar !== null && verrouPar !== benevoleId && verrouActif(verrouAt, maintenant);

export const lectureBenevoleDrizzle: LectureBenevole = {
  async maListe(communeId, benevoleId, jour, maintenant): Promise<PersonneDeMaListe[]> {
    const lignes = await db
      .select({
        id: ciblesCampagne.id,
        statut: ciblesCampagne.statut,
        prochaineTentativeAt: ciblesCampagne.prochaineTentativeAt,
        verrouPar: ciblesCampagne.verrouPar,
        verrouAt: ciblesCampagne.verrouAt,
        civilite: beneficiaires.civilite,
        prenom: beneficiaires.prenom,
        nom: beneficiaires.nom,
        dateNaissance: beneficiaires.dateNaissance,
        niveau: beneficiaires.niveauPriorite,
        niveauForce: beneficiaires.niveauForce,
        score: beneficiaires.score,
      })
      .from(ciblesCampagne)
      .innerJoin(campagnes, eq(campagnes.id, ciblesCampagne.campagneId))
      .innerJoin(beneficiaires, eq(beneficiaires.id, ciblesCampagne.beneficiaireId))
      .where(perimetre(communeId, benevoleId, jour));
    return lignes.map((l) => ({
      id: l.id,
      civilite: l.civilite,
      prenom: l.prenom,
      nom: l.nom,
      age: calculerAge(l.dateNaissance, jour),
      niveau: l.niveauForce ?? l.niveau,
      score: l.score,
      statut: l.statut,
      prochaineTentativeAt: l.prochaineTentativeAt,
      verrouilleParAutre: verrouilleParAutre(l.verrouPar, l.verrouAt, benevoleId, maintenant),
    }));
  },

  async ficheAppel(communeId, benevoleId, cibleId, jour, maintenant): Promise<FicheAppel | null> {
    const [l] = await db
      .select({
        cibleId: ciblesCampagne.id,
        beneficiaireId: ciblesCampagne.beneficiaireId,
        statut: ciblesCampagne.statut,
        nbTentatives: ciblesCampagne.nbTentatives,
        rangCercleEssaye: ciblesCampagne.rangCercleEssaye,
        verrouPar: ciblesCampagne.verrouPar,
        verrouAt: ciblesCampagne.verrouAt,
        typeAppel: campagnes.type,
        script: campagnes.script,
        civilite: beneficiaires.civilite,
        prenom: beneficiaires.prenom,
        nom: beneficiaires.nom,
        dateNaissance: beneficiaires.dateNaissance,
        infoPrioritaire: beneficiaires.infoPrioritaire,
        telephoneFixe: beneficiaires.telephoneFixe,
        telephoneMobile: beneficiaires.telephoneMobile,
        preferenceContact: beneficiaires.preferenceContact,
      })
      .from(ciblesCampagne)
      .innerJoin(campagnes, eq(campagnes.id, ciblesCampagne.campagneId))
      .innerJoin(beneficiaires, eq(beneficiaires.id, ciblesCampagne.beneficiaireId))
      .where(and(perimetre(communeId, benevoleId, jour), eq(ciblesCampagne.id, cibleId)))
      .limit(1);
    if (!l) return null;

    const cercle = await db
      .select({
        lienId: liensCercle.id,
        rang: liensCercle.rangAppel,
        relation: liensCercle.relation,
        prenom: contacts.prenom,
        nom: contacts.nom,
        telephone: contacts.telephone,
      })
      .from(liensCercle)
      .innerJoin(contacts, eq(contacts.id, liensCercle.contactId))
      .where(and(eq(liensCercle.beneficiaireId, l.beneficiaireId), eq(contacts.communeId, communeId), isNotNull(contacts.telephone)))
      .orderBy(asc(liensCercle.rangAppel));

    const telephones = [
      l.telephoneMobile ? { libelle: "Portable", numero: l.telephoneMobile, prefere: l.preferenceContact === "mobile" } : null,
      l.telephoneFixe ? { libelle: "Fixe", numero: l.telephoneFixe, prefere: l.preferenceContact !== "mobile" } : null,
    ]
      .filter((t) => t !== null)
      .sort((a, b) => Number(b.prefere) - Number(a.prefere))
      .map(({ libelle, numero }) => ({ libelle, numero }));

    return {
      cibleId: l.cibleId,
      typeAppel: l.typeAppel,
      civilite: l.civilite,
      prenom: l.prenom,
      nom: l.nom,
      age: calculerAge(l.dateNaissance, jour),
      infoPrioritaire: l.infoPrioritaire,
      telephones,
      script: l.script,
      statut: l.statut,
      nbTentatives: l.nbTentatives,
      rangCercleEssaye: l.rangCercleEssaye,
      verrouilleParAutre: verrouilleParAutre(l.verrouPar, l.verrouAt, benevoleId, maintenant),
      cercle: cercle.map((p) => ({
        lienId: p.lienId,
        rang: p.rang,
        relation: p.relation,
        // RG-07 : prénom seul ; à défaut, le nom (contact professionnel ou structure).
        prenom: p.prenom ?? p.nom,
        telephone: p.telephone!,
      })),
    };
  },

  async engagementAccepteLe(benevoleId) {
    const [u] = await db
      .select({ at: utilisateurs.confidentialiteAccepteeAt })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, benevoleId))
      .limit(1);
    return u?.at ?? null;
  },
};
