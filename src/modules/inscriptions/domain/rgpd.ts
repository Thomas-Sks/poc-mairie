/**
 * Textes d'information RGPD affichés à la fin du formulaire public (E7, E13).
 * Figés pour le POC : ils ne sont plus modifiables dans les paramètres.
 */
export type TextesRgpd = { responsable: string; conservation: string; dpo: string; droits: string };

export const RGPD_PAR_DEFAUT: TextesRgpd = {
  responsable: "CCAS de Lomme, représenté par sa présidente",
  conservation: "Vos données sont conservées 1 an après votre inscription effective.",
  dpo: "dpo@mairie-lomme.example",
  droits:
    "Vous pouvez accéder à vos données, les rectifier ou demander votre désinscription du registre à tout moment auprès de la Maison des seniors.",
};
