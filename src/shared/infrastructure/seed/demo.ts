/**
 * Jeu de données de démo (§10.2) : commune de Lomme, ~150 bénéficiaires fictifs sur ~120 foyers
 * placés à de vraies adresses BAN, cercles, intervenants, plannings, historique sur 12 mois,
 * une canicule passée (juillet 2026) et le scénario du fil rouge (§10.4).
 *
 * Toutes les dates « vivantes » sont relatives au jour du seed, pour que la démo soit toujours fraîche.
 * Rejouable : tout est effacé puis recréé (bouton « Réinitialiser la démo »).
 */
import { fakerFR as faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import banLomme from "../../../../data/ban-lomme.json";
import * as s from "../db/schema";
import { ajouterJours, aujourdhui, calculerAge, jourDeSemaine, type DateISO } from "@/shared/domain/dates";
import { calculerScore, GRILLE_PAR_DEFAUT } from "@/shared/domain/priorite";
import { RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import type {
  Besoin,
  Deplacement,
  ModeDeVie,
  OrigineInscription,
  Relation,
  StatutCible,
  TypeInteraction,
  TypePriseEnCharge,
} from "@/shared/domain/vocabulaire";
import { extraireFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import { SCRIPTS_PAR_DEFAUT, SCRIPT_CANICULE } from "@/modules/crise/domain/scripts-par-defaut";
import { EXTENSIONS_SEED, type ContexteSeed } from "./extensions";

type Db = PostgresJsDatabase<typeof s>;
type LigneBan = [id: string, numero: number, rep: string, voie: string, lon: number, lat: number];

// ─── Utilitaires aléatoires déterministes ────────────────────────────────────

const pick = <T>(arr: readonly T[]): T => faker.helpers.arrayElement(arr);
const chance = (p: number) => faker.number.float({ min: 0, max: 1 }) < p;
const entre = (min: number, max: number) => faker.number.int({ min, max });
const pondere = <T>(options: [T, number][]): T => faker.helpers.weightedArrayElement(options.map(([value, weight]) => ({ value, weight })));

let compteurFixe = 0;
let compteurMobile = 0;
/** Numéros fictifs réservés par l'ARCEP (01 99 00 xx xx / 06 39 98 xx xx). */
const telFixe = () => {
  const n = String(compteurFixe++).padStart(4, "0");
  return `01 99 00 ${n.slice(0, 2)} ${n.slice(2)}`;
};
const telMobile = () => {
  const n = String(compteurMobile++).padStart(4, "0");
  return `06 39 98 ${n.slice(0, 2)} ${n.slice(2)}`;
};

const instant = (date: DateISO, heure: string) => new Date(`${date}T${heure}:00+02:00`);

// ─── Référentiels ────────────────────────────────────────────────────────────

/** Découpage indicatif de Lomme en 6 secteurs (référentiel paramétrable, E8-US3). */
const LON = [2.969, 2.9873, 3.0056, 3.0235];
const LAT = [50.626, 50.6435, 50.6612];
const NOMS_SECTEURS = [
  ["Délivrance", "Marais", "Kiener"],
  ["Mitterie", "Bourg", "Canteleu"],
];
export const QUARTIERS = NOMS_SECTEURS.flatMap((ligne, i) =>
  ligne.map((nom, j) => ({
    nom,
    contour: [
      [LON[j], LAT[i]],
      [LON[j + 1], LAT[i]],
      [LON[j + 1], LAT[i + 1]],
      [LON[j], LAT[i + 1]],
    ] as [number, number][],
  })),
);
export function quartierDe(lon: number, lat: number): string {
  const j = Math.min(2, Math.max(0, LON.findIndex((v, k) => lon >= v && lon < (LON[k + 1] ?? Infinity))));
  const i = lat < LAT[1] ? 0 : 1;
  return NOMS_SECTEURS[i][j];
}

const INFOS_PRIORITAIRES = [
  "Malentendante – laisser sonner longtemps",
  "Malentendant – parler fort et lentement",
  "Ne pas appeler avant 10h",
  "Chien agressif en cas de visite",
  "Fait la sieste de 14h à 16h, ne pas appeler",
  "Sonnette en panne – frapper fort",
  "Parle surtout portugais, sa fille traduit",
];
const HABITUDES = [
  "Sort au marché le mardi matin.",
  "Va à la messe le dimanche matin.",
  "Club de belote à la Maison des seniors le jeudi après-midi.",
  "Promenade quotidienne au parc vers 17h.",
  "Reçoit sa fille tous les week-ends.",
  "Ne sort presque plus depuis l'hiver dernier.",
];
const INTERETS = ["Jardinage", "Mots croisés", "Football (LOSC)", "Cuisine", "Lecture", "Chorale", "Tricot", "Histoire locale"];
const TAGS = ["isolement social", "refuse les visites", "ancien combattant", "aidant familial épuisé", "logement insalubre", "fragilité hivernale"];
const VILLES_PROCHES = ["Lomme", "Lomme", "Lille", "Lambersart", "Sequedin", "Haubourdin"];
const VILLES_LOIN = ["Paris", "Lyon", "Arras", "Dunkerque", "Valenciennes", "Rennes"];
const COMPTES_RENDUS: Record<string, string[]> = {
  appel_sortant: [
    "Appel de convivialité. Va bien, moral correct.",
    "Vérification annuelle : coordonnées à jour.",
    "Se plaint de douleurs au dos, suivi par son médecin.",
    "Rappel des numéros utiles avant l'été.",
    "Toujours au même numéro, pas de départ prévu.",
  ],
  appel_entrant: [
    "Appelle pour se renseigner sur le portage de repas.",
    "Signale un changement de numéro de sa fille.",
    "Demande des informations sur le colis de Noël.",
  ],
  visite: ["Visite à domicile : logement en ordre, frigo rempli.", "Visite de vérification annuelle, fiche mise à jour."],
  sms: ["SMS de rappel des recommandations chaleur."],
  courrier: ["Courrier de renouvellement de l'inscription au registre."],
};

// ─── Seed principal ──────────────────────────────────────────────────────────

export async function reinitialiserDemo(db: Db, jour: DateISO = aujourdhui()) {
  faker.seed(59160);
  compteurFixe = 0;
  compteurMobile = 0;

  await db.execute(sql`TRUNCATE TABLE communes, utilisateurs CASCADE`);

  // Commune & paramètres
  const [commune] = await db
    .insert(s.communes)
    .values({
      nom: "Lomme",
      codePostal: "59160",
      codeInsee: "59350",
      structureNom: "Maison des seniors de Lomme",
      structureTelephone: "01 99 00 99 00",
      centre: { lat: 50.6435, lon: 2.9935 },
      parametres: {
        grilleScore: GRILLE_PAR_DEFAUT,
      },
    })
    .returning();
  const communeId = commune.id;

  // Utilisateurs (§10.2 : Admin, 2 agents, 3 bénévoles)
  const users = await db
    .insert(s.utilisateurs)
    .values([
      { communeId, prenom: "Sophie", nom: "Lambert", email: "s.lambert@mairie-lomme.example", role: "admin", telephone: "01 99 00 98 01" },
      { communeId, prenom: "Julie", nom: "Moreau", email: "j.moreau@mairie-lomme.example", role: "agent", telephone: "01 99 00 98 02" },
      { communeId, prenom: "Karim", nom: "Haddad", email: "k.haddad@mairie-lomme.example", role: "agent", telephone: "01 99 00 98 03" },
      { communeId, prenom: "Marc", nom: "Petit", email: "marc.petit@example.org", role: "benevole", telephone: "06 39 98 97 01" },
      { communeId, prenom: "Lucie", nom: "Bernard", email: "lucie.bernard@example.org", role: "benevole", telephone: "06 39 98 97 02" },
      { communeId, prenom: "Ahmed", nom: "Benali", email: "ahmed.benali@example.org", role: "benevole", telephone: "06 39 98 97 03" },
    ])
    .returning();
  // Ordre d'insertion garanti identique à l'ordre de created_at (même transaction, même instant) : on trie côté app par rôle.
  const [admin, julie, karim] = users;
  const agents = [julie, karim];

  // Référentiels
  await db.insert(s.quartiers).values(QUARTIERS.map((q) => ({ communeId, ...q })));
  await db.insert(s.tags).values(TAGS.map((libelle) => ({ communeId, libelle })));
  await db.insert(s.scriptsAppel).values(SCRIPTS_PAR_DEFAUT.map((sc) => ({ communeId, ...sc })));

  const ban = banLomme as LigneBan[];
  for (let i = 0; i < ban.length; i += 1000) {
    await db.insert(s.adresses).values(
      ban.slice(i, i + 1000).map(([id, numero, rep, voie, lon, lat]) => ({ id, communeId, numero, rep: rep || null, voie, lon, lat })),
    );
  }

  const structures = await db
    .insert(s.structures)
    .values([
      { communeId, nom: "ADMR Lomme", type: "saad", telephone: "01 99 00 97 01" },
      { communeId, nom: "Aide et Services Métropole", type: "saad", telephone: "01 99 00 97 02" },
      { communeId, nom: "SSIAD Lomme-Lambersart", type: "ssiad", telephone: "01 99 00 97 03" },
      { communeId, nom: "Repas Seniors Lomme", type: "portage", telephone: "01 99 00 97 04" },
      { communeId, nom: "Présence Verte Nord", type: "teleassistance", telephone: "01 99 00 97 05" },
      { communeId, nom: "Cabinet infirmier de la Mitterie", type: "cabinet_infirmier", telephone: "01 99 00 97 06" },
    ])
    .returning();
  const [admr, asm, ssiad, repas, presenceVerte, cabinet] = structures;

  // ── Foyers ──
  const NB_FOYERS = 120;
  const NB_COUPLES = 30;
  const marais = ban.filter((a) => a[3] === "Rue du Marais" && a[1] <= 41 && !a[2]).slice(0, 9);
  const autres = faker.helpers.shuffle(ban.filter((a) => a[3] !== "Rue du Marais" && !a[2])).slice(0, NB_FOYERS - marais.length);
  // Les adresses de la rue du Marais sont réparties parmi les foyers (scénario inondation §10.4-6).
  const adressesFoyers = faker.helpers.shuffle([...marais, ...autres]);

  const foyers = await db
    .insert(s.foyers)
    .values(
      adressesFoyers.map(([banId, numero, rep, voie, lon, lat]) => {
        const appartement = chance(0.45);
        const etage = appartement ? entre(0, 7) : null;
        return {
          communeId,
          banId,
          numero,
          rep: rep || null,
          voie,
          residence: appartement && chance(0.4) ? `Résidence ${pick(["Les Tilleuls", "Le Parc", "Les Acacias", "Kiener", "Les Peupliers"])}` : null,
          batiment: appartement && chance(0.3) ? pick(["A", "B", "C"]) : null,
          entree: appartement && chance(0.2) ? String(entre(1, 3)) : null,
          appartement: appartement ? String(entre(1, 40)) : null,
          etage,
          ascenseur: appartement ? (etage ?? 0) > 2 || chance(0.4) : null,
          codeAcces: appartement && chance(0.5) ? `${entre(1000, 9999)}B` : null,
          codePostal: "59160",
          ville: "Lomme",
          lon,
          lat,
          quartier: quartierDe(lon, lat),
          typeLogement: appartement ? ("appartement" as const) : ("maison" as const),
          sousLesToits: appartement ? etage !== null && etage >= 5 && chance(0.6) : chance(0.12),
          pieceFraiche: pondere<boolean | null>([[true, 7], [false, 2], [null, 1]]),
          animaux: chance(0.2) ? pick(["Un chat", "Un petit chien", "Deux chats", "Un chien"]) : null,
        };
      }),
    )
    .returning();

  // ── Bénéficiaires ──
  type NouveauBenef = typeof s.beneficiaires.$inferInsert;
  const benefs: NouveauBenef[] = [];
  const naissance = (age: number) => {
    const d = faker.date.birthdate({ mode: "age", min: age, max: age, refDate: new Date(`${jour}T12:00:00Z`) });
    return d.toISOString().slice(0, 10);
  };
  const ageSenior = () => pondere<[number, number]>([[[62, 74], 3], [[75, 84], 4], [[85, 99], 3]]);

  const nouvellePersonne = (foyerIdx: number, opts: { sexe: "F" | "M"; nom?: string; age?: number; modeDeVie: ModeDeVie; handicap?: boolean }): NouveauBenef => {
    const [min, max] = ageSenior();
    const age = opts.age ?? (opts.handicap ? entre(34, 59) : entre(min, max));
    const prenom = faker.person.firstName(opts.sexe === "F" ? "female" : "male");
    const nom = opts.nom ?? faker.person.lastName();
    const fixe = chance(0.75);
    const mobile = !fixe || chance(0.4);
    const deplacement = pondere<Deplacement>([["seul", 45], ["canne", 22], ["deambulateur", 15], ["fauteuil", 10], ["immobilise", 4]]);
    const inscription = ajouterJours(jour, -entre(40, 2200));
    const consentementIa = chance(0.4);
    // Décret n° 2026-590 : une part des fiches vient des listes transmises par le Département ou les caisses.
    const origine = pondere<OrigineInscription>([["demande", 45], ["departement", 40], ["caisse_retraite", 15]]);
    return {
      communeId,
      foyerId: foyers[foyerIdx].id,
      civilite: opts.sexe === "F" ? "Mme" : "M.",
      nom: nom.toUpperCase(),
      nomNaissance: opts.sexe === "F" && opts.modeDeVie === "couple" && chance(0.7) ? faker.person.lastName().toUpperCase() : null,
      prenom,
      sexe: opts.sexe,
      dateNaissance: naissance(age),
      telephoneFixe: fixe ? telFixe() : null,
      telephoneMobile: mobile ? telMobile() : null,
      email: chance(0.15) ? faker.internet.email({ firstName: prenom, lastName: nom, provider: "example.org" }).toLowerCase() : null,
      langue: chance(0.05) ? pick(["Portugais", "Arabe", "Polonais"]) : "Français",
      preferenceContact: fixe ? "fixe" : "mobile",
      creneauxAppel: chance(0.3) ? pick(["Plutôt le matin", "Après 10h", "Entre 16h et 18h"]) : null,
      modeDeVie: opts.modeDeVie,
      categorie: opts.handicap ? "handicap" : "senior",
      protection: pondere([["non", 92], ["curatelle", 4], ["tutelle", 3], ["sauvegarde", 1]]),
      gir: chance(0.45) ? entre(2, 6) : null,
      deplacement,
      troublesAuditifs: chance(age > 80 ? 0.3 : 0.1),
      troublesVisuels: chance(0.15),
      troublesCognitifs: chance(age > 85 ? 0.22 : 0.07),
      handicap: opts.handicap ? pick(["Handicap moteur", "Handicap visuel", "Handicap psychique", "Sclérose en plaques"]) : null,
      appareillage: deplacement === "fauteuil" ? ["Fauteuil roulant"] : deplacement === "deambulateur" ? ["Déambulateur"] : chance(0.05) ? ["Oxygène"] : [],
      teleassistance: false,
      medecinTraitant: `Dr ${faker.person.lastName()}`,
      habitudes: chance(0.5) ? pick(HABITUDES) : null,
      centresInteret: chance(0.5) ? faker.helpers.arrayElements(INTERETS, { min: 1, max: 2 }).join(", ") : null,
      tags: chance(0.25) ? [pick(TAGS)] : [],
      infoPrioritaire: chance(0.15) ? pick(INFOS_PRIORITAIRES) : null,
      dateInscription: inscription,
      caisseRetraite: opts.handicap && age < 60 ? null : pondere([["carsat", 66], ["cnracl", 12], ["ssi", 8], ["msa", 5], ["ircantec", 5], ["autre", 4]]),
      aideCaisseRetraite: origine === "caisse_retraite" || chance(0.08),
      origineInscription: origine,
      consentementRegistre: true,
      personneInformee: true,
      consentementIa,
      consentementPartage: chance(0.6),
      consentementDate: inscription,
      consentementCanal: pick(["Formulaire papier", "Formulaire en ligne", "Téléphone"]),
      iaActivee: consentementIa && chance(0.7),
      statut: "active",
    };
  };

  for (let f = 0; f < NB_FOYERS; f++) {
    if (f < NB_COUPLES) {
      const nom = faker.person.lastName();
      benefs.push(nouvellePersonne(f, { sexe: "F", nom, modeDeVie: "couple" }));
      benefs.push(nouvellePersonne(f, { sexe: "M", nom, modeDeVie: "couple" }));
    } else {
      const handicap = f >= NB_FOYERS - 8;
      benefs.push(
        nouvellePersonne(f, {
          sexe: chance(0.68) ? "F" : "M",
          modeDeVie: chance(0.78) ? "seul" : "tiers",
          handicap,
        }),
      );
    }
  }

  // Personnages du fil rouge (§10.4) — parmi les personnes seules
  const seuls = benefs.map((b, i) => ({ b, i })).filter(({ b }) => b.modeDeVie === "seul" && b.categorie === "senior");
  const anniv90 = seuls[0].b;
  anniv90.dateNaissance = `${Number(ajouterJours(jour, 1).slice(0, 4)) - 90}${ajouterJours(jour, 1).slice(4)}`;
  anniv90.civilite = "Mme";
  anniv90.sexe = "F";
  anniv90.prenom = "Simone";
  const anniv85 = seuls[1].b;
  anniv85.dateNaissance = `${Number(ajouterJours(jour, 3).slice(0, 4)) - 85}${ajouterJours(jour, 3).slice(4)}`;
  const hospitalise = seuls[2].b;
  hospitalise.civilite = "M.";
  hospitalise.sexe = "M";
  hospitalise.prenom = "André";
  hospitalise.retourHospitalisationLe = ajouterJours(jour, -1);
  const sansTelephone = seuls.slice(3, 6).map(({ b }) => b);
  for (const b of sansTelephone) {
    b.telephoneFixe = null;
    b.telephoneMobile = null;
    b.pasDeTelephone = true;
    b.preferenceContact = "visite";
  }

  const beneficiaires = await db.insert(s.beneficiaires).values(benefs).returning();
  const foyerDe = new Map(foyers.map((f) => [f.id, f]));
  const indexSeuls = seuls.map(({ i }) => i);
  const idAnniv90 = beneficiaires[indexSeuls[0]].id;
  const idHospitalise = beneficiaires[indexSeuls[2]].id;

  // ── Cercle ──
  const professionnels = await db
    .insert(s.contacts)
    .values([
      { communeId, prenom: "Nathalie", nom: "DUPONT", structure: "Cabinet infirmier de la Mitterie", telephone: "01 99 00 96 01", ville: "Lomme" },
      { communeId, prenom: "Thomas", nom: "VERMEULEN", structure: "Infirmier libéral", telephone: "01 99 00 96 02", ville: "Lomme" },
      { communeId, prenom: "Isabelle", nom: "ROUSSEL", structure: "SSIAD Lomme-Lambersart", telephone: "01 99 00 96 03", ville: "Lambersart" },
      { communeId, prenom: "Fatima", nom: "BENSAÏD", structure: "Gardienne – Résidence Les Tilleuls", telephone: "06 39 98 96 04", ville: "Lomme" },
      { communeId, prenom: "Patrick", nom: "LEROY", structure: "Gardien – Résidence Le Parc", telephone: "06 39 98 96 05", ville: "Lomme" },
    ])
    .returning();
  const [infirmiere1, infirmiere2, infirmiereSsiad, gardienne1, gardien2] = professionnels;

  type NouveauLien = typeof s.liensCercle.$inferInsert;
  const liens: NouveauLien[] = [];
  const cercleParBenef = new Map<string, { relation: Relation; possedeCles: boolean; ville: string | null; telephone: string | null }[]>();
  const ajouterLien = (benefId: string, contact: { id: string; ville: string | null; telephone: string | null }, relation: Relation, rang: number, possedeCles: boolean, estUrgence: boolean) => {
    liens.push({ beneficiaireId: benefId, contactId: contact.id, relation, rangAppel: rang, possedeCles, estUrgence });
    const liste = cercleParBenef.get(benefId) ?? [];
    liste.push({ relation, possedeCles, ville: contact.ville, telephone: contact.telephone });
    cercleParBenef.set(benefId, liste);
  };

  const membresParFoyer = new Map<string, typeof beneficiaires>();
  for (const b of beneficiaires) membresParFoyer.set(b.foyerId, [...(membresParFoyer.get(b.foyerId) ?? []), b]);

  let foyerIndex = 0;
  for (const [foyerId, membres] of membresParFoyer) {
    foyerIndex++;
    const sansCercle = foyerIndex % 20 === 7; // quelques personnes sans aucun proche (≈ 5 %)
    if (sansCercle) continue;
    const nbFamille = pondere([[1, 4], [2, 4], [3, 2]]);
    const relations: Relation[] = membres[0].modeDeVie === "couple" ? ["enfant", "enfant", "voisin"] : ["enfant", "famille", "voisin", "ami"];
    const contactsFoyer = await db
      .insert(s.contacts)
      .values(
        Array.from({ length: nbFamille }, (_, k) => {
          const relation = relations[k] ?? "ami";
          const proche = relation === "voisin" || chance(0.6);
          return {
            communeId,
            // Le premier proche à appeler est une fille (scénario §10.4-4 : « appel de sa fille »).
            prenom: faker.person.firstName(relation === "enfant" && k === 0 ? "female" : undefined),
            nom: relation === "enfant" && k === 0 ? membres[0].nom : faker.person.lastName().toUpperCase(),
            telephone: telMobile(),
            ville: proche ? pick(VILLES_PROCHES) : pick(VILLES_LOIN),
            disponibilites: chance(0.3) ? pick(["Après 18h en semaine", "Le week-end", "Travaille de nuit"]) : null,
          };
        }),
      )
      .returning();
    contactsFoyer.forEach((c, k) => {
      const relation = (relations[k] ?? "ami") as Relation;
      for (const m of membres) ajouterLien(m.id, c, relation, k + 1, chance(relation === "enfant" ? 0.7 : 0.4), k < 2);
    });
    const foyer = foyerDe.get(foyerId)!;
    if (foyer.residence === "Résidence Les Tilleuls") for (const m of membres) ajouterLien(m.id, gardienne1, "gardien", nbFamille + 1, true, false);
    if (foyer.residence === "Résidence Le Parc") for (const m of membres) ajouterLien(m.id, gardien2, "gardien", nbFamille + 1, true, false);
  }

  // ── Prises en charge & plannings ──
  const jourJ = jourDeSemaine(jour);
  const sauf = (jours: number[]) => jours.filter((j) => j !== jourJ);
  const avecJ = (jours: number[]) => (jours.includes(jourJ) ? jours : [...jours, jourJ].sort());
  // Couverts aujourd'hui par un passage : 12 personnes (scénario §10.4-3), hors personnes du fil rouge.
  const candidatsCouverts = beneficiaires.filter((b, i) => !indexSeuls.slice(0, 12).includes(i));
  const couvertsAujourdhui = new Set(faker.helpers.arrayElements(candidatsCouverts, 12).map((b) => b.id));
  const absentsAujourdhui = new Set(
    faker.helpers
      .arrayElements(
        beneficiaires.filter((b) => !couvertsAujourdhui.has(b.id) && b.modeDeVie !== "couple" && !indexSeuls.slice(0, 12).includes(beneficiaires.indexOf(b))),
        4,
      )
      .map((b) => b.id),
  );

  type NouvellePec = typeof s.prisesEnCharge.$inferInsert;
  const pecParBenef = new Map<string, { type: TypePriseEnCharge; possedeCles: boolean; dateFin: DateISO | null; gir: number | null }[]>();
  const creneaux: { pecIndex: number; joursSemaine: number[]; heureDebut: string; heureFin: string }[] = [];
  const pecs: NouvellePec[] = [];
  const ajouterPec = (benefId: string, pec: Omit<NouvellePec, "beneficiaireId">, creneau?: { jours: number[]; debut: string; fin: string }) => {
    pecs.push({ ...pec, beneficiaireId: benefId });
    pecParBenef.set(benefId, [...(pecParBenef.get(benefId) ?? []), { type: pec.type, possedeCles: pec.possedeCles ?? false, dateFin: pec.dateFin ?? null, gir: pec.gir ?? null }]);
    if (creneau) creneaux.push({ pecIndex: pecs.length - 1, joursSemaine: creneau.jours, heureDebut: creneau.debut, heureFin: creneau.fin });
  };

  for (const b of beneficiaires) {
    const couvert = couvertsAujourdhui.has(b.id);
    const age = calculerAge(b.dateNaissance, jour);
    const dependant = (b.gir ?? 6) <= 4 || ["fauteuil", "immobilise", "deambulateur"].includes(b.deplacement ?? "");
    const aide = couvert || chance(dependant ? 0.75 : age > 80 ? 0.4 : 0.2);
    if (aide) {
      const structure = pick([admr, asm]);
      const jours = couvert ? avecJ(pick([[1, 3, 5], [2, 4], [1, 2, 3, 4, 5]])) : sauf(pick([[1, 3, 5], [2, 4], [1, 2, 3, 4, 5], [1, 4]]));
      const debut = pick(["08:30", "09:00", "10:00", "14:00"]);
      ajouterPec(
        b.id,
        {
          type: "aide_domicile",
          structureId: structure.id,
          intervenantNom: structure.nom,
          telephone: structure.telephone,
          possedeCles: chance(0.6),
          dateDebut: ajouterJours(jour, -entre(60, 900)),
          dateFin: chance(0.1) ? ajouterJours(jour, entre(10, 40)) : null,
          heuresParSemaine: jours.length * pick([1, 1.5, 2]),
        },
        { jours, debut, fin: `${String(Number(debut.slice(0, 2)) + 1).padStart(2, "0")}${debut.slice(2)}` },
      );
      if (b.gir && b.gir <= 4) {
        ajouterPec(b.id, { type: "apa", gir: b.gir, possedeCles: false, dateDebut: ajouterJours(jour, -entre(100, 900)), dateFin: chance(0.15) ? ajouterJours(jour, entre(5, 30)) : null });
      }
    }
    if (chance(0.18)) {
      ajouterPec(
        b.id,
        { type: "portage_repas", structureId: repas.id, intervenantNom: repas.nom, telephone: repas.telephone, possedeCles: false, dateDebut: ajouterJours(jour, -entre(30, 600)) },
        { jours: couvert ? avecJ([1, 2, 3, 4, 5]) : sauf([1, 2, 3, 4, 5]), debut: "11:30", fin: "12:30" },
      );
    }
    if (chance(dependant ? 0.35 : 0.08)) {
      const viaSsiad = chance(0.5);
      const infirmiere = viaSsiad ? infirmiereSsiad : pick([infirmiere1, infirmiere2]);
      ajouterPec(
        b.id,
        {
          type: viaSsiad ? "ssiad" : "soins_infirmiers",
          structureId: viaSsiad ? ssiad.id : cabinet.id,
          intervenantNom: `${infirmiere.prenom} ${infirmiere.nom}`,
          telephone: infirmiere.telephone,
          possedeCles: chance(0.5),
          contactId: infirmiere.id,
          dateDebut: ajouterJours(jour, -entre(20, 400)),
        },
        { jours: couvert ? avecJ([1, 4]) : sauf(pick([[1, 4], [2, 5], [1, 2, 3, 4, 5, 6]])), debut: "07:30", fin: "08:00" },
      );
      ajouterLien(b.id, infirmiere, "infirmiere", 9, false, false);
    }
    if (chance(0.25)) {
      ajouterPec(b.id, { type: "teleassistance", structureId: presenceVerte.id, intervenantNom: presenceVerte.nom, telephone: presenceVerte.telephone, possedeCles: false });
    }
  }
  if (liens.length) await db.insert(s.liensCercle).values(liens);
  const pecInserees = pecs.length ? await db.insert(s.prisesEnCharge).values(pecs).returning() : [];
  if (creneaux.length) {
    await db.insert(s.creneauxPassage).values(
      creneaux.map((c) => ({ priseEnChargeId: pecInserees[c.pecIndex].id, joursSemaine: c.joursSemaine, heureDebut: c.heureDebut, heureFin: c.heureFin })),
    );
  }
  // Téléassistance renseignée sur la fiche
  const teleassistes = pecs.filter((p) => p.type === "teleassistance").map((p) => p.beneficiaireId);
  if (teleassistes.length) {
    await db.execute(
      sql`UPDATE beneficiaires SET teleassistance = true, teleassistance_fournisseur = 'Présence Verte Nord' WHERE id IN (${sql.join(teleassistes.map((id) => sql`${id}`), sql`, `)})`,
    );
  }

  // ── Indisponibilités ──
  type NouvelleIndispo = typeof s.indisponibilites.$inferInsert;
  const indispos: NouvelleIndispo[] = [];
  for (const id of absentsAujourdhui) {
    indispos.push({
      beneficiaireId: id,
      type: "vacances",
      debut: ajouterJours(jour, -entre(1, 6)),
      fin: ajouterJours(jour, entre(3, 12)),
      joignabilite: pick(["Joignable sur le mobile de sa fille", "Chez son fils à Arras", "En séjour à la mer avec le club"]),
      source: "Appel de la famille",
      creePar: julie.id,
    });
  }
  indispos.push({
    beneficiaireId: idHospitalise,
    type: "hospitalisation",
    debut: ajouterJours(jour, -12),
    fin: ajouterJours(jour, -1),
    joignabilite: "Hôpital Saint-Philibert, chambre 214",
    source: "Appel de l'infirmière",
    creePar: karim.id,
  });
  for (const b of faker.helpers.arrayElements(beneficiaires, 10)) {
    if (absentsAujourdhui.has(b.id) || b.id === idHospitalise) continue;
    const futur = chance(0.4);
    const debut = futur ? ajouterJours(jour, entre(5, 40)) : ajouterJours(jour, -entre(30, 300));
    indispos.push({
      beneficiaireId: b.id,
      type: pick(["vacances", "sejour_proche", "hospitalisation"]),
      debut,
      fin: ajouterJours(debut, entre(5, 20)),
      source: pick(["Appel de la personne", "Formulaire d'inscription", "Bénévole"]),
    });
  }
  await db.insert(s.indisponibilites).values(indispos);

  // ── Scores (RG-01) ──
  for (const b of beneficiaires) {
    const foyer = foyerDe.get(b.foyerId)!;
    const r = calculerScore(
      extraireFaits({
        beneficiaire: { ...b, retourHospitalisationLe: b.retourHospitalisationLe },
        foyer,
        cercle: cercleParBenef.get(b.id) ?? [],
        prisesEnCharge: pecParBenef.get(b.id) ?? [],
        aujourdhui: jour,
      }),
    );
    b.score = r.score;
    b.niveauPriorite = r.niveau;
    await db.execute(sql`UPDATE beneficiaires SET score = ${r.score}, niveau_priorite = ${r.niveau} WHERE id = ${b.id}`);
  }

  // ── Interactions sur 12 mois ──
  type NouvelleInteraction = typeof s.interactions.$inferInsert;
  const interactions: NouvelleInteraction[] = [];
  for (const b of beneficiaires) {
    const delaiDernier = chance(0.15) ? entre(190, 330) : entre(3, 120);
    const nb = entre(2, 7);
    for (let k = 0; k < nb; k++) {
      const type = pondere<TypeInteraction>([["appel_sortant", 60], ["appel_entrant", 14], ["visite", 12], ["sms", 7], ["courrier", 7]]);
      const date = ajouterJours(jour, -(delaiDernier + k * entre(20, 60)));
      if (date < b.dateInscription) break;
      const estAppel = type === "appel_sortant" || type === "appel_entrant";
      interactions.push({
        communeId,
        beneficiaireId: b.id,
        type,
        survenueLe: instant(date, pick(["09:15", "10:30", "11:00", "14:20", "15:45", "16:30"])),
        dureeMinutes: estAppel ? entre(3, 15) : type === "visite" ? entre(20, 45) : null,
        auteurId: pick(agents).id,
        resultat: estAppel ? pondere<StatutCible>([["joint_ras", 85], ["joint_besoin", 8], ["messagerie", 7]]) : null,
        compteRendu: pick(COMPTES_RENDUS[type] ?? ["RAS."]),
      });
    }
  }

  // ── Canicule passée (juillet 2026) ──
  const debutCanicule = "2026-07-06";
  const vagues = [0, 1, 2, 3].map((k) => ajouterJours(debutCanicule, k));
  const [alerte] = await db
    .insert(s.alertes)
    .values({
      communeId,
      type: "canicule",
      niveau: "rouge",
      debut: debutCanicule,
      finPrevue: vagues[3],
      perimetre: "Toute la commune",
      message: "Vigilance canicule rouge : appel quotidien de toutes les personnes inscrites.",
      statut: "cloturee",
      declencheePar: admin.id,
      clotureeLe: instant(ajouterJours(vagues[3], 1), "18:00"),
    })
    .returning();
  const inscritsAvant = beneficiaires.filter((b) => b.dateInscription <= debutCanicule);
  const [campagne] = await db
    .insert(s.campagnes)
    .values({
      communeId,
      alerteId: alerte.id,
      nom: "Canicule juillet 2026",
      type: "canicule",
      script: SCRIPT_CANICULE,
      frequence: "quotidienne",
      canal: "mixte",
      relance: RELANCE_PAR_DEFAUT,
      source: { type: "tous" },
      beneficiaireIds: inscritsAvant.map((b) => b.id),
      equipe: users.map((u) => u.id),
      statut: "cloturee",
      dateDebut: debutCanicule,
      dateFin: vagues[3],
    })
    .returning();

  type NouvelleCible = typeof s.ciblesCampagne.$inferInsert;
  const cibles: NouvelleCible[] = [];
  const appelants = users.filter((u) => u.role !== "admin");
  const eligiblesIa = new Set(inscritsAvant.filter((b) => b.iaActivee && b.niveauPriorite !== "P1").map((b) => b.id));
  for (const [v, vague] of vagues.entries()) {
    inscritsAvant.forEach((b, i) => {
      const ia = eligiblesIa.has(b.id) && v === 0;
      const statut = pondere<StatutCible>([
        ["joint_ras", 70],
        ["couvert_passage", 10],
        ["joint_besoin", 7],
        ["couvert_proche", 5],
        ["absent", 4],
        ["non_joint_a_traiter", 2],
        ["numero_invalide", 1],
        ["danger", v === 1 && i % 40 === 3 ? 30 : 0.1],
      ]);
      const besoins: Besoin[] = statut === "joint_besoin" ? [pick<Besoin>(["eau", "courses", "medicaments", "chaleur"])] : [];
      cibles.push({
        campagneId: campagne.id,
        beneficiaireId: b.id,
        vagueDate: vague,
        assigneA: statut === "couvert_passage" || statut === "absent" ? null : appelants[i % appelants.length].id,
        canal: ia ? "ia" : "humain",
        statut,
        nbTentatives: statut === "non_joint_a_traiter" ? 3 : statut.startsWith("couvert") || statut === "absent" ? 0 : entre(1, 2),
        couverture: statut === "couvert_passage" ? "passage" : statut === "absent" ? "absence" : statut === "couvert_proche" ? "proche" : statut.startsWith("joint") ? "appel" : null,
        exclue: statut === "couvert_passage" || statut === "absent",
        motifExclusion: statut === "couvert_passage" ? "Couvert par passage d'aide à domicile" : statut === "absent" ? "Absent : vacances" : null,
        besoins,
        niveauRisque: ia ? (statut === "joint_ras" ? "vert" : "orange") : null,
        note: statut === "danger" ? "Malaise, pompiers appelés par le bénévole." : statut === "joint_besoin" ? "Livraison d'eau organisée." : null,
      });
      if (statut.startsWith("joint") || statut === "danger") {
        interactions.push({
          communeId,
          beneficiaireId: b.id,
          type: ia ? "appel_ia" : "appel_sortant",
          survenueLe: instant(vague, pick(["09:20", "10:05", "11:40", "14:10", "15:30"])),
          dureeMinutes: entre(3, 9),
          auteurId: ia ? null : appelants[i % appelants.length].id,
          resultat: statut,
          compteRendu: statut === "danger" ? "Malaise signalé, pompiers appelés." : statut === "joint_besoin" ? "A besoin d'eau, livraison organisée par le CCAS." : "Va bien, applique les recommandations.",
          besoins,
          campagneId: campagne.id,
        });
      }
    });
  }

  // Appels IA (maquette, E11 mis de côté) : 3 transcriptions pré-écrites dont 1 escalade « vertiges ».
  const ciblesIa = cibles.filter((c) => c.canal === "ia");
  const transcriptions: { statut: StatutCible; risque: "vert" | "orange" | "rouge"; detail: s.DetailIa }[] = [
    {
      statut: "escalade_humain",
      risque: "rouge",
      detail: {
        transcription: [
          { locuteur: "ia", texte: "Bonjour, je suis l'assistant automatique de la Maison des seniors de Lomme. Je vous appelle car le Plan Alerte et Urgence canicule est déclenché. Comment allez-vous ?" },
          { locuteur: "personne", texte: "Oh, pas terrible… j'ai des vertiges depuis ce matin." },
          { locuteur: "ia", texte: "Je suis désolé. Avez-vous bu de l'eau aujourd'hui ?" },
          { locuteur: "personne", texte: "Un peu… je ne sais plus." },
          { locuteur: "ia", texte: "Je vais demander à une personne de la Maison des seniors de vous rappeler très rapidement. Si vous vous sentez plus mal, appelez le 15." },
        ],
        resume: "La personne dit avoir des vertiges depuis le matin et ne sait plus si elle a bu. Confusion légère.",
        reponses: { q1: "non", q2: "non communiqué", q3: "non" },
        risque: "rouge",
        justification: "Vertiges et confusion par forte chaleur : escalade vers un humain.",
      },
    },
    {
      statut: "joint_ras",
      risque: "vert",
      detail: {
        transcription: [
          { locuteur: "ia", texte: "Bonjour, je suis l'assistant automatique de la Maison des seniors de Lomme. Comment allez-vous ?" },
          { locuteur: "personne", texte: "Très bien, merci. Je reste au frais, les volets sont fermés." },
          { locuteur: "ia", texte: "Parfait. Recevez-vous des visites ou des appels de vos proches ?" },
          { locuteur: "personne", texte: "Oui, ma fille passe tous les soirs." },
        ],
        resume: "Va bien, applique les recommandations, visite quotidienne de sa fille.",
        reponses: { q1: "oui", q2: "oui", q3: "oui" },
        risque: "vert",
        justification: "Aucun signe d'alerte.",
      },
    },
    {
      statut: "joint_besoin",
      risque: "orange",
      detail: {
        transcription: [
          { locuteur: "ia", texte: "Bonjour, je suis l'assistant automatique de la Maison des seniors de Lomme. Comment allez-vous ?" },
          { locuteur: "personne", texte: "Ça va, mais je n'ai plus d'eau en bouteille et je ne peux pas porter les packs." },
          { locuteur: "ia", texte: "Je transmets votre demande à la Maison des seniors, quelqu'un vous recontactera aujourd'hui." },
        ],
        resume: "Va bien mais n'a plus d'eau en bouteille ; ne peut pas porter de charges.",
        reponses: { q1: "oui", q2: "oui", q3: "oui" },
        risque: "orange",
        justification: "Besoin matériel (eau) sans signe de malaise.",
      },
    },
  ];
  transcriptions.forEach((t, k) => {
    const cible = ciblesIa[k];
    if (!cible) return;
    cible.statut = t.statut;
    cible.niveauRisque = t.risque;
    cible.note = t.detail.resume;
    if (t.statut === "joint_besoin") cible.besoins = ["eau"];
    interactions.push({
      communeId,
      beneficiaireId: cible.beneficiaireId!,
      type: "appel_ia",
      survenueLe: instant(cible.vagueDate!, "10:12"),
      dureeMinutes: 4,
      resultat: t.statut,
      compteRendu: t.detail.resume,
      besoins: t.statut === "joint_besoin" ? ["eau"] : [],
      campagneId: campagne.id,
      detailIa: t.detail,
    });
  });
  for (let i = 0; i < cibles.length; i += 500) await db.insert(s.ciblesCampagne).values(cibles.slice(i, i + 500));
  for (let i = 0; i < interactions.length; i += 500) await db.insert(s.interactions).values(interactions.slice(i, i + 500));

  // ── Rappels (E4) ──
  const benefHospitalise = beneficiaires.find((b) => b.id === idHospitalise)!;
  const auHasard = () => pick(beneficiaires.filter((b) => b.statut === "active"));
  const nomComplet = (b: (typeof beneficiaires)[number]) => `${b.civilite} ${b.prenom} ${b.nom}`;
  const rappelsSeed: (typeof s.rappels.$inferInsert)[] = [
    {
      communeId,
      beneficiaireId: idHospitalise,
      type: "retour_absence",
      objet: `Vérifier le retour d'hospitalisation de ${nomComplet(benefHospitalise)}`,
      echeance: jour,
      assigneA: julie.id,
      creePar: karim.id,
      urgent: true,
    },
  ];
  for (const [k, assigne] of [julie, julie, karim, julie, karim].entries()) {
    const b = auHasard();
    rappelsSeed.push({
      communeId,
      beneficiaireId: b.id,
      type: "manuel",
      objet: pick([
        `Rappeler ${nomComplet(b)} pour le colis de fin d'année`,
        `Appel de convivialité avec ${nomComplet(b)}`,
        `Vérifier le numéro de la fille de ${nomComplet(b)}`,
        `Proposer le portage de repas à ${nomComplet(b)}`,
      ]),
      echeance: k < 2 ? jour : k < 4 ? ajouterJours(jour, -entre(1, 5)) : ajouterJours(jour, entre(2, 10)),
      assigneA: assigne.id,
      creePar: admin.id,
    });
  }
  await db.insert(s.rappels).values(rappelsSeed);

  // ── Inscriptions en ligne à valider (E7) ──
  await creerInscriptionsEnAttente(db, { communeId, jour, ban });

  // ── Notifications ──
  await db.insert(s.notifications).values([
    { communeId, destinataireId: admin.id, type: "inscription", titre: "3 nouvelles inscriptions à valider", lien: "/inscriptions" },
    { communeId, destinataireId: julie.id, type: "rappel", titre: `Retour d'hospitalisation à vérifier : ${nomComplet(benefHospitalise)}`, lien: `/beneficiaires/${idHospitalise}` },
    { communeId, destinataireId: julie.id, type: "info", titre: `Anniversaire des 90 ans de ${nomComplet(beneficiaires.find((b) => b.id === idAnniv90)!)} demain`, lien: `/beneficiaires/${idAnniv90}` },
  ]);

  // ── Extensions des modules (listes, statistiques…) ──
  const ctx: ContexteSeed = { communeId, jour, utilisateurs: users, beneficiaires, campagneCaniculeId: campagne.id };
  for (const extension of EXTENSIONS_SEED) await extension(db, ctx);

  return { communeId, beneficiaires: beneficiaires.length, foyers: foyers.length };
}

/** Trois inscriptions arrivées en ligne : chacune crée des fiches « en attente de validation » (E7-US3). */
async function creerInscriptionsEnAttente(db: Db, { communeId, jour, ban }: { communeId: string; jour: DateISO; ban: LigneBan[] }) {
  const adresse = (voie: string) => ban.find((a) => a[3] === voie && !a[2]) ?? ban[0];
  const demandes = [
    {
      soumisLe: instant(ajouterJours(jour, -1), "17:42"),
      voie: "Avenue de Dunkerque",
      etage: 6,
      sousLesToits: true,
      personnes: [{ civilite: "Mme" as const, sexe: "F" as const, prenom: "Germaine", nom: "VASSEUR", age: 88, deplacement: "fauteuil" as Deplacement }],
      modeDeVie: "seul" as ModeDeVie,
      remplisseur: "tiers",
      contact: { prenom: "Martine", nom: "VASSEUR", relation: "enfant" as Relation, ville: "Lille", possedeCles: false },
    },
    {
      soumisLe: instant(ajouterJours(jour, -2), "10:05"),
      voie: "Rue Jean Jaurés",
      etage: 0,
      sousLesToits: false,
      personnes: [
        { civilite: "Mme" as const, sexe: "F" as const, prenom: "Monique", nom: "LEFEBVRE", age: 79, deplacement: "canne" as Deplacement },
        { civilite: "M." as const, sexe: "M" as const, prenom: "Bernard", nom: "LEFEBVRE", age: 82, deplacement: "seul" as Deplacement },
      ],
      modeDeVie: "couple" as ModeDeVie,
      remplisseur: "moi",
      contact: { prenom: "Sébastien", nom: "LEFEBVRE", relation: "enfant" as Relation, ville: "Lomme", possedeCles: true },
    },
    {
      soumisLe: instant(jour, "08:31"),
      voie: "Rue Victor Hugo",
      etage: 2,
      sousLesToits: false,
      personnes: [{ civilite: "M." as const, sexe: "M" as const, prenom: "Roger", nom: "CARON", age: 72, deplacement: "seul" as Deplacement }],
      modeDeVie: "seul" as ModeDeVie,
      remplisseur: "tiers",
      contact: { prenom: "Claire", nom: "CARON", relation: "enfant" as Relation, ville: "Paris", possedeCles: false },
    },
  ];

  for (const d of demandes) {
    const [banId, numero, , voie, lon, lat] = adresse(d.voie);
    const [foyer] = await db
      .insert(s.foyers)
      .values({ communeId, banId, numero, voie, codePostal: "59160", ville: "Lomme", lon, lat, quartier: quartierDe(lon, lat), etage: d.etage, typeLogement: "appartement", ascenseur: d.etage > 2, sousLesToits: d.sousLesToits, pieceFraiche: !d.sousLesToits })
      .returning();
    const [contact] = await db
      .insert(s.contacts)
      .values({ communeId, prenom: d.contact.prenom, nom: d.contact.nom, telephone: telMobile(), ville: d.contact.ville })
      .returning();

    const ids: string[] = [];
    for (const p of d.personnes) {
      const dateNaissance = `${Number(jour.slice(0, 4)) - p.age}-0${entre(1, 9)}-1${entre(0, 9)}`;
      const r = calculerScore(
        extraireFaits({
          beneficiaire: { dateNaissance, modeDeVie: d.modeDeVie, deplacement: p.deplacement, protection: "non", troublesCognitifs: false, pasDeTelephone: false, retourHospitalisationLe: null, gir: null, aideCaisseRetraite: false },
          foyer: { sousLesToits: d.sousLesToits, pieceFraiche: !d.sousLesToits, etage: d.etage, typeLogement: "appartement" },
          cercle: [{ relation: d.contact.relation, possedeCles: d.contact.possedeCles, ville: d.contact.ville, telephone: contact.telephone }],
          prisesEnCharge: [],
          aujourdhui: jour,
        }),
      );
      const [b] = await db
        .insert(s.beneficiaires)
        .values({
          communeId,
          foyerId: foyer.id,
          civilite: p.civilite,
          sexe: p.sexe,
          prenom: p.prenom,
          nom: p.nom,
          dateNaissance,
          telephoneFixe: telFixe(),
          modeDeVie: d.modeDeVie,
          deplacement: p.deplacement,
          dateInscription: d.soumisLe.toISOString().slice(0, 10),
          consentementDate: d.soumisLe.toISOString().slice(0, 10),
          consentementCanal: "Formulaire en ligne",
          personneInformee: true,
          statut: "en_attente",
          score: r.score,
          niveauPriorite: r.niveau,
        })
        .returning();
      ids.push(b.id);
      await db.insert(s.liensCercle).values({ beneficiaireId: b.id, contactId: contact.id, relation: d.contact.relation, rangAppel: 1, possedeCles: d.contact.possedeCles, estUrgence: true });
    }

    await db.insert(s.inscriptions).values({
      communeId,
      soumisLe: d.soumisLe,
      beneficiaireIds: ids,
      reponses: {
        remplisseur: d.remplisseur,
        personneInformee: true,
        personnes: d.personnes.map((p) => ({ civilite: p.civilite, nom: p.nom, prenom: p.prenom })),
        adresse: { banId, numero, voie, lon, lat, etage: d.etage },
        modeDeVie: d.modeDeVie,
        contactsUrgence: [{ ...d.contact, telephone: contact.telephone }],
        sousLesToits: d.sousLesToits,
        consentement: true,
      },
    });
  }
}
