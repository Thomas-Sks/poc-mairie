import "server-only";
import * as XLSX from "xlsx";
import type { PersonneListee } from "../domain/reponse";

/** Classeur Excel d'une liste de l'assistant : une ligne par personne, la question en titre. */
export function classeurPersonnes(titre: string, personnes: PersonneListee[]): Buffer {
  const lignes = [
    [titre],
    [],
    ["Civilité", "Nom", "Prénom", "Âge", "Adresse", "Téléphone", "Priorité"],
    ...personnes.map((p) => [p.civilite, p.nom, p.prenom, p.age, p.adresse, p.telephone ?? "", p.priorite]),
  ];
  const feuille = XLSX.utils.aoa_to_sheet(lignes);
  feuille["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 6 }, { wch: 36 }, { wch: 16 }, { wch: 9 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Liste");
  return XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
