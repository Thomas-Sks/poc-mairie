import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import {
  beneficiaires as b,
  campagnes as ca,
  ciblesCampagne as c,
  communes,
  foyers as f,
  inscriptions as ins,
  interactions as i,
  prisesEnCharge as pec,
  rappels as r,
} from "@/shared/infrastructure/db/schema";
import type { DateISO } from "@/shared/domain/dates";
import type { IndicateursBruts } from "../domain/vue-ensemble";
import type { IndicateursRepository } from "../application/ports";

/*
 * Comptages de la vue d'ensemble. Toutes les valeurs passent en paramètres liés ; les noms de tables
 * et colonnes viennent du schéma Drizzle.
 */

const TYPES_APPEL = sql`('appel_sortant', 'appel_entrant', 'appel_ia')`;
const TYPES_CONTACT = sql`('appel_sortant', 'appel_entrant', 'appel_ia', 'visite')`;
const AIDES_A_DOMICILE = sql`('aide_domicile', 'portage_repas', 'soins_infirmiers', 'ssiad', 'kine')`;
const SIGNALEMENTS = sql`('joint_besoin', 'danger', 'evacuation', 'escalade_humain', 'non_joint_a_traiter')`;
const JOINTES_OU_COUVERTES = sql`('joint_ras', 'joint_besoin', 'couvert_proche', 'couvert_passage', 'absent')`;

const priorite = sql`coalesce(${b.niveauForce}, ${b.niveauPriorite})`;
const dernierContact = sql`(select max(${i.survenueLe}) from ${i} where ${i.beneficiaireId} = ${b.id} and ${i.type} in ${TYPES_CONTACT})`;

export const indicateursDrizzle: IndicateursRepository = {
  async charger(communeId: string, jour: DateISO): Promise<IndicateursBruts> {
    const commune = await db.query.communes.findFirst({ where: eq(communes.id, communeId), columns: { parametres: true } });
    const moisVerification = commune?.parametres.verificationMois ?? 12;
    const actives = sql`${b.communeId} = ${communeId} and ${b.statut} = 'active'`;

    const [population] = await db.execute<{
      actifs: number;
      p1: number;
      p2: number;
      p3: number;
      vit_seul: number;
      age85: number;
      mobilite: number;
      cognitifs: number;
      sans_tel: number;
      sans_aide: number;
      inscrits: number;
      a_reverifier: number;
      adresse: number;
      contactes90: number;
      sans6m: number;
    }>(sql`
      select
        count(*)::int as actifs,
        count(*) filter (where ${priorite} = 'P1')::int as p1,
        count(*) filter (where ${priorite} = 'P2')::int as p2,
        count(*) filter (where ${priorite} = 'P3')::int as p3,
        count(*) filter (where ${b.modeDeVie} = 'seul')::int as vit_seul,
        count(*) filter (where extract(year from age(${jour}::date, ${b.dateNaissance})) >= 85)::int as age85,
        count(*) filter (where ${b.deplacement} in ('deambulateur', 'fauteuil', 'immobilise'))::int as mobilite,
        count(*) filter (where ${b.troublesCognitifs})::int as cognitifs,
        count(*) filter (where ${b.pasDeTelephone})::int as sans_tel,
        count(*) filter (where not exists (
          select 1 from ${pec} where ${pec.beneficiaireId} = ${b.id} and ${pec.type} in ${AIDES_A_DOMICILE}
            and (${pec.dateFin} is null or ${pec.dateFin} >= ${jour}::date)))::int as sans_aide,
        count(*) filter (where ${b.dateInscription} > ${jour}::date - interval '12 months')::int as inscrits,
        count(*) filter (where coalesce(${b.dateDerniereVerification}, ${b.dateInscription})
          < ${jour}::date - make_interval(months => ${moisVerification}::int))::int as a_reverifier,
        count(*) filter (where ${f.adresseAVerifier})::int as adresse,
        count(*) filter (where ${dernierContact} >= ${jour}::date - interval '90 days')::int as contactes90,
        count(*) filter (where ${dernierContact} is null or ${dernierContact} < ${jour}::date - interval '6 months')::int as sans6m
      from ${b} join ${f} on ${f.id} = ${b.foyerId}
      where ${actives}`);

    const [[{ n: rappelsEnRetard }], [{ n: inscriptionsEnAttente }]] = await Promise.all([
      db.execute<{ n: number }>(
        sql`select count(*)::int as n from ${r} where ${r.communeId} = ${communeId} and ${r.faitLe} is null and ${r.echeance} < ${jour}::date`,
      ),
      db.execute<{ n: number }>(sql`select count(*)::int as n from ${ins} where ${ins.communeId} = ${communeId} and ${ins.statut} = 'en_attente'`),
    ]);

    const moisParis = sql`to_char(${i.survenueLe} at time zone 'Europe/Paris', 'YYYY-MM')`;
    const [contactsParMois, quartiers, p1SansContact, alertes] = await Promise.all([
      db.execute<{ mois: string; appels: number; appelsAlerte: number; visites: number }>(sql`
        select ${moisParis} as mois,
          count(*) filter (where ${i.type} in ${TYPES_APPEL} and ${i.campagneId} is null)::int as appels,
          count(*) filter (where ${i.type} in ${TYPES_APPEL} and ${i.campagneId} is not null)::int as "appelsAlerte",
          count(*) filter (where ${i.type} = 'visite')::int as visites
        from ${i}
        where ${i.communeId} = ${communeId}
          and ${i.survenueLe} >= date_trunc('month', ${jour}::date - interval '11 months')
          and ${i.survenueLe} < ${jour}::date + interval '1 day'
        group by 1 order by 1`),
      db.execute<{ nom: string; total: number; p1: number }>(sql`
        select coalesce(${f.quartier}, 'Non renseigné') as nom, count(*)::int as total,
          count(*) filter (where ${priorite} = 'P1')::int as p1
        from ${b} join ${f} on ${f.id} = ${b.foyerId}
        where ${actives}
        group by 1`),
      db.execute<{ id: string; nom: string; jours: number | null; quartier: string | null }>(sql`
        select ${b.id} as id, ${b.civilite} || ' ' || ${b.prenom} || ' ' || ${b.nom} as nom,
          (${jour}::date - (${dernierContact} at time zone 'Europe/Paris')::date) as jours, ${f.quartier} as quartier
        from ${b} join ${f} on ${f.id} = ${b.foyerId}
        where ${actives} and ${priorite} = 'P1'
          and (${dernierContact} is null or ${dernierContact} < ${jour}::date - interval '60 days')
        order by jours desc nulls first
        limit 6`),
      db.execute<{
        campagne_id: string;
        nom: string;
        debut: string;
        fin: string | null;
        personnes: number;
        vagues: number;
        cibles: number;
        jointes: number;
        passage: number;
        signalees: number;
        ia: number;
      }>(sql`
        select ${ca.id} as campagne_id, ${ca.nom} as nom, ${ca.dateDebut}::text as debut, ${ca.dateFin}::text as fin,
          count(distinct ${c.beneficiaireId})::int as personnes,
          count(distinct ${c.vagueDate})::int as vagues,
          count(${c.id})::int as cibles,
          count(*) filter (where ${c.statut} in ${JOINTES_OU_COUVERTES})::int as jointes,
          count(*) filter (where ${c.statut} = 'couvert_passage')::int as passage,
          count(*) filter (where ${c.statut} in ${SIGNALEMENTS})::int as signalees,
          count(*) filter (where ${c.canal} = 'ia')::int as ia
        from ${ca} join ${c} on ${c.campagneId} = ${ca.id}
        where ${ca.communeId} = ${communeId} and ${ca.alerteId} is not null
        group by ${ca.id}
        order by ${ca.dateDebut} desc, ${ca.createdAt} desc
        limit 1`),
    ]);

    const p = population;
    const a = alertes[0];
    return {
      actifs: p.actifs,
      parNiveau: { P1: p.p1, P2: p.p2, P3: p.p3 },
      inscritsSurPeriode: p.inscrits,
      fragilites: {
        vitSeul: p.vit_seul,
        age85: p.age85,
        mobiliteReduite: p.mobilite,
        troublesCognitifs: p.cognitifs,
        sansAideADomicile: p.sans_aide,
        sansTelephone: p.sans_tel,
      },
      suivi: { contactes90j: p.contactes90, sansContact6Mois: p.sans6m, rappelsEnRetard },
      contactsParMois: [...contactsParMois],
      quartiers: [...quartiers],
      p1SansContact: p1SansContact.map((x) => ({ id: x.id, nom: x.nom, joursSansContact: x.jours, quartier: x.quartier })),
      qualite: { aReverifier: p.a_reverifier, adresseAVerifier: p.adresse, inscriptionsEnAttente },
      derniereAlerte: a
        ? {
            campagneId: a.campagne_id,
            nom: a.nom,
            debut: a.debut,
            fin: a.fin,
            personnes: a.personnes,
            vagues: a.vagues,
            cibles: a.cibles,
            jointesOuCouvertes: a.jointes,
            couvertesParPassage: a.passage,
            situationsSignalees: a.signalees,
            parIa: a.ia,
          }
        : null,
    };
  },
};
