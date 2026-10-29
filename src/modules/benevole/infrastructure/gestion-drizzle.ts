import "server-only";
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { libelleAdresse } from "@/modules/beneficiaires/domain/fiche";
import { calculerAge } from "@/shared/domain/dates";
import { db } from "@/shared/infrastructure/db/client";
import { assignations, beneficiaires, foyers, utilisateurs } from "@/shared/infrastructure/db/schema";
import type { GestionBenevoles, PersonneConfiee } from "../application/ports";

const colonnesBenevole = {
  id: utilisateurs.id,
  prenom: utilisateurs.prenom,
  nom: utilisateurs.nom,
  telephone: utilisateurs.telephone,
  email: utilisateurs.email,
};

const colonnesPersonne = {
  id: beneficiaires.id,
  civilite: beneficiaires.civilite,
  prenom: beneficiaires.prenom,
  nom: beneficiaires.nom,
  dateNaissance: beneficiaires.dateNaissance,
  niveau: beneficiaires.niveauPriorite,
  niveauForce: beneficiaires.niveauForce,
  numero: foyers.numero,
  rep: foyers.rep,
  voie: foyers.voie,
};

type LignePersonne = { [K in keyof typeof colonnesPersonne]: (typeof colonnesPersonne)[K]["_"]["data"] | null } & { id: string };

function versPersonne(l: LignePersonne, jour: string): PersonneConfiee {
  return {
    id: l.id,
    civilite: l.civilite!,
    prenom: l.prenom!,
    nom: l.nom!,
    age: calculerAge(l.dateNaissance!, jour),
    adresse: libelleAdresse({ numero: l.numero, rep: l.rep, voie: l.voie ?? "" }),
    niveau: l.niveauForce ?? l.niveau!,
  };
}

const estBenevole = (communeId: string) => and(eq(utilisateurs.communeId, communeId), eq(utilisateurs.role, "benevole"), eq(utilisateurs.actif, true));

export const gestionBenevolesDrizzle: GestionBenevoles = {
  async lister(communeId) {
    const nb = db
      .select({ utilisateurId: assignations.utilisateurId, n: count().as("n") })
      .from(assignations)
      .innerJoin(beneficiaires, eq(beneficiaires.id, assignations.beneficiaireId))
      .where(eq(beneficiaires.statut, "active"))
      .groupBy(assignations.utilisateurId)
      .as("nb");
    const lignes = await db
      .select({ ...colonnesBenevole, nbPersonnes: sql<number>`coalesce(${nb.n}, 0)::int` })
      .from(utilisateurs)
      .leftJoin(nb, eq(nb.utilisateurId, utilisateurs.id))
      .where(estBenevole(communeId))
      .orderBy(asc(utilisateurs.prenom), asc(utilisateurs.nom));
    return lignes;
  },

  async obtenir(communeId, benevoleId) {
    const [b] = await db
      .select(colonnesBenevole)
      .from(utilisateurs)
      .where(and(estBenevole(communeId), eq(utilisateurs.id, benevoleId)));
    if (!b) return null;
    const [{ n }] = await db
      .select({ n: count() })
      .from(assignations)
      .innerJoin(beneficiaires, eq(beneficiaires.id, assignations.beneficiaireId))
      .where(and(eq(assignations.utilisateurId, benevoleId), eq(beneficiaires.statut, "active")));
    return { ...b, nbPersonnes: n };
  },

  async personnesConfiees(communeId, benevoleId, jour) {
    const lignes = await db
      .select(colonnesPersonne)
      .from(assignations)
      .innerJoin(beneficiaires, eq(beneficiaires.id, assignations.beneficiaireId))
      .innerJoin(foyers, eq(foyers.id, beneficiaires.foyerId))
      .where(and(eq(assignations.utilisateurId, benevoleId), eq(beneficiaires.communeId, communeId), eq(beneficiaires.statut, "active")))
      .orderBy(asc(beneficiaires.nom), asc(beneficiaires.prenom));
    return lignes.map((l) => versPersonne(l, jour));
  },

  async rechercher(communeId, benevoleId, texte, jour) {
    const motif = `%${texte.replace(/[%_]/g, "")}%`;
    const lignes = await db
      .select({
        ...colonnesPersonne,
        dejaConfiee: sql<boolean>`exists (select 1 from assignations a where a.beneficiaire_id = ${beneficiaires.id} and a.utilisateur_id = ${benevoleId})`,
      })
      .from(beneficiaires)
      .innerJoin(foyers, eq(foyers.id, beneficiaires.foyerId))
      .where(
        and(
          eq(beneficiaires.communeId, communeId),
          eq(beneficiaires.statut, "active"),
          or(ilike(beneficiaires.nom, motif), ilike(beneficiaires.prenom, motif), ilike(foyers.voie, motif)),
        ),
      )
      .orderBy(asc(beneficiaires.nom), asc(beneficiaires.prenom))
      .limit(20);
    return lignes.map((l) => ({ ...versPersonne(l, jour), dejaConfiee: l.dejaConfiee }));
  },

  async emailUtilise(email) {
    const u = await db.query.utilisateurs.findFirst({ where: eq(sql`lower(${utilisateurs.email})`, email), columns: { id: true } });
    return Boolean(u);
  },

  async creer(communeId, b) {
    const [u] = await db.insert(utilisateurs).values({ ...b, communeId, role: "benevole" }).returning({ id: utilisateurs.id });
    return u.id;
  },

  async confier(communeId, benevoleId, beneficiaireIds) {
    const valides = await db
      .select({ id: beneficiaires.id })
      .from(beneficiaires)
      .where(and(eq(beneficiaires.communeId, communeId), inArray(beneficiaires.id, beneficiaireIds)));
    if (valides.length === 0) return 0;
    const ajoutees = await db
      .insert(assignations)
      .values(valides.map((v) => ({ beneficiaireId: v.id, utilisateurId: benevoleId })))
      .onConflictDoNothing()
      .returning({ id: assignations.beneficiaireId });
    return ajoutees.length;
  },

  async retirer(communeId, benevoleId, beneficiaireId) {
    await db
      .delete(assignations)
      .where(
        and(
          eq(assignations.utilisateurId, benevoleId),
          eq(assignations.beneficiaireId, beneficiaireId),
          inArray(assignations.beneficiaireId, db.select({ id: beneficiaires.id }).from(beneficiaires).where(eq(beneficiaires.communeId, communeId))),
        ),
      );
  },
};
