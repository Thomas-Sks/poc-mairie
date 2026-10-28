/**
 * E2 — Cercle de proches. Un contact est unique et partageable entre bénéficiaires (E2-US2) :
 * le modifier le met à jour partout. Chaque changement recalcule le score (clés, proche joignable).
 */
import type { Contexte } from "@/shared/application/contexte";
import { exiger } from "@/shared/domain/permissions";
import { trierParRang } from "../domain/cercle";
import { ErreurMetier, FicheIntrouvable } from "./erreurs";
import type { DepsBeneficiaires, DonneesContact, DonneesLien } from "./ports";
import { recalculerScoreHistorise } from "./score";

export async function listerCercle(deps: Pick<DepsBeneficiaires, "cercle">, ctx: Contexte, e: { beneficiaireId: string }) {
  exiger(ctx.utilisateur.role, "fiches.lire");
  return trierParRang(await deps.cercle.liens(ctx.commune.id, e.beneficiaireId), (l) => l.contact.nom);
}

export async function chercherContacts(deps: Pick<DepsBeneficiaires, "cercle">, ctx: Contexte, e: { recherche: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  if (e.recherche.trim().length < 2) return [];
  return deps.cercle.chercherContacts(ctx.commune.id, e.recherche.trim());
}

function verifierContact(c: DonneesContact) {
  if (!c.nom.trim()) throw new ErreurMetier("Indiquez le nom du contact.", { nom: "Indiquez le nom." });
  if (!c.telephone && !c.telephone2 && !c.email) {
    throw new ErreurMetier("Indiquez au moins un moyen de joindre ce contact.", { telephone: "Indiquez au moins un téléphone ou un email." });
  }
}

export async function ajouterAuCercle(
  deps: Pick<DepsBeneficiaires, "fiches" | "cercle">,
  ctx: Contexte,
  e: { beneficiaireId: string; contactExistantId: string | null; contact: DonneesContact | null; lien: DonneesLien },
) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  if (!(await deps.fiches.trouver(ctx.commune.id, e.beneficiaireId))) throw new FicheIntrouvable();
  const liens = await deps.cercle.liens(ctx.commune.id, e.beneficiaireId);

  let contactId: string;
  if (e.contactExistantId) {
    if (!(await deps.cercle.contactExiste(ctx.commune.id, e.contactExistantId))) throw new ErreurMetier("Ce contact est introuvable.");
    if (liens.some((l) => l.contactId === e.contactExistantId)) throw new ErreurMetier("Ce contact fait déjà partie du cercle.");
    contactId = e.contactExistantId;
  } else {
    if (!e.contact) throw new ErreurMetier("Indiquez le contact.");
    verifierContact(e.contact);
    contactId = await deps.cercle.creerContact(ctx.commune.id, e.contact);
  }
  await deps.cercle.lier(e.beneficiaireId, contactId, e.lien);
  await recalculerScoreHistorise(deps, ctx, e.beneficiaireId);
}

export async function modifierMembreCercle(
  deps: Pick<DepsBeneficiaires, "fiches" | "cercle">,
  ctx: Contexte,
  e: { lienId: string; contact: DonneesContact; lien: DonneesLien },
) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const lien = await deps.cercle.lien(ctx.commune.id, e.lienId);
  if (!lien) throw new ErreurMetier("Ce contact est introuvable.");
  verifierContact(e.contact);
  await deps.cercle.modifierContact(ctx.commune.id, lien.contactId, e.contact);
  await deps.cercle.modifierLien(ctx.commune.id, e.lienId, e.lien);
  await recalculerScoreHistorise(deps, ctx, lien.beneficiaireId);
  return { beneficiaireId: lien.beneficiaireId, partageAvec: lien.partageAvec };
}

/** Retire le contact du cercle de CE bénéficiaire ; le contact reste lié aux autres. */
export async function retirerDuCercle(deps: Pick<DepsBeneficiaires, "fiches" | "cercle">, ctx: Contexte, e: { lienId: string }) {
  exiger(ctx.utilisateur.role, "fiches.ecrire");
  const lien = await deps.cercle.lien(ctx.commune.id, e.lienId);
  if (!lien) throw new ErreurMetier("Ce contact est introuvable.");
  await deps.cercle.retirerLien(ctx.commune.id, e.lienId);
  await recalculerScoreHistorise(deps, ctx, lien.beneficiaireId);
  return lien.beneficiaireId;
}
