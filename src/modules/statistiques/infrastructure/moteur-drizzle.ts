import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/shared/infrastructure/db/client";
import {
  beneficiaires as b,
  campagnes as ca,
  ciblesCampagne as c,
  foyers as f,
  inscriptions as ins,
  interactions as i,
  quartiers,
  rappels as r,
} from "@/shared/infrastructure/db/schema";
import type { DateISO } from "@/shared/domain/dates";
import { developperMobilite, developperStatutAppel, estSujetPersonne, type DecoupageId, type Sujet } from "../domain/catalogue";
import type { DefinitionRequete, Filtre, Periode, Referentiels } from "../domain/requete";
import type { ResultatBrut } from "../domain/resultat";
import type { MoteurStatistiques, PersonneTrouvee } from "../application/ports";

/*
 * Traduction d'une définition (déjà validée par Zod) en SQL.
 * Sûreté : les noms de tables et de colonnes viennent exclusivement de ce fichier ; toutes les valeurs
 * saisies par l'utilisateur passent en paramètres liés (`${valeur}` dans le gabarit `sql`), jamais concaténées.
 */

type Expr = SQL | AnyPgColumn;
type Plan = { from: SQL; where: SQL[]; unite: Expr; date: SQL };

const TYPES_CONTACT = ["appel_sortant", "appel_entrant", "visite", "appel_ia"];

const liste = (valeurs: (string | number)[]) => sql.join(valeurs.map((v) => sql`${v}`), sql`, `);

/** `col = v1 ou v2…` ; la négation garde les valeurs non renseignées. */
function parmi(col: Expr, valeurs: string[], positif: boolean): SQL {
  if (!valeurs.length) return positif ? sql`false` : sql`true`;
  return positif ? sql`${col} in (${liste(valeurs)})` : sql`(${col} is null or ${col} not in (${liste(valeurs)}))`;
}

const ageSql = (ref: DateISO) => sql`extract(year from age(${ref}::date, ${b.dateNaissance}))::int`;
const prioriteSql = sql`coalesce(${b.niveauForce}, ${b.niveauPriorite})`;
const etatRappelSql = (ref: DateISO) =>
  sql`case when ${r.faitLe} is not null then 'fait' when ${r.echeance} < ${ref}::date then 'en_retard' else 'a_venir' end`;
const ilYA = (ref: DateISO, mois: number) => sql`(${ref}::date - make_interval(months => ${mois}::int))`;

function plan(sujet: Sujet, communeId: string): Plan {
  switch (sujet) {
    case "beneficiaires":
      return {
        from: sql`${b} inner join ${f} on ${f.id} = ${b.foyerId}`,
        where: [eq(b.communeId, communeId), eq(b.statut, "active")],
        unite: b.id,
        date: sql`${b.dateInscription}`,
      };
    case "interactions":
      return {
        from: sql`${i} inner join ${b} on ${b.id} = ${i.beneficiaireId} inner join ${f} on ${f.id} = ${b.foyerId}`,
        where: [eq(i.communeId, communeId)],
        unite: i.id,
        date: sql`(${i.survenueLe} at time zone 'Europe/Paris')::date`,
      };
    case "appels_campagne":
      return {
        from: sql`${c} inner join ${ca} on ${ca.id} = ${c.campagneId} inner join ${b} on ${b.id} = ${c.beneficiaireId} inner join ${f} on ${f.id} = ${b.foyerId}`,
        where: [eq(ca.communeId, communeId)],
        unite: c.id,
        date: sql`${c.vagueDate}`,
      };
    case "inscriptions":
      return { from: sql`${ins}`, where: [eq(ins.communeId, communeId)], unite: ins.id, date: sql`(${ins.soumisLe} at time zone 'Europe/Paris')::date` };
    case "rappels":
      return { from: sql`${r}`, where: [eq(r.communeId, communeId)], unite: r.id, date: sql`${r.echeance}` };
  }
}

function condition(filtre: Filtre, ref: DateISO): SQL {
  const pos = filtre.operateur !== "n_est_pas";
  const v = filtre.valeur;
  const oui = v === "oui";
  const nombre = Number(v);
  const comparer = (expr: SQL) =>
    filtre.operateur === "sup_egal" ? sql`${expr} >= ${nombre}` : filtre.operateur === "inf_egal" ? sql`${expr} <= ${nombre}` : sql`${expr} = ${nombre}`;

  switch (filtre.champ) {
    case "sexe":
      return parmi(b.sexe, [v], pos);
    case "age":
      return comparer(ageSql(ref));
    case "prise_en_charge": {
      const existe = sql`exists (select 1 from prises_en_charge pec where pec.beneficiaire_id = ${b.id} and pec.type = ${v} and (pec.date_fin is null or pec.date_fin >= ${ref}::date))`;
      return pos ? existe : sql`not ${existe}`;
    }
    case "mobilite":
      return parmi(b.deplacement, developperMobilite(v), pos);
    case "mode_de_vie":
      return parmi(b.modeDeVie, [v], pos);
    case "quartier":
      return parmi(f.quartier, [v], pos);
    case "gir":
      return parmi(sql`${b.gir}::text`, [v], pos);
    case "priorite":
      return parmi(prioriteSql, [v], pos);
    case "categorie":
      return parmi(b.categorie, [v], pos);
    case "troubles_cognitifs":
      return sql`${b.troublesCognitifs} = ${oui}`;
    case "sans_telephone":
      return sql`${b.pasDeTelephone} = ${oui}`;
    case "teleassistance":
      return sql`${b.teleassistance} = ${oui}`;
    case "adresse_a_verifier":
      return sql`(${f.adresseAVerifier} or ${f.lon} is null) = ${oui}`;
    case "caisse_retraite":
      return parmi(b.caisseRetraite, [v], pos);
    case "aide_caisse_retraite":
      return sql`${b.aideCaisseRetraite} = ${oui}`;
    case "origine_inscription":
      return parmi(b.origineInscription, [v], pos);
    case "mois_sans_contact":
      return sql`not exists (select 1 from interactions ix where ix.beneficiaire_id = ${b.id} and ix.type in (${liste(TYPES_CONTACT)}) and ix.survenue_le >= ${ilYA(ref, nombre)})`;
    case "type_interaction":
      return parmi(i.type, [v], pos);
    case "campagne":
      return sql`${c.campagneId} = ${v}::uuid`;
    case "statut_appel":
      return parmi(c.statut, developperStatutAppel(v), pos);
    case "canal":
      return parmi(c.canal, [v], pos);
    case "besoin":
      return pos ? sql`${v} = any(${c.besoins})` : sql`not (${v} = any(${c.besoins}))`;
    case "statut_inscription":
      return parmi(ins.statut, [v], pos);
    case "etat_rappel":
      return parmi(etatRappelSql(ref), [v], pos);
    case "type_rappel":
      return parmi(r.type, [v], pos);
  }
}

function decoupageSql(dec: DecoupageId, p: Plan, ref: DateISO): { cle: SQL; jointure: SQL } {
  const sans = sql``;
  switch (dec) {
    case "tranche_age":
      return { cle: sql`${ageSql(ref)}::text`, jointure: sans };
    case "sexe":
      return { cle: sql`${b.sexe}`, jointure: sans };
    case "quartier":
      return { cle: sql`${f.quartier}`, jointure: sans };
    case "gir":
      return { cle: sql`${b.gir}::text`, jointure: sans };
    case "priorite":
      return { cle: prioriteSql, jointure: sans };
    case "mode_de_vie":
      return { cle: sql`${b.modeDeVie}`, jointure: sans };
    case "caisse_retraite":
      return { cle: sql`${b.caisseRetraite}`, jointure: sans };
    case "origine_inscription":
      return { cle: sql`${b.origineInscription}`, jointure: sans };
    case "mobilite":
      return { cle: sql`${b.deplacement}`, jointure: sans };
    case "prise_en_charge":
      return {
        cle: sql`pec_d.type`,
        jointure: sql`left join prises_en_charge pec_d on pec_d.beneficiaire_id = ${b.id} and (pec_d.date_fin is null or pec_d.date_fin >= ${ref}::date)`,
      };
    case "mois":
      return { cle: sql`to_char(${p.date}, 'YYYY-MM')`, jointure: sans };
    case "jour":
      return { cle: sql`to_char(${p.date}, 'YYYY-MM-DD')`, jointure: sans };
    case "type_interaction":
      return { cle: sql`${i.type}`, jointure: sans };
    case "statut_appel":
      return { cle: sql`${c.statut}`, jointure: sans };
    case "canal":
      return { cle: sql`${c.canal}`, jointure: sans };
    case "besoin":
      return { cle: sql`bs.besoin`, jointure: sql`left join lateral unnest(${c.besoins}) as bs(besoin) on true` };
    case "campagne":
      return { cle: sql`${c.campagneId}::text`, jointure: sans };
    case "statut_inscription":
      return { cle: sql`${ins.statut}`, jointure: sans };
    case "etat_rappel":
      return { cle: etatRappelSql(ref), jointure: sans };
    case "type_rappel":
      return { cle: sql`${r.type}`, jointure: sans };
  }
}

function conditions(d: DefinitionRequete, p: Plan, periode: Periode | null, ref: DateISO): SQL | undefined {
  return and(
    ...p.where,
    ...d.filtres.map((x) => condition(x, ref)),
    ...(periode ? [sql`${p.date} between ${periode.du}::date and ${periode.au}::date`] : []),
  );
}

export const moteurStatistiquesDrizzle: MoteurStatistiques = {
  async compter(communeId, d, periode, ref) {
    const p = plan(d.sujet, communeId);
    const where = conditions(d, p, periode, ref);
    const [{ n: total }] = await db.execute<{ n: number }>(sql`select count(distinct ${p.unite})::int as n from ${p.from} where ${where}`);
    if (!d.decoupage) return { total, lignes: [] } satisfies ResultatBrut;
    const dec = decoupageSql(d.decoupage, p, ref);
    const lignes = await db.execute<{ cle: string | null; n: number }>(
      sql`select ${dec.cle} as cle, count(distinct ${p.unite})::int as n from ${p.from} ${dec.jointure} where ${where} group by 1`,
    );
    return { total, lignes: [...lignes] };
  },

  async personnes(communeId, d, ref, limite) {
    if (!estSujetPersonne(d.sujet)) return { total: 0, personnes: [] };
    const p = plan(d.sujet, communeId);
    const where = conditions(d, p, d.periode, ref);
    const [{ n: total }] = await db.execute<{ n: number }>(sql`select count(distinct ${b.id})::int as n from ${p.from} where ${where}`);
    const lignes = await db.execute<PersonneTrouvee>(
      sql`select distinct ${b.id} as id, ${b.civilite} as civilite, ${b.nom} as nom, ${b.prenom} as prenom, ${ageSql(ref)} as age,
            ${f.quartier} as quartier, ${prioriteSql} as priorite,
            concat_ws(' ', ${f.numero}::text, ${f.rep}, ${f.voie}) as adresse,
            coalesce(${b.telephoneMobile}, ${b.telephoneFixe}) as telephone
          from ${p.from} where ${where} order by nom, prenom limit ${limite}`,
    );
    return { total, personnes: [...lignes] satisfies PersonneTrouvee[] };
  },

  async referentiels(communeId): Promise<Referentiels> {
    const [qs, cs] = await Promise.all([
      db.select({ nom: quartiers.nom }).from(quartiers).where(eq(quartiers.communeId, communeId)).orderBy(asc(quartiers.nom)),
      db.select({ id: ca.id, nom: ca.nom }).from(ca).where(eq(ca.communeId, communeId)).orderBy(desc(ca.dateDebut)),
    ]);
    return { quartiers: qs.map((q) => q.nom), campagnes: cs };
  },

  async quartiers(communeId) {
    return db.select({ nom: quartiers.nom, contour: quartiers.contour }).from(quartiers).where(eq(quartiers.communeId, communeId));
  },
};
