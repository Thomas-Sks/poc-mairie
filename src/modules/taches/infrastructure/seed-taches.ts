/**
 * Extension du seed pour « Mes tâches du jour » (§10.4-1) :
 * - seuls les deux anniversaires du fil rouge (90 ans demain, 85 ans à J+3) tombent dans la fenêtre de rappel ;
 *   les autres anniversaires aléatoires de la fenêtre sont décalés de 10 jours (âge inchangé à un jour près) ;
 * - quelques fiches reçoivent une fréquence de contact cible (E4-US4), dont deux sont dues aujourd'hui.
 */
import { and, eq, inArray, max } from "drizzle-orm";
import * as s from "@/shared/infrastructure/db/schema";
import { ajouterJours, ecartEnJours, prochainAnniversaire } from "@/shared/domain/dates";
import type { ExtensionSeed } from "@/shared/infrastructure/seed/extensions";

const FENETRE_ANNIVERSAIRE = 7;

export const seedTaches: ExtensionSeed = async (db, { communeId, jour, beneficiaires }) => {
  const actifs = beneficiaires.filter((b) => b.statut === "active");
  const estPersonnage = (b: (typeof beneficiaires)[number]) => {
    const { age } = prochainAnniversaire(b.dateNaissance, jour);
    const dans = ecartEnJours(jour, prochainAnniversaire(b.dateNaissance, jour).date);
    return (dans === 1 && age === 90) || (dans === 3 && age === 85) || b.retourHospitalisationLe !== null;
  };

  // Anniversaires parasites dans la fenêtre → décalés hors fenêtre.
  for (const b of actifs) {
    if (estPersonnage(b)) continue;
    const dans = ecartEnJours(jour, prochainAnniversaire(b.dateNaissance, jour).date);
    if (dans <= FENETRE_ANNIVERSAIRE) {
      await db.update(s.beneficiaires).set({ dateNaissance: ajouterJours(b.dateNaissance, -10) }).where(eq(s.beneficiaires.id, b.id));
    }
  }

  // Fréquence de contact cible (E4-US4).
  const derniers = await db
    .select({ id: s.interactions.beneficiaireId, dernier: max(s.interactions.survenueLe) })
    .from(s.interactions)
    .where(eq(s.interactions.communeId, communeId))
    .groupBy(s.interactions.beneficiaireId);
  const joursDepuis = new Map(derniers.map((d) => [d.id, d.dernier ? ecartEnJours(d.dernier.toISOString().slice(0, 10), jour) : Infinity]));
  const candidats = actifs.filter((b) => !estPersonnage(b) && b.categorie === "senior" && b.modeDeVie === "seul");

  const dus = candidats.filter((b) => (joursDepuis.get(b.id) ?? Infinity) >= 20 && (joursDepuis.get(b.id) ?? Infinity) <= 60).slice(0, 2);
  const aJour = candidats.filter((b) => (joursDepuis.get(b.id) ?? Infinity) <= 10).slice(0, 4);

  if (dus.length) {
    await db.update(s.beneficiaires).set({ frequenceContactJours: 14 }).where(and(eq(s.beneficiaires.communeId, communeId), inArray(s.beneficiaires.id, dus.map((b) => b.id))));
  }
  if (aJour.length) {
    await db.update(s.beneficiaires).set({ frequenceContactJours: 30 }).where(and(eq(s.beneficiaires.communeId, communeId), inArray(s.beneficiaires.id, aJour.map((b) => b.id))));
  }
};
