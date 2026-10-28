/**
 * Maquette des appels IA (E11, MIS DE CÔTÉ) : aucune logique réelle.
 * Pour qu'une nouvelle campagne mixte montre la vision, on attribue de façon déterministe
 * des résultats fictifs figés aux cibles IA. Le premier est toujours l'escalade « vertiges ».
 */
import type { DetailIa } from "@/shared/infrastructure/db/schema";
import type { Besoin, NiveauRisque, StatutCible } from "@/shared/domain/vocabulaire";

export type MaquetteIa = {
  statut: StatutCible;
  risque: NiveauRisque | null;
  besoins: Besoin[];
  nbTentatives: number;
  note: string | null;
  /** Appel fictif à enregistrer comme interaction `appel_ia` (null : appel pas encore « passé »). */
  detail: DetailIa | null;
};

const PRESENTATION =
  "Bonjour, je suis l'assistant automatique de la Maison des seniors. Je vous appelle car le plan d'alerte est déclenché. Comment allez-vous ?";

export const APPEL_IA_VERTIGES: DetailIa = {
  transcription: [
    { locuteur: "ia", texte: PRESENTATION },
    { locuteur: "personne", texte: "Oh, pas terrible… j'ai des vertiges depuis ce matin." },
    { locuteur: "ia", texte: "Je suis désolé. Avez-vous bu de l'eau aujourd'hui ?" },
    { locuteur: "personne", texte: "Un peu… je ne sais plus." },
    {
      locuteur: "ia",
      texte: "Je vais demander à une personne de la Maison des seniors de vous rappeler très rapidement. Si vous vous sentez plus mal, appelez le 15.",
    },
  ],
  resume: "La personne dit avoir des vertiges depuis le matin et ne sait plus si elle a bu. Confusion légère.",
  reponses: { q1: "non", q2: "non communiqué", q3: "non" },
  risque: "rouge",
  justification: "Vertiges et confusion : escalade vers un humain (biais de sécurité).",
};

const APPEL_IA_RAS: DetailIa = {
  transcription: [
    { locuteur: "ia", texte: PRESENTATION },
    { locuteur: "personne", texte: "Très bien, merci. Je reste au frais, les volets sont fermés." },
    { locuteur: "ia", texte: "Parfait. Recevez-vous des visites ou des appels de vos proches ?" },
    { locuteur: "personne", texte: "Oui, ma fille passe tous les soirs." },
  ],
  resume: "Va bien, applique les recommandations, visite quotidienne de sa fille.",
  reponses: { q1: "oui", q2: "oui", q3: "oui" },
  risque: "vert",
  justification: "Aucun signe d'alerte.",
};

const APPEL_IA_EAU: DetailIa = {
  transcription: [
    { locuteur: "ia", texte: PRESENTATION },
    { locuteur: "personne", texte: "Ça va, mais je n'ai plus d'eau en bouteille et je ne peux pas porter les packs." },
    { locuteur: "ia", texte: "Je transmets votre demande à la Maison des seniors, quelqu'un vous recontactera aujourd'hui." },
  ],
  resume: "Va bien mais n'a plus d'eau en bouteille ; ne peut pas porter de charges.",
  reponses: { q1: "oui", q2: "oui", q3: "oui" },
  risque: "orange",
  justification: "Besoin matériel (eau) sans signe de malaise.",
};

const MODELES: MaquetteIa[] = [
  { statut: "escalade_humain", risque: "rouge", besoins: [], nbTentatives: 1, note: "Escaladé par l'IA : la personne dit avoir des vertiges.", detail: APPEL_IA_VERTIGES },
  { statut: "joint_ras", risque: "vert", besoins: [], nbTentatives: 1, note: APPEL_IA_RAS.resume, detail: APPEL_IA_RAS },
  { statut: "joint_besoin", risque: "orange", besoins: ["eau"], nbTentatives: 1, note: APPEL_IA_EAU.resume, detail: APPEL_IA_EAU },
  { statut: "messagerie", risque: null, besoins: [], nbTentatives: 1, note: "Messagerie : nouvelle tentative IA programmée.", detail: null },
  { statut: "a_appeler", risque: null, besoins: [], nbTentatives: 0, note: null, detail: null },
];

/** Attribue un résultat fictif figé à chaque cible IA, dans l'ordre (déterministe) : une seule escalade, en premier. */
export function attribuerMaquetteIa(idsIa: string[]): Map<string, MaquetteIa> {
  const [escalade, ...suivants] = MODELES;
  return new Map(idsIa.map((id, i) => [id, i === 0 ? escalade : suivants[(i - 1) % suivants.length]]));
}
