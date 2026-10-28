/**
 * `pnpm tsx scripts/generer-exemple-import.ts` — génère `public/exemple-import-registre.xlsx` (E15) :
 * un registre « canicule » tel qu'on le trouve en mairie (titre au-dessus du tableau, colonnes abrégées,
 * dates et téléphones saisis de façons diverses), avec quelques erreurs volontaires et 2 doublons du seed.
 *
 * Les doublons sont lus dans la base de démo si elle est accessible (les dates de naissance du seed sont
 * relatives au jour du seed) ; sinon, des valeurs de repli sont utilisées.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import * as XLSX from "xlsx";

type Cellule = string | number | Date;

const ENTETES = [
  "N°",
  "Civ.",
  "NOM",
  "Prénom",
  "DDN",
  "Adresse",
  "Tél",
  "Portable",
  "Vit seul(e) ?",
  "Mobilité",
  "Téléalarme",
  "Personne à prévenir",
  "Tél. contact",
  "Lien",
  "Observations",
  "Agent référent",
];

const d = (iso: string) => new Date(`${iso}T12:00:00`);

async function doublonsDuSeed(): Promise<{ identite: Cellule[]; telephone: Cellule[] }> {
  let identite = { civilite: "Mme", nom: "MENARD", prenom: "Arnaude", ddn: "06/06/1937", tel: "01 99 00 00 02" };
  let telephone = { civilite: "M.", nom: "MENARD", prenom: "Agathon", tel: "06 39 98 00 00" };
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {}, connect_timeout: 3 });
    try {
      const lignes = await sql<{ civilite: string; nom: string; prenom: string; date_naissance: string; telephone_fixe: string | null; telephone_mobile: string | null }[]>`
        select civilite, nom, prenom, date_naissance::text, telephone_fixe, telephone_mobile
        from beneficiaires where statut = 'active' and telephone_mobile is not null order by created_at limit 2`;
      if (lignes.length === 2) {
        const [a, b] = lignes;
        identite = { civilite: a.civilite, nom: a.nom, prenom: a.prenom, ddn: a.date_naissance.split("-").reverse().join("/"), tel: "" };
        telephone = { civilite: b.civilite, nom: `${b.nom}-DURIEZ`, prenom: b.prenom, tel: b.telephone_mobile ?? "" };
      }
    } catch {
      console.warn("Base de démo inaccessible : doublons de repli utilisés.");
    } finally {
      await sql.end();
    }
  }
  return {
    // Même nom et même date de naissance qu'une fiche existante (casse différente).
    identite: [identite.civilite === "Mme" ? "Madame" : "Monsieur", identite.nom.toLowerCase(), identite.prenom, identite.ddn, "3 rue de la Mitterie", identite.tel, "", "oui", "canne", "non", "", "", "", "Inscrite en 2019", "Julie"],
    // Nom d'usage différent mais même numéro de portable qu'une fiche existante.
    telephone: [telephone.civilite, telephone.nom, telephone.prenom, "15/02/1946", "5 place de la République", "", telephone.tel.replace(/\s/g, "."), "oui", "seul", "", "", "", "", "", "Karim"],
  };
}

async function main() {
  const doublons = await doublonsDuSeed();
  // Personnes fictives ; numéros dans les plages réservées par l'ARCEP (01 99 00 xx xx / 06 39 98 xx xx).
  const lignes: Cellule[][] = [
    ["Mme", "LEROUX", "Jeannine", d("1936-04-12"), "4 rue Victor Hugo", "01 99 00 81 01", "", "OUI", "déamb.", "oui", "LEROUX Pascal", "06 39 98 81 01", "Fils", "Vit au 3e sans ascenseur", "Julie"],
    ["M.", "BRASSART", "Henri", "12/03/1938", "265 av. de Dunkerque", 199008102, "", "oui", "fauteuil", "x", "BRASSART Claire", "0639988102", "fille", "Diabétique, insuline le matin", "Karim"],
    ["Mme", "DEBRUYNE", "Odette", "5 mars 1937", "1 rue Jean Jaurés", "", "06.39.98.81.03", "non", "FR", "", "Mme Lemaire (voisine)", "06 39 98 81 04", "Voisine", "", "Julie"],
    ["M.", "DEBRUYNE", "Marcel", "3-9-35", "1 rue Jean Jaurés", "", "06 39 98 81 05", "non", "Canne", "non", "", "", "", "Ancien combattant", "Julie"],
    ["Mme", "VERMEERSCH", "Paulette", d("1931-11-27"), "6, rue de la Mitterie", "01.99.00.81.06", "", "oui", "grabataire", "oui", "VERMEERSCH Alain", "+33 6 39 98 81 06", "neveu", "Passage infirmière tous les jours", "Karim"],
    ["Mme", "LECLERCQ", "Simone", "31/02/1941", "2 rue Roger Marcon", "01 99 00 81 07", "", "oui", "seul", "non", "", "", "", "", "Julie"],
    ["M.", "HOUZÉ", "Robert", "17/08/1940", "3 rue du Marais", "03 20 5", "", "oui", "", "non", "HOUZE Nathalie", "06 39 98 81 08", "Fille", "Numéro à vérifier", "Karim"],
    ["Mme", "DELATTRE", "Lucienne", "", "9 rue du Marais", "01 99 00 81 09", "", "oui", "canne", "", "", "", "", "Date de naissance inconnue", "Julie"],
    ["Mme", "CARLIER", "Yvette", "08/01/1934", "12 rue des Lilas Fleuries", "01 99 00 81 10", "", "oui", "voir avec la famille", "non", "CARLIER Bruno", "06 39 98 81 10", "fils", "", "Karim"],
    ["M.", "DESMET", "André", d("1944-02-19"), "8 rue Victor Hugo", "", "06 39 98 81 11", "non", "seul", "non", "DESMET Martine", "06 39 98 81 12", "épouse", "", "Julie"],
    ["Mme", "DESMET", "Martine", d("1947-06-03"), "8 rue Victor Hugo", "", "06 39 98 81 12", "non", "seul", "non", "DESMET André", "06 39 98 81 11", "époux", "", "Julie"],
    ["Mme", "POTTIER", "Germaine", "21.10.1929", "4 place de la République", "01 99 00 81 13", "", "OUI", "Déambulateur", "Présence Verte", "POTTIER Luc", "06 39 98 81 13", "petit-fils", "Malentendante : parler fort", "Karim"],
    ["M.", "LAMBIN", "Jules", "02/12/1939", "1 rue de l'Egalité", "", "", "oui", "canne", "oui", "", "", "", "Pas de téléphone : passer le voir", "Julie"],
    ["Mme", "WAMBRE", "Rolande", d("1938-07-14"), "267 avenue de Dunkerque", "01 99 00 81 14", "", "oui", "seul", "non", "WAMBRE Éric", "06 39 98 81 14", "Fils", "", "Karim"],
    ["Madame", "FLAMENT", "Suzanne", "14/05/1933", "5 rue Victor Hugo", "01 99 00 81 15", "", "oui", "fauteuil roulant", "oui", "Curatelle UDAF", "01 99 00 81 16", "Curateur", "Curatelle renforcée", "Julie"],
    ["M.", "CATTEAU", "Gérard", "1/1/42", "3 rue Roger Marcon", "01 99 00 81 17", "", "non", "seul", "non", "CATTEAU Sylvie", "06 39 98 81 17", "fille", "", "Karim"],
    ["Mme", "DUFOUR", "Marie-Thérèse", "19/09/1935", "7 rue de la Mitterie", "01 99 00 81 18", "06 39 98 81 18", "oui", "canne", "x", "", "", "", "Chat à nourrir si absence", "Julie"],
    ["Mme", "LEFEBVRE", "Ginette", "23/04/1930", "11 rue du Marais", "01 99 00 81 19", "", "oui", "alitée", "oui", "LEFEBVRE Patrick", "06 39 98 81 19", "fils", "HAD en cours", "Karim"],
    ["M.", "BOUTRY", "Fernand", "30/06/1937", "2 place de la République", "", "06 39 98 81 20", "oui", "seul", "non", "Mme Petit", "06 39 98 81 21", "voisine", "", "Julie"],
    ["Mme", "SAINT-MAXENT", "Huguette", d("1940-10-08"), "3 rue de l'Egalité", "01 99 00 81 22", "", "oui", "déambulateur", "non", "SAINT-MAXENT Jean", "06 39 98 81 22", "frère", "", "Karim"],
    ["M.", "PRUVOST", "Lucien", "12/12/1936", "13 rue du Marais", "01 99 00 81 23", "", "oui", "canne", "oui", "PRUVOST Anne", "06 39 98 81 23", "fille", "Sourd d'une oreille", "Julie"],
    ["Mme", "LEROUX", "Jeannine", "12/04/1936", "4 rue Victor Hugo", "01 99 00 81 01", "", "OUI", "déamb.", "oui", "", "", "", "Saisie en double", "Karim"],
    doublons.identite,
    doublons.telephone,
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Mme", "DEVAUX", "Raymonde", "08/03/1932", "6 rue Victor Hugo", "01 99 00 81 24", "", "oui", "FR", "oui", "DEVAUX Thierry", "06 39 98 81 24", "Fils", "", "Julie"],
  ].map((l, i) => (l.length === ENTETES.length ? l : [i + 1, ...l]));

  const donnees: Cellule[][] = [
    ["CCAS DE LOMME — REGISTRE PLAN CANICULE / GRAND FROID"],
    ["Mise à jour : 12/06/2025 — document interne, ne pas diffuser"],
    [],
    ENTETES,
    ...lignes,
  ];
  const ws = XLSX.utils.aoa_to_sheet(donnees, { cellDates: true, dateNF: "dd/mm/yyyy" });
  // Les dates Excel sont affichées au format français.
  for (const adresse of Object.keys(ws)) {
    const c = ws[adresse] as XLSX.CellObject | undefined;
    if (c && typeof c === "object" && "t" in c && c.t === "d") c.z = "dd/mm/yyyy";
  }
  ws["!cols"] = ENTETES.map((h) => ({ wch: Math.max(8, h.length + 4) }));
  ws["!cols"][5] = { wch: 28 };
  ws["!cols"][11] = { wch: 22 };
  ws["!cols"][14] = { wch: 32 };

  const listeAgents = XLSX.utils.aoa_to_sheet([["Agent", "Secteur"], ["Julie", "Bourg, Mitterie"], ["Karim", "Délivrance, Marais"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registre 2025");
  XLSX.utils.book_append_sheet(wb, listeAgents, "Agents");
  const sortie = join(process.cwd(), "public", "exemple-import-registre.xlsx");
  writeFileSync(sortie, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`Fichier d'exemple généré : ${sortie} (${lignes.length} lignes)`);
}

main();
