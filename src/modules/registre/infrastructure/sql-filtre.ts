/**
 * Traduction du `Filtre` du domaine en conditions SQL (Drizzle). Tout est évalué côté serveur :
 * filtrage, tri et pagination (objectif : 10 000 fiches en moins d'une seconde).
 */
import { and, arrayOverlaps, asc, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { DateISO } from "@/shared/domain/dates";
import { beneficiaires as b, foyers as f } from "@/shared/infrastructure/db/schema";
import { bornesNaissance, dateLimiteContact, dateLimiteVerification, rectangleEnglobant, type Filtre, type FiltreRue, type ZoneCarte } from "../domain/filtre";
import type { Colonne, Tri } from "../domain/tableau";

/** Niveau effectif : forcé manuellement (RG-01), sinon calculé. */
export const niveauEffectif = sql<"P1" | "P2" | "P3">`coalesce(${b.niveauForce}, ${b.niveauPriorite})`;

export const apaEnCours = (jour: DateISO) =>
  sql<boolean>`exists (select 1 from prises_en_charge p where p.beneficiaire_id = ${b.id} and p.type = 'apa' and (p.date_fin is null or p.date_fin >= ${jour}::date))`;

export const indisponibleLe = (jour: DateISO) =>
  sql<boolean>`exists (select 1 from indisponibilites i where i.beneficiaire_id = ${b.id} and i.debut <= ${jour}::date and (i.fin is null or i.fin >= ${jour}::date))`;

/** Date-heure (Paris) du dernier contact, au format ISO local `YYYY-MM-DDTHH:MM`. */
export const dernierContactInstant = sql`(select max(i.survenue_le) from interactions i where i.beneficiaire_id = ${b.id})`;
export const dernierContactTexte = sql<string | null>`to_char(${dernierContactInstant} at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI')`;

const echapperLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

const ACCENTS = "àâäáãéèêëíìîïóòôöõúùûüçñœ";
const SANS = "aaaaaeeeeiiiiooooouuuucno";
/** Minuscules sans accents (sans l'extension `unaccent`, pour ne pas modifier la base). */
export const SANS_ACCENTS = (col: SQLWrapper) => sql`translate(lower(${col}), ${ACCENTS}, ${SANS})`;
export const sansAccents = (t: string) =>
  [...t.toLowerCase()].map((c) => (ACCENTS.includes(c) ? SANS[ACCENTS.indexOf(c)] : c)).join("");

function conditionRecherche(recherche: string): SQL | undefined {
  const termes = recherche.split(/\s+/).filter(Boolean).slice(0, 6);
  const parTerme = termes.map((terme) => {
    const motif = `%${echapperLike(sansAccents(terme))}%`;
    const options: (SQL | undefined)[] = [
      sql`${SANS_ACCENTS(b.nom)} like ${motif}`,
      sql`${SANS_ACCENTS(b.prenom)} like ${motif}`,
      sql`${SANS_ACCENTS(b.nomNaissance)} like ${motif}`,
      sql`${SANS_ACCENTS(f.voie)} like ${motif}`,
    ];
    const chiffres = terme.replace(/\D/g, "");
    if (/^\d+$/.test(terme) && terme.length <= 4) options.push(eq(f.numero, Number(terme)));
    if (chiffres.length >= 2) {
      options.push(
        sql`regexp_replace(coalesce(${b.telephoneFixe}, '') || ' ' || coalesce(${b.telephoneMobile}, ''), '\\D', '', 'g') like ${`%${chiffres}%`}`,
      );
    }
    return or(...options);
  });
  return and(...parTerme);
}

function conditionRue(rue: FiltreRue): SQL | undefined {
  return and(
    eq(f.voie, rue.voie),
    rue.numeroMin !== undefined ? gte(f.numero, rue.numeroMin) : undefined,
    rue.numeroMax !== undefined ? lte(f.numero, rue.numeroMax) : undefined,
    rue.cote === "pair" ? sql`${f.numero} % 2 = 0` : undefined,
    rue.cote === "impair" ? sql`${f.numero} % 2 = 1` : undefined,
  );
}

function conditionZone(zone: ZoneCarte): SQL | undefined {
  const [latMin, lonMin, latMax, lonMax] = rectangleEnglobant(zone);
  const rectangle = and(isNotNull(f.lat), isNotNull(f.lon), sql`${f.lat} between ${latMin} and ${latMax}`, sql`${f.lon} between ${lonMin} and ${lonMax}`);
  if (zone.type === "polygone") {
    // Type géométrique natif de PostgreSQL (sans PostGIS) : polygon @> point(x = lon, y = lat).
    const texte = `(${zone.points.map(([lat, lon]) => `(${lon},${lat})`).join(",")})`;
    return and(rectangle, sql`${texte}::polygon @> point(${f.lon}, ${f.lat})`);
  }
  const [cLat, cLon] = zone.centre;
  return and(
    rectangle,
    sql`2 * 6371000 * asin(sqrt(power(sin(radians(${f.lat} - ${cLat}) / 2), 2) + cos(radians(${cLat})) * cos(radians(${f.lat})) * power(sin(radians(${f.lon} - ${cLon}) / 2), 2))) <= ${zone.rayonMetres}`,
  );
}

/** Conditions d'un filtre (critères combinés en ET). */
export function conditionsFiltre(filtre: Filtre, jour: DateISO): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (filtre.recherche) c.push(conditionRecherche(filtre.recherche));
  if (filtre.age) {
    const { neAvantLe, neApres } = bornesNaissance(filtre.age, jour);
    if (neAvantLe) c.push(lte(b.dateNaissance, neAvantLe));
    if (neApres) c.push(sql`${b.dateNaissance} > ${neApres}`);
  }
  if (filtre.sexes) c.push(inArray(b.sexe, filtre.sexes));
  if (filtre.vitSeul !== undefined) c.push(filtre.vitSeul ? eq(b.modeDeVie, "seul") : sql`${b.modeDeVie} is distinct from 'seul'`);
  if (filtre.deplacements) c.push(inArray(b.deplacement, filtre.deplacements));
  if (filtre.handicap !== undefined) {
    const avec = sql`(${b.categorie} = 'handicap' or coalesce(${b.handicap}, '') <> '')`;
    c.push(filtre.handicap ? avec : sql`not ${avec}`);
  }
  if (filtre.apa !== undefined) c.push(filtre.apa ? apaEnCours(jour) : sql`not ${apaEnCours(jour)}`);
  if (filtre.girs) c.push(inArray(b.gir, filtre.girs));
  if (filtre.niveaux) c.push(inArray(niveauEffectif, filtre.niveaux));
  c.push(filtre.statuts ? inArray(b.statut, filtre.statuts) : ne(b.statut, "archivee"));
  if (filtre.tags) c.push(arrayOverlaps(b.tags, filtre.tags));
  if (filtre.dernierContact) {
    const limite = dateLimiteContact(filtre.dernierContact, jour);
    c.push(
      filtre.dernierContact.sens === "moins_de"
        ? sql`${dernierContactInstant} >= ${limite}::date`
        : sql`(${dernierContactInstant} is null or ${dernierContactInstant} < ${limite}::date)`,
    );
  }
  if (filtre.nonVerifieeDepuisMois !== undefined) {
    const limite = dateLimiteVerification(filtre.nonVerifieeDepuisMois, jour);
    c.push(sql`coalesce(${b.dateDerniereVerification}, ${b.dateInscription}) < ${limite}::date`);
  }
  if (filtre.indisponible !== undefined) c.push(filtre.indisponible ? indisponibleLe(jour) : sql`not ${indisponibleLe(jour)}`);
  if (filtre.assignesA) {
    const liste = sql.join(
      filtre.assignesA.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    c.push(sql`exists (select 1 from assignations a where a.beneficiaire_id = ${b.id} and a.utilisateur_id in (${liste}))`);
  }
  if (filtre.rues) c.push(or(...filtre.rues.map(conditionRue)));
  if (filtre.quartiers) c.push(inArray(f.quartier, filtre.quartiers));
  if (filtre.zone) c.push(conditionZone(filtre.zone));
  if (filtre.ids) c.push(filtre.ids.length > 0 ? sql`${b.id} = any(${`{${filtre.ids.join(",")}}`}::uuid[])` : sql`false`);
  return and(...c);
}

export function conditionsCommune(communeId: string, filtres: Filtre[], jour: DateISO): SQL | undefined {
  return and(eq(b.communeId, communeId), ...filtres.map((filtre) => conditionsFiltre(filtre, jour)));
}

// ─── Tri ──────────────────────────────────────────────────────────────────────

export const ordrePriorite = [asc(niveauEffectif), desc(b.score), asc(b.nom), asc(b.prenom), asc(b.id)];

const EXPRESSIONS_TRI: Partial<Record<Colonne, (sens: "asc" | "desc") => SQL[]>> = {
  nom: (s) => [s === "asc" ? asc(b.nom) : desc(b.nom), s === "asc" ? asc(b.prenom) : desc(b.prenom)],
  // âge croissant = date de naissance décroissante
  age: (s) => [s === "asc" ? desc(b.dateNaissance) : asc(b.dateNaissance)],
  priorite: (s) => (s === "asc" ? [asc(niveauEffectif), desc(b.score)] : [desc(niveauEffectif), asc(b.score)]),
  statut: (s) => [s === "asc" ? asc(b.statut) : desc(b.statut)],
  adresse: (s) => (s === "asc" ? [asc(f.voie), asc(f.numero)] : [desc(f.voie), desc(f.numero)]),
  quartier: (s) => [s === "asc" ? sql`${f.quartier} asc nulls last` : sql`${f.quartier} desc nulls last`],
  sexe: (s) => [s === "asc" ? asc(b.sexe) : desc(b.sexe)],
  modeDeVie: (s) => [s === "asc" ? sql`${b.modeDeVie} asc nulls last` : sql`${b.modeDeVie} desc nulls last`],
  deplacement: (s) => [
    sql`array_position(array['seul','canne','deambulateur','fauteuil','immobilise'], ${b.deplacement}) ${sql.raw(s)} nulls last`,
  ],
  gir: (s) => [s === "asc" ? sql`${b.gir} asc nulls last` : sql`${b.gir} desc nulls last`],
  // « jamais contacté » = le plus ancien
  dernierContact: (s) => [s === "asc" ? sql`${dernierContactInstant} asc nulls first` : sql`${dernierContactInstant} desc nulls last`],
};

export function ordreTri(tri: Tri[]): SQL[] {
  const expressions = tri.flatMap((t) => EXPRESSIONS_TRI[t.colonne]?.(t.sens) ?? []);
  return [...expressions, asc(b.nom), asc(b.prenom), asc(b.id)];
}
