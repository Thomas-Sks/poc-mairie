"use server";
/**
 * Server Actions du module « bénéficiaires » (adaptateur entrant) :
 * validation Zod → contexte → cas d'usage → revalidation.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { AccesRefuse, peut } from "@/shared/domain/permissions";
import { formaterDate } from "@/shared/domain/dates";
import { ErreurMetier } from "../application/erreurs";
import { casDUsage } from "../infrastructure";
import type { EtatAction } from "./etat-action";
import {
  archivageSchema,
  contactSchema,
  creneauSchema,
  erreursParChamp,
  ficheSchema,
  indisponibiliteSchema,
  interactionSchema,
  lireFormData,
  MULTIPLES_FICHE,
  priseEnChargeSchema,
  prioriteSchema,
  rappelSchema,
  versSaisieFiche,
} from "./schemas";

const idSchema = z.uuid();
const chemin = (id: string) => `/beneficiaires/${id}`;
const revaliderFiche = (id: string) => {
  revalidatePath(chemin(id), "layout");
  revalidatePath("/beneficiaires");
};

/** Traduit les erreurs attendues en message affichable ; les autres remontent. */
async function executer(fn: () => Promise<EtatAction>): Promise<EtatAction> {
  try {
    return { ...(await fn()), jeton: Date.now() };
  } catch (e) {
    if (e instanceof ErreurMetier) return { ok: false, message: e.message, erreurs: e.champs, jeton: Date.now() };
    if (e instanceof AccesRefuse) return { ok: false, message: "Vous n'avez pas le droit d'effectuer cette action.", jeton: Date.now() };
    throw e;
  }
}

function invalide(erreur: z.ZodError): EtatAction {
  return { ok: false, message: "Certains champs sont à corriger.", erreurs: erreursParChamp(erreur) };
}

// ─── Fiche ───────────────────────────────────────────────────────────────────

export async function creerFicheAction(_etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  let idCree: string | null = null;
  const etat = await executer(async () => {
    const parse = ficheSchema.safeParse(lireFormData(fd, MULTIPLES_FICHE));
    if (!parse.success) return invalide(parse.error);
    const resultat = await casDUsage.creerFiche(ctx, {
      saisie: versSaisieFiche(parse.data, peut(ctx.utilisateur.role, "fiches.sante")),
      ignorerDoublons: fd.get("ignorerDoublons") === "1",
    });
    if (resultat.statut === "invalide") return { ok: false, message: "Certains champs sont à corriger.", erreurs: resultat.erreurs };
    if (resultat.statut === "doublons") {
      return {
        ok: false,
        message: "Une fiche semblable existe déjà.",
        doublons: resultat.doublons.map((d) => ({
          id: d.fiche.id,
          nom: `${d.fiche.civilite} ${d.fiche.prenom} ${d.fiche.nom.toUpperCase()}`,
          dateNaissance: formaterDate(d.fiche.dateNaissance),
          statut: d.fiche.statut,
          motifs: d.motifs,
        })),
      };
    }
    idCree = resultat.id;
    return { ok: true };
  });
  if (idCree) {
    revalidatePath("/beneficiaires");
    redirect(chemin(idCree));
  }
  return etat;
}

export async function modifierFicheAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  let modifiee = false;
  const etat = await executer(async () => {
    const parse = ficheSchema.safeParse(lireFormData(fd, MULTIPLES_FICHE));
    if (!parse.success) return invalide(parse.error);
    const resultat = await casDUsage.modifierFiche(ctx, {
      id: idSchema.parse(id),
      saisie: versSaisieFiche(parse.data, peut(ctx.utilisateur.role, "fiches.sante")),
    });
    if (resultat.statut === "invalide") return { ok: false, message: "Certains champs sont à corriger.", erreurs: resultat.erreurs };
    modifiee = true;
    return { ok: true };
  });
  if (modifiee) {
    revaliderFiche(id);
    redirect(chemin(id));
  }
  return etat;
}

export async function archiverFicheAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = archivageSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    await casDUsage.archiverFiche(ctx, { id: idSchema.parse(id), ...parse.data });
    revaliderFiche(id);
    return { ok: true, message: "La fiche est archivée." };
  });
}

export async function forcerPrioriteAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = prioriteSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    const niveau = parse.data.niveau === "auto" ? null : parse.data.niveau;
    await casDUsage.forcerPriorite(ctx, { id: idSchema.parse(id), niveau, justification: parse.data.justification });
    revaliderFiche(id);
    return { ok: true, message: niveau ? `Niveau forcé à ${niveau}.` : "Le niveau est de nouveau calculé automatiquement." };
  });
}

export async function definirAssistantIaAction(id: string, active: boolean): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    await casDUsage.definirAssistantIa(ctx, { id: idSchema.parse(id), active: z.boolean().parse(active) });
    revaliderFiche(id);
    return { ok: true, message: active ? "Appels par l'assistant IA activés." : "Appels par l'assistant IA désactivés." };
  });
}

export async function rechercherAdressesAction(recherche: string) {
  const ctx = await obtenirContexte();
  return casDUsage.rechercherAdresses(ctx, { recherche: z.string().max(200).parse(recherche) });
}

// ─── Journal & rappels ───────────────────────────────────────────────────────

export async function enregistrerInteractionAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = interactionSchema.safeParse(lireFormData(fd, ["besoins"]));
    if (!parse.success) return invalide(parse.error);
    const { survenueLe, ...reste } = parse.data;
    // Saisie en heure locale (Paris) : on l'interprète comme telle.
    const date = new Date(`${survenueLe}${survenueLe.length === 16 ? ":00" : ""}${decalageParis(survenueLe)}`);
    const resultat = await casDUsage.enregistrerInteraction(ctx, { beneficiaireId: idSchema.parse(id), survenueLe: date, ...reste });
    revaliderFiche(id);
    return {
      ok: true,
      message: resultat.rappelCree ? "Interaction enregistrée. Un rappel de suivi a été créé." : "Interaction enregistrée.",
    };
  });
}

/** Décalage horaire de Paris (« +01:00 » ou « +02:00 ») à la date donnée. */
function decalageParis(dateLocale: string): string {
  const approx = new Date(`${dateLocale.slice(0, 10)}T12:00:00Z`);
  const nom = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
    .formatToParts(approx)
    .find((p) => p.type === "timeZoneName")?.value;
  const heures = Number(nom?.replace("GMT", "") || 0);
  return `${heures >= 0 ? "+" : "-"}${String(Math.abs(heures)).padStart(2, "0")}:00`;
}

export async function creerRappelAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = rappelSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    await casDUsage.creerRappel(ctx, { beneficiaireId: idSchema.parse(id), ...parse.data });
    revaliderFiche(id);
    revalidatePath("/");
    return { ok: true, message: `Rappel créé pour le ${formaterDate(parse.data.echeance)}.` };
  });
}

export async function marquerRappelFaitAction(id: string, rappelId: string): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    await casDUsage.marquerRappelFait(ctx, { rappelId: idSchema.parse(rappelId) });
    revaliderFiche(id);
    revalidatePath("/");
    return { ok: true, message: "Rappel marqué comme fait." };
  });
}

// ─── Indisponibilités ────────────────────────────────────────────────────────

export async function declarerIndisponibiliteAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = indisponibiliteSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    const { jusquANouvelOrdre, fin, ...reste } = parse.data;
    if (!jusquANouvelOrdre && !fin) return { ok: false, erreurs: { fin: "Indiquez la date de fin, ou cochez « Jusqu'à nouvel ordre »." } };
    const resultat = await casDUsage.declarerIndisponibilite(ctx, { beneficiaireId: idSchema.parse(id), fin: jusquANouvelOrdre ? null : fin, ...reste });
    revaliderFiche(id);
    return {
      ok: true,
      message: resultat.rappelLe
        ? `Indisponibilité déclarée. Rappel « Vérifier le retour » prévu le ${formaterDate(resultat.rappelLe)}.`
        : "Indisponibilité déclarée.",
    };
  });
}

export async function signalerRetourAction(indisponibiliteId: string): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const beneficiaireId = await casDUsage.signalerRetour(ctx, { indisponibiliteId: idSchema.parse(indisponibiliteId) });
    revaliderFiche(beneficiaireId);
    return { ok: true, message: "Retour enregistré." };
  });
}

// ─── Cercle ──────────────────────────────────────────────────────────────────

export async function chercherContactsAction(recherche: string) {
  const ctx = await obtenirContexte();
  return casDUsage.chercherContacts(ctx, { recherche: z.string().max(100).parse(recherche) });
}

export async function ajouterAuCercleAction(id: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = contactSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    const { contactExistantId, relation, rangAppel, possedeCles, estUrgence, estRepresentantLegal, ...contact } = parse.data;
    await casDUsage.ajouterAuCercle(ctx, {
      beneficiaireId: idSchema.parse(id),
      contactExistantId,
      contact: contactExistantId ? null : contact,
      lien: { relation, rangAppel, possedeCles, estUrgence, estRepresentantLegal },
    });
    revaliderFiche(id);
    return { ok: true, message: "Contact ajouté au cercle." };
  });
}

export async function modifierMembreCercleAction(lienId: string, _etat: EtatAction, fd: FormData): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = contactSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    const { relation, rangAppel, possedeCles, estUrgence, estRepresentantLegal, prenom, nom, structure, telephone, telephone2, email, ville, disponibilites } = parse.data;
    const r = await casDUsage.modifierMembreCercle(ctx, {
      lienId: idSchema.parse(lienId),
      contact: { prenom, nom, structure, telephone, telephone2, email, ville, disponibilites },
      lien: { relation, rangAppel, possedeCles, estUrgence, estRepresentantLegal },
    });
    revaliderFiche(r.beneficiaireId);
    // Le contact est partagé : les fiches des autres bénéficiaires liés sont aussi à jour.
    if (r.partageAvec > 0) revalidatePath("/beneficiaires", "layout");
    return { ok: true, message: r.partageAvec > 0 ? `Contact mis à jour sur ${r.partageAvec + 1} fiches.` : "Contact mis à jour." };
  });
}

export async function retirerDuCercleAction(lienId: string): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const beneficiaireId = await casDUsage.retirerDuCercle(ctx, { lienId: idSchema.parse(lienId) });
    revaliderFiche(beneficiaireId);
    return { ok: true, message: "Contact retiré du cercle." };
  });
}

// ─── Prises en charge ────────────────────────────────────────────────────────

export async function enregistrerPriseEnChargeAction(
  ref: { beneficiaireId: string; priseEnChargeId: string | null },
  _etat: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = priseEnChargeSchema.safeParse(lireFormData(fd));
    if (!parse.success) return invalide(parse.error);
    const donnees = { ...parse.data, gir: parse.data.type === "apa" ? parse.data.gir : null };
    if (ref.priseEnChargeId) {
      await casDUsage.modifierPriseEnCharge(ctx, { priseEnChargeId: idSchema.parse(ref.priseEnChargeId), donnees });
    } else {
      await casDUsage.ajouterPriseEnCharge(ctx, { beneficiaireId: idSchema.parse(ref.beneficiaireId), donnees });
    }
    revaliderFiche(ref.beneficiaireId);
    return { ok: true, message: ref.priseEnChargeId ? "Prise en charge mise à jour." : "Prise en charge ajoutée." };
  });
}

export async function retirerPriseEnChargeAction(priseEnChargeId: string): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const beneficiaireId = await casDUsage.retirerPriseEnCharge(ctx, { priseEnChargeId: idSchema.parse(priseEnChargeId) });
    revaliderFiche(beneficiaireId);
    return { ok: true, message: "Prise en charge retirée." };
  });
}

export async function enregistrerCreneauAction(
  ref: { priseEnChargeId: string; creneauId: string | null },
  _etat: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const parse = creneauSchema.safeParse(lireFormData(fd, ["joursSemaine", "exceptions"]));
    if (!parse.success) return invalide(parse.error);
    const beneficiaireId = await casDUsage.enregistrerCreneau(ctx, {
      priseEnChargeId: idSchema.parse(ref.priseEnChargeId),
      creneauId: ref.creneauId ? idSchema.parse(ref.creneauId) : null,
      creneau: parse.data,
    });
    revaliderFiche(beneficiaireId);
    return { ok: true, message: ref.creneauId ? "Créneau mis à jour." : "Créneau ajouté au planning." };
  });
}

export async function retirerCreneauAction(creneauId: string): Promise<EtatAction> {
  const ctx = await obtenirContexte();
  return executer(async () => {
    const beneficiaireId = await casDUsage.retirerCreneau(ctx, { creneauId: idSchema.parse(creneauId) });
    revaliderFiche(beneficiaireId);
    return { ok: true, message: "Créneau retiré." };
  });
}
