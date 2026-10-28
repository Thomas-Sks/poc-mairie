/**
 * Scripts d'appel livrés par défaut (E10-US4 bis / ter / quater).
 * Variables injectées à l'affichage : {nom}, {prenomAppelant}, {structure}, {commune}.
 */
import type { ContenuScript } from "@/shared/infrastructure/db/schema";
import type { TypeCampagne } from "@/shared/domain/vocabulaire";

export const SCRIPT_CANICULE: ContenuScript = {
  introduction:
    "Bonjour {civilite} {nom}, je suis {prenomAppelant} de {structure}. Comme vous êtes inscrit(e) sur le Plan Alerte et Urgence et qu'il a été déclenché, je me permets de vous appeler pour prendre de vos nouvelles et m'assurer que vous allez bien. Je me permets de vous poser quelques questions.",
  questions: [
    {
      id: "q1",
      texte: "Comment allez-vous ? Pas de souci particulier (nausées, maux de tête, vertiges…) ?",
      reponsePreoccupante: "non",
      consigne: "Cessez votre activité et buvez de l'eau ; si ça persiste, consultez votre médecin.",
      statutPropose: "joint_besoin",
    },
    {
      id: "q2",
      texte: "Recevez-vous de la visite ou des appels de votre famille, amis, voisins ?",
      reponsePreoccupante: "non",
      tag: "isolement",
      besoin: "isolement",
    },
    {
      id: "q3",
      texte: "Appliquez-vous les recommandations pour supporter la chaleur ?",
      reponsePreoccupante: "non",
      afficherEncart: true,
    },
  ],
  encart: {
    titre: "Recommandations chaleur",
    items: [
      "Boire régulièrement sans attendre d'avoir soif, manger léger.",
      "Mouiller la peau : visage, cou, avant-bras.",
      "Fermer volets et fenêtres des façades au soleil tant qu'il fait plus chaud dehors.",
      "Ouvrir tôt le matin, tard le soir et la nuit ; faire des courants d'air.",
      "Éviter de sortir aux heures chaudes.",
      "Porter un chapeau et des vêtements légers et amples.",
    ],
  },
  conclusion:
    "N'hésitez pas à contacter {structure} si besoin. Je vous rappelle tant que le plan est activé. Bonne journée, à demain.",
  boutonsSpecifiques: [],
  numerosUtiles: [
    { libelle: "Canicule Info Service (9h-19h)", numero: "0 800 06 66 66" },
  ],
};

export const SCRIPT_GRAND_FROID: ContenuScript = {
  introduction:
    "Bonjour {civilite} {nom}, je suis {prenomAppelant} de {structure}. Comme vous êtes inscrit(e) sur le Plan Alerte et Urgence et qu'il a été déclenché en raison du grand froid, je me permets de vous appeler pour prendre de vos nouvelles.",
  questions: [
    {
      id: "q1",
      texte: "Comment allez-vous ? Pas de souci particulier (frissons, engourdissement des mains ou des pieds, toux, fièvre) ?",
      reponsePreoccupante: "non",
      consigne: "Couvrez-vous, buvez une boisson chaude ; si ça persiste, appelez votre médecin.",
      statutPropose: "joint_besoin",
    },
    {
      id: "q2",
      texte: "Votre chauffage fonctionne-t-il et votre logement est-il assez chaud ?",
      reponsePreoccupante: "non",
      besoin: "chauffage",
      statutPropose: "joint_besoin",
    },
    {
      id: "q3",
      texte: "Recevez-vous de la visite ou des appels de votre famille, amis, voisins ?",
      reponsePreoccupante: "non",
      tag: "isolement",
      besoin: "isolement",
    },
    {
      id: "q4",
      texte: "Avez-vous ce qu'il faut à la maison (repas, médicaments) pour ne pas avoir à sortir ?",
      reponsePreoccupante: "non",
      besoin: "courses",
      statutPropose: "joint_besoin",
    },
  ],
  encart: {
    titre: "Recommandations froid",
    items: [
      "Maintenir une température d'environ 19 °C.",
      "Ne jamais boucher les aérations ; aérer 10 minutes par jour.",
      "Ne pas utiliser de chauffage d'appoint en continu, ni le four ou un barbecue pour se chauffer (risque de monoxyde de carbone).",
      "Limiter les sorties ; si on sort, couvrir la tête, les mains et le cou et porter plusieurs couches.",
      "Manger suffisamment et boire des boissons chaudes.",
    ],
  },
  conclusion:
    "N'hésitez pas à contacter {structure} si besoin. Je vous rappelle tant que le plan est activé. Bonne journée.",
  boutonsSpecifiques: [
    {
      libelle: "Suspicion de monoxyde de carbone",
      consigne: "Sortez, aérez, appelez le 18 ou le 112.",
      statut: "danger",
    },
  ],
  numerosUtiles: [
    { libelle: "Urgences", numero: "112" },
    { libelle: "Pompiers", numero: "18" },
    { libelle: "SAMU", numero: "15" },
  ],
};

export const SCRIPT_INONDATION: ContenuScript = {
  introduction:
    "Bonjour {civilite} {nom}, je suis {prenomAppelant} de {structure}. Votre rue est concernée par l'inondation en cours, je vous appelle pour savoir comment vous allez et si vous avez besoin d'aide.",
  questions: [
    {
      id: "q1",
      texte: "Êtes-vous en sécurité en ce moment ?",
      reponsePreoccupante: "non",
      consigne: "Appelez le 112.",
      statutPropose: "danger",
    },
    {
      id: "q2",
      texte: "L'eau est-elle entrée dans votre logement ?",
      reponsePreoccupante: "oui",
      afficherEncart: true,
      besoin: "logement",
    },
    {
      id: "q3",
      texte: "Avez-vous toujours de l'électricité, du chauffage et de l'eau potable ?",
      reponsePreoccupante: "non",
      besoin: "logement",
      statutPropose: "joint_besoin",
    },
    {
      id: "q4",
      texte: "Pouvez-vous rester chez vous ?",
      reponsePreoccupante: "non",
      statutPropose: "evacuation",
    },
    {
      id: "q5",
      texte: "Un proche peut-il venir vous aider ou vous accueillir ?",
      reponsePreoccupante: "non",
    },
  ],
  encart: {
    titre: "Consignes inondation",
    items: [
      "Monter à l'étage si possible.",
      "Couper l'électricité et le gaz si l'eau entre.",
      "Ne pas descendre à la cave ni au sous-sol.",
      "Ne pas aller chercher sa voiture ; ne pas marcher ni rouler dans l'eau.",
      "Garder près de soi ses médicaments, ses papiers et un téléphone chargé.",
      "Suivre les consignes des autorités (radio locale).",
    ],
  },
  conclusion: "N'hésitez pas à contacter {structure} si besoin. Prenez soin de vous.",
  boutonsSpecifiques: [],
  numerosUtiles: [
    { libelle: "Urgences", numero: "112" },
    { libelle: "Pompiers", numero: "18" },
  ],
};

export const SCRIPT_VERIFICATION: ContenuScript = {
  introduction:
    "Bonjour {civilite} {nom}, je suis {prenomAppelant} de {structure}. Vous êtes inscrit(e) au registre des personnes vulnérables ; je vous appelle pour vérifier que vos informations sont à jour.",
  questions: [
    { id: "q1", texte: "Êtes-vous toujours joignable à ce numéro ?", reponsePreoccupante: "non" },
    { id: "q2", texte: "Vos proches à prévenir sont-ils toujours les mêmes ?", reponsePreoccupante: "non" },
    { id: "q3", texte: "Prévoyez-vous de vous absenter dans les prochains mois ?", reponsePreoccupante: "oui" },
  ],
  encart: null,
  conclusion: "Merci pour votre temps. N'hésitez pas à contacter {structure} si besoin.",
  boutonsSpecifiques: [],
  numerosUtiles: [],
};

export const SCRIPTS_PAR_DEFAUT: { type: TypeCampagne; nom: string; contenu: ContenuScript }[] = [
  { type: "canicule", nom: "Canicule", contenu: SCRIPT_CANICULE },
  { type: "grand_froid", nom: "Grand froid", contenu: SCRIPT_GRAND_FROID },
  { type: "inondation", nom: "Inondation", contenu: SCRIPT_INONDATION },
  { type: "verification", nom: "Vérification annuelle", contenu: SCRIPT_VERIFICATION },
];
