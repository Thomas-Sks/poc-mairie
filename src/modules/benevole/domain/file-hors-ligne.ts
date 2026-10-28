/**
 * E10-US8 : fonctionnement sur réseau faible. Les résultats qui n'ont pas pu partir sont mis en file
 * (stockée par l'interface dans le navigateur), puis renvoyés dans l'ordre au retour du réseau.
 * Fonctions pures : le stockage et l'envoi sont injectés.
 */

export type ElementFile<T> = { id: string; creeLe: string; operation: T };

/** Issue de l'envoi d'un élément : accepté, ou refusé définitivement (inutile de réessayer). */
export type IssueEnvoi = "accepte" | "refuse";

export function ajouterALaFile<T>(file: ElementFile<T>[], element: ElementFile<T>): ElementFile<T>[] {
  if (file.some((e) => e.id === element.id)) return file;
  return [...file, element];
}

export function retirerDeLaFile<T>(file: ElementFile<T>[], id: string): ElementFile<T>[] {
  return file.filter((e) => e.id !== id);
}

/**
 * Renvoie les éléments dans l'ordre. Une erreur (réseau toujours coupé) interrompt la synchronisation :
 * l'élément et les suivants restent en file pour la prochaine tentative.
 */
export async function synchroniserFile<T>(
  file: ElementFile<T>[],
  envoyer: (operation: T, id: string) => Promise<IssueEnvoi>,
): Promise<{ restante: ElementFile<T>[]; envoyes: number; refuses: number }> {
  let restante = file;
  let envoyes = 0;
  let refuses = 0;
  for (const element of file) {
    try {
      const issue = await envoyer(element.operation, element.id);
      if (issue === "accepte") envoyes += 1;
      else refuses += 1;
      restante = retirerDeLaFile(restante, element.id);
    } catch {
      break;
    }
  }
  return { restante, envoyes, refuses };
}

/** Lecture tolérante du stockage (contenu absent, corrompu ou d'une ancienne version). */
export function lireFile<T>(brut: string | null): ElementFile<T>[] {
  if (!brut) return [];
  try {
    const valeur: unknown = JSON.parse(brut);
    if (!Array.isArray(valeur)) return [];
    return valeur.filter(
      (e): e is ElementFile<T> =>
        typeof e === "object" && e !== null && typeof e.id === "string" && typeof e.creeLe === "string" && "operation" in e,
    );
  } catch {
    return [];
  }
}

/** Indication discrète affichée au bénévole ; null quand tout est envoyé et le réseau présent. */
export function messageFile(enAttente: number, enLigne: boolean): string | null {
  const attente = enAttente === 0 ? null : `${enAttente} résultat${enAttente > 1 ? "s" : ""} en attente`;
  if (!enLigne) return attente ? `Hors connexion – ${attente}` : "Hors connexion";
  return attente ? `Envoi en cours – ${attente}` : null;
}
