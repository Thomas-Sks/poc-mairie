/**
 * Normalisation des saisies « humaines » (formulaire public, fichiers Excel de mairie) :
 * dates françaises, numéros de téléphone, noms. Fonctions pures.
 */
import type { DateISO } from "./dates";

/** Minuscule, sans accents ni ponctuation superflue, espaces réduits. */
export function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function cleTexte(texte: string): string {
  return sansAccents(texte)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MOIS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

function dateValide(an: number, mois: number, jour: number): DateISO | null {
  if (!Number.isInteger(an) || !Number.isInteger(mois) || !Number.isInteger(jour)) return null;
  if (an < 1880 || an > 2100 || mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(an, mois - 1, jour));
  if (d.getUTCFullYear() !== an || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null;
  return `${String(an).padStart(4, "0")}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Année sur 2 chiffres : dans un registre de personnes vulnérables, « 38 » signifie 1938. */
function anneeComplete(an: number, anneeReference: number): number {
  if (an >= 100) return an;
  const siecle = Math.floor(anneeReference / 100) * 100;
  return siecle + an > anneeReference ? siecle - 100 + an : siecle + an;
}

/** Numéro de série Excel (jours depuis le 30/12/1899) → date ISO. */
export function dateDepuisSerieExcel(serie: number): DateISO | null {
  if (!Number.isFinite(serie) || serie < 1 || serie > 80_000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Lit une date telle qu'on la trouve dans un formulaire ou un tableur de mairie :
 * « 12/03/1938 », « 12-3-38 », « 12.03.1938 », « 1938-03-12 », « 12 mars 1938 », numéro de série Excel.
 * Renvoie `null` si la date est absente ou invalide (ex. 31/02/1940).
 */
export function normaliserDate(valeur: unknown, anneeReference = new Date().getFullYear()): DateISO | null {
  if (valeur === null || valeur === undefined) return null;
  if (valeur instanceof Date) {
    return Number.isNaN(valeur.getTime()) ? null : dateValide(valeur.getFullYear(), valeur.getMonth() + 1, valeur.getDate());
  }
  if (typeof valeur === "number") return dateDepuisSerieExcel(valeur);
  const texte = String(valeur).trim();
  if (!texte) return null;

  let m = texte.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return dateValide(Number(m[1]), Number(m[2]), Number(m[3]));

  m = texte.match(/^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{2}|\d{4})$/);
  if (m) return dateValide(anneeComplete(Number(m[3]), anneeReference), Number(m[2]), Number(m[1]));

  m = texte.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return dateValide(Number(m[3]), Number(m[2]), Number(m[1]));

  m = cleTexte(texte).match(/^(?:le )?(\d{1,2}|1er) ([a-z]+) (\d{2}|\d{4})$/);
  if (m && MOIS[m[2]] !== undefined) {
    return dateValide(anneeComplete(Number(m[3]), anneeReference), MOIS[m[2]], m[1] === "1er" ? 1 : Number(m[1]));
  }

  if (/^\d{4,5}(\.\d+)?$/.test(texte)) return dateDepuisSerieExcel(Number(texte));
  return null;
}

/** « 1938-03-12 » → « 12/03/1938 » (saisie). */
export function dateIsoVersSaisie(date: DateISO): string {
  const [an, mois, jour] = date.split("-");
  return `${jour}/${mois}/${an}`;
}

/**
 * Normalise un numéro français au format « 06 12 34 56 78 ».
 * Accepte espaces, points, tirets, préfixes +33 / 0033, et le zéro initial perdu par Excel (612345678).
 * Renvoie `null` si le numéro est mal formé.
 */
export function normaliserTelephone(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null;
  let chiffres = String(valeur).replace(/\(0\)/g, "").replace(/[^\d+]/g, "");
  if (chiffres.startsWith("+33")) chiffres = `0${chiffres.slice(3)}`;
  else if (chiffres.startsWith("0033")) chiffres = `0${chiffres.slice(4)}`;
  chiffres = chiffres.replace(/\+/g, "");
  if (chiffres.length === 9 && /^[1-9]/.test(chiffres)) chiffres = `0${chiffres}`;
  if (!/^0[1-9]\d{8}$/.test(chiffres)) return null;
  return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ");
}

/** Chiffres seuls (comparaison de numéros). */
export function chiffresTelephone(valeur: string | null | undefined): string | null {
  const n = normaliserTelephone(valeur);
  return n ? n.replace(/\s/g, "") : null;
}

export function estMobile(telephone: string): boolean {
  return /^0[67]/.test(telephone.replace(/\s/g, ""));
}

/** NOM en majuscules, prénom avec initiales en capitales (« jean-pierre » → « Jean-Pierre »). */
export function formaterNom(nom: string): string {
  return nom.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

export function formaterPrenom(prenom: string): string {
  return prenom
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase("fr-FR"));
}
