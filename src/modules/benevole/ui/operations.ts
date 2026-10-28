/**
 * Opérations envoyées par l'écran « Appel ». Validées par Zod à la frontière (Server Action),
 * et stockées telles quelles dans la file hors connexion du navigateur.
 */
import { z } from "zod";
import { BESOINS } from "@/shared/domain/vocabulaire";
import { RESULTATS_APPEL, RESULTATS_PROCHE } from "../domain/resultats";

const texteFacultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((t) => (t ? t : null));

const base = { idOperation: z.string().min(8).max(64), cibleId: z.uuid() };

export const schemaOperation = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("resultat"),
    resultat: z.enum(RESULTATS_APPEL),
    reponses: z.record(z.string().max(20), z.enum(["oui", "non"])),
    besoins: z.array(z.enum(BESOINS)).max(BESOINS.length),
    note: texteFacultatif(1000),
    precision: texteFacultatif(300),
  }),
  z.object({
    ...base,
    type: z.literal("proche"),
    lienId: z.uuid(),
    resultat: z.enum(RESULTATS_PROCHE),
    note: texteFacultatif(1000),
  }),
  z.object({
    ...base,
    type: z.literal("demande"),
    nature: z.enum(["visite", "info"]),
    sujet: texteFacultatif(300),
  }),
]);

export type OperationBenevole = z.input<typeof schemaOperation>;
/** Opération sans son identifiant (ajouté au moment de l'envoi). */
export type NouvelleOperation = OperationBenevole extends infer O ? (O extends OperationBenevole ? Omit<O, "idOperation"> : never) : never;

export type ReponseOperation =
  | { ok: true; statut: string; alerte: "danger" | "escalade" | null }
  | { ok: false; message: string };
