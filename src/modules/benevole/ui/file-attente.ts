"use client";

/**
 * Adaptateur navigateur de la file hors connexion (E10-US8) : stockage localStorage + envoi par Server Action.
 * La logique (ordre, arrêt à la première coupure, lecture tolérante) est dans le domaine.
 */
import { useSyncExternalStore } from "react";
import { ajouterALaFile, lireFile, synchroniserFile, type ElementFile } from "../domain/file-hors-ligne";
import { envoyerOperation } from "./actions";
import type { NouvelleOperation, OperationBenevole, ReponseOperation } from "./operations";

const CLE = "benevole.file-attente.v1";
const EVENEMENT = "benevole:file-attente";

type Element = ElementFile<OperationBenevole>;

function lire(): Element[] {
  try {
    return lireFile<OperationBenevole>(window.localStorage.getItem(CLE));
  } catch {
    return [];
  }
}

function ecrire(file: Element[]) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(file));
  } catch {
    // Stockage indisponible (navigation privée) : on ne peut que réessayer immédiatement.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

/** crypto.randomUUID n'existe qu'en contexte sécurisé (pas en http sur le réseau local de la démo). */
function nouvelId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export type IssueEnvoiClient =
  | { etat: "envoye"; reponse: Extract<ReponseOperation, { ok: true }> }
  | { etat: "en_attente" }
  | { etat: "refuse"; message: string };

/** Envoie tout de suite ; en cas de coupure, met l'opération en file pour plus tard. */
export async function envoyerOuMettreEnFile(nouvelle: NouvelleOperation): Promise<IssueEnvoiClient> {
  const operation = { ...nouvelle, idOperation: nouvelId() } as OperationBenevole;
  const mettreEnFile = (): IssueEnvoiClient => {
    ecrire(ajouterALaFile(lire(), { id: operation.idOperation, creeLe: new Date().toISOString(), operation }));
    return { etat: "en_attente" };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return mettreEnFile();
  try {
    const reponse = await envoyerOperation(operation);
    return reponse.ok ? { etat: "envoye", reponse } : { etat: "refuse", message: reponse.message };
  } catch {
    return mettreEnFile();
  }
}

let synchronisationEnCours = false;

/** Renvoie la file ; retourne le nombre d'opérations parties. */
export async function synchroniser(): Promise<number> {
  if (synchronisationEnCours || !navigator.onLine) return 0;
  const file = lire();
  if (file.length === 0) return 0;
  synchronisationEnCours = true;
  try {
    const { restante, envoyes } = await synchroniserFile(file, async (op) => ((await envoyerOperation(op)).ok ? "accepte" : "refuse"));
    // Des opérations ont pu être ajoutées pendant l'envoi : on ne retire que celles parties.
    const parties = new Set(file.filter((e) => !restante.some((r) => r.id === e.id)).map((e) => e.id));
    ecrire(lire().filter((e) => !parties.has(e.id)));
    return envoyes;
  } finally {
    synchronisationEnCours = false;
  }
}

function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

/** État de la file pour l'indication discrète : « Hors connexion – 2 résultats en attente ». */
export function useEtatFile(): { enAttente: number; enLigne: boolean } {
  const enAttente = useSyncExternalStore(abonner, () => lire().length, () => 0);
  const enLigne = useSyncExternalStore(abonner, () => navigator.onLine, () => true);
  return { enAttente, enLigne };
}
