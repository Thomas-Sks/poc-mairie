/**
 * E7-US3 — File « Inscriptions à valider » (triée par score) et détail d'une inscription.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import { calculerScore, type CritereApplique } from "@/shared/domain/priorite";
import { extraireFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import { detecterDoublons, type Doublon, type FicheExistante } from "../domain/doublons";
import type { FicheInscription, InscriptionEnregistree, InscriptionRepository } from "./ports";

export type FicheAvecDoublons = FicheInscription & { doublons: Doublon[] };
export type InscriptionEnFile = Omit<InscriptionEnregistree, "fiches"> & { fiches: FicheAvecDoublons[]; scoreMax: number };

function avecDoublons(inscription: InscriptionEnregistree, comparables: FicheExistante[]): InscriptionEnFile {
  const siennes = new Set(inscription.fiches.map((f) => f.id));
  const autres = comparables.filter((c) => !siennes.has(c.id));
  const fiches = inscription.fiches.map((f) => ({
    ...f,
    doublons:
      f.statut === "en_attente"
        ? detecterDoublons({ nom: f.nom, prenom: f.prenom, dateNaissance: f.dateNaissance, telephones: [f.telephoneFixe, f.telephoneMobile] }, autres)
        : [],
  }));
  return { ...inscription, fiches, scoreMax: Math.max(0, ...inscription.fiches.map((f) => f.score)) };
}

export async function listerInscriptions(deps: { inscriptions: InscriptionRepository }, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "inscriptions.valider");
  const [enAttente, traitees, comparables] = await Promise.all([
    deps.inscriptions.lister(ctx.commune.id, "en_attente"),
    deps.inscriptions.lister(ctx.commune.id, "traitee", 8),
    deps.inscriptions.fichesComparables(ctx.commune.id, []),
  ]);
  const file = enAttente
    .map((i) => avecDoublons(i, comparables))
    .sort((a, b) => b.scoreMax - a.scoreMax || a.soumisLe.getTime() - b.soumisLe.getTime());
  return { file, traitees };
}

export type DetailInscription = Omit<InscriptionEnFile, "fiches"> & {
  fiches: (FicheAvecDoublons & { criteres: CritereApplique[] })[];
};

export async function consulterInscription(
  deps: { inscriptions: InscriptionRepository },
  ctx: Contexte,
  id: string,
): Promise<DetailInscription | null> {
  exiger(ctx.utilisateur.role, "inscriptions.valider");
  const inscription = await deps.inscriptions.obtenir(ctx.commune.id, id);
  if (!inscription) return null;
  const [comparables, grille] = await Promise.all([
    deps.inscriptions.fichesComparables(ctx.commune.id, []),
    deps.inscriptions.grilleScore(ctx.commune.id),
  ]);
  const enFile = avecDoublons(inscription, comparables);
  const jour = aujourdhui(ctx.maintenant);
  const fiches = await Promise.all(
    enFile.fiches.map(async (f) => {
      const entree = await deps.inscriptions.entreeFaits(ctx.commune.id, f.id);
      const criteres = entree ? calculerScore(extraireFaits({ ...entree, aujourdhui: jour }), grille).criteres : [];
      return { ...f, criteres };
    }),
  );
  return { ...enFile, fiches };
}
