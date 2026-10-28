/**
 * Actions sur l'état d'une fiche : archivage (E1-US4), niveau de priorité forcé (RG-01),
 * activation de l'assistant IA (E11, maquette).
 */
import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import { MOTIF_ARCHIVAGE_LIBELLES, STATUT_FICHE_LIBELLES, type MotifArchivage, type NiveauPriorite } from "@/shared/domain/vocabulaire";
import { ErreurMetier, FicheIntrouvable } from "./erreurs";
import type { DepsBeneficiaires } from "./ports";

export async function archiverFiche(
  deps: Pick<DepsBeneficiaires, "fiches">,
  ctx: Contexte,
  entree: { id: string; motif: MotifArchivage; commentaire: string | null },
) {
  exiger(ctx.utilisateur.role, "fiches.archiver");
  const fiche = await deps.fiches.trouver(ctx.commune.id, entree.id);
  if (!fiche) throw new FicheIntrouvable();
  if (fiche.statut === "archivee") throw new ErreurMetier("Cette fiche est déjà archivée.");
  if (entree.motif === "autre" && !entree.commentaire?.trim()) {
    throw new ErreurMetier("Précisez le motif.", { commentaire: "Précisez le motif de l'archivage." });
  }
  await deps.fiches.archiver(ctx.commune.id, entree.id, entree.motif, entree.commentaire);
  await deps.fiches.historiser(
    entree.id,
    [
      { champ: "Statut de la fiche", ancienneValeur: STATUT_FICHE_LIBELLES[fiche.statut], nouvelleValeur: STATUT_FICHE_LIBELLES.archivee },
      {
        champ: "Motif d'archivage",
        ancienneValeur: null,
        nouvelleValeur: [MOTIF_ARCHIVAGE_LIBELLES[entree.motif], entree.commentaire].filter(Boolean).join(" – "),
      },
    ],
    ctx.utilisateur.id,
  );
}

/** `niveau: null` revient au niveau calculé automatiquement. La justification est obligatoire pour forcer. */
export async function forcerPriorite(
  deps: Pick<DepsBeneficiaires, "fiches">,
  ctx: Contexte,
  entree: { id: string; niveau: NiveauPriorite | null; justification: string | null },
) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const fiche = await deps.fiches.trouver(ctx.commune.id, entree.id);
  if (!fiche) throw new FicheIntrouvable();
  const justification = entree.justification?.trim() || null;
  if (entree.niveau !== null && (!justification || justification.length < 5)) {
    throw new ErreurMetier("La justification est obligatoire.", { justification: "Expliquez pourquoi vous forcez ce niveau." });
  }
  await deps.fiches.forcerNiveau(ctx.commune.id, entree.id, entree.niveau, entree.niveau ? justification : null);
  await deps.fiches.historiser(
    entree.id,
    [
      {
        champ: "Niveau de priorité forcé",
        ancienneValeur: fiche.niveauForce ? `${fiche.niveauForce} (${fiche.niveauForceJustification ?? ""})` : null,
        nouvelleValeur: entree.niveau ? `${entree.niveau} (${justification})` : "Calcul automatique",
      },
    ],
    ctx.utilisateur.id,
  );
}

/** E11-US1 : activer l'IA fiche par fiche — jamais sans consentement explicite. */
export async function definirAssistantIa(deps: Pick<DepsBeneficiaires, "fiches">, ctx: Contexte, entree: { id: string; active: boolean }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const fiche = await deps.fiches.trouver(ctx.commune.id, entree.id);
  if (!fiche) throw new FicheIntrouvable();
  if (entree.active && !fiche.beneficiaire.consentementIa) {
    throw new ErreurMetier("La personne n'a pas donné son consentement aux appels par l'assistant IA.");
  }
  if (fiche.iaActivee === entree.active) return;
  await deps.fiches.definirIa(ctx.commune.id, entree.id, entree.active);
  await deps.fiches.historiser(
    entree.id,
    [{ champ: "Appels par l'assistant IA", ancienneValeur: fiche.iaActivee ? "Activés" : "Désactivés", nouvelleValeur: entree.active ? "Activés" : "Désactivés" }],
    ctx.utilisateur.id,
  );
}
