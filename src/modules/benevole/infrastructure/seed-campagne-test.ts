/**
 * Données de développement du module bénévole : une campagne canicule ACTIVE dont 6 personnes
 * sont assignées à Marc Petit (dont « Mme X », et « M. Y » qui a un enfant en rang 1 du cercle).
 *
 * DÉSACTIVÉE par défaut : la démo réelle commence sans alerte (l'admin déclenche en direct).
 * Activation : `SEED_CAMPAGNE_TEST=1 pnpm db:seed`.
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { RELANCE_PAR_DEFAUT } from "@/shared/domain/campagne";
import type { ContexteSeed, ExtensionSeed } from "@/shared/infrastructure/seed/extensions";
import * as s from "@/shared/infrastructure/db/schema";
import { SCRIPT_CANICULE } from "@/modules/crise/domain/scripts-par-defaut";

export const NOM_CAMPAGNE_TEST = "Canicule (test bénévole)";

export const seedCampagneTestBenevole: ExtensionSeed = async (db, ctx: ContexteSeed) => {
  const marc = ctx.utilisateurs.find((u) => u.role === "benevole" && u.prenom === "Marc");
  const lucie = ctx.utilisateurs.find((u) => u.role === "benevole" && u.prenom === "Lucie");
  const admin = ctx.utilisateurs.find((u) => u.role === "admin");
  if (!marc || !admin) return;

  const actifs = ctx.beneficiaires.filter((b) => b.statut === "active" && !b.pasDeTelephone && (b.telephoneFixe || b.telephoneMobile));

  // « M. Y » : un homme dont le proche de rang 1 est un enfant joignable.
  const liensEnfant = await db
    .select({ beneficiaireId: s.liensCercle.beneficiaireId })
    .from(s.liensCercle)
    .innerJoin(s.contacts, eq(s.contacts.id, s.liensCercle.contactId))
    .where(
      and(
        eq(s.liensCercle.rangAppel, 1),
        eq(s.liensCercle.relation, "enfant"),
        isNotNull(s.contacts.telephone),
        inArray(s.liensCercle.beneficiaireId, actifs.map((b) => b.id)),
      ),
    );
  const avecEnfant = new Set(liensEnfant.map((l) => l.beneficiaireId));
  const monsieurY = actifs.find((b) => b.civilite === "M." && avecEnfant.has(b.id) && b.niveauPriorite !== "P3") ?? actifs.find((b) => b.civilite === "M." && avecEnfant.has(b.id));
  // « Mme X » : une femme prioritaire, avec une information prioritaire si possible.
  const madameX =
    actifs.find((b) => b.civilite === "Mme" && b.niveauPriorite === "P1" && b.infoPrioritaire) ??
    actifs.find((b) => b.civilite === "Mme" && b.niveauPriorite === "P1");
  const choisis = [madameX, monsieurY].filter((b) => b !== undefined);
  const autres = actifs.filter((b) => !choisis.includes(b)).slice(0, 4);
  const pourMarc = [...choisis, ...autres];
  const pourLucie = actifs.filter((b) => !pourMarc.includes(b)).slice(0, 3);

  const [alerte] = await db
    .insert(s.alertes)
    .values({
      communeId: ctx.communeId,
      type: "canicule",
      niveau: "rouge",
      debut: ctx.jour,
      perimetre: "Toute la commune",
      message: "Campagne de test du module bénévole.",
      declencheePar: admin.id,
    })
    .returning();
  const [campagne] = await db
    .insert(s.campagnes)
    .values({
      communeId: ctx.communeId,
      alerteId: alerte.id,
      nom: NOM_CAMPAGNE_TEST,
      type: "canicule",
      script: SCRIPT_CANICULE,
      frequence: "quotidienne",
      canal: "humain",
      relance: RELANCE_PAR_DEFAUT,
      source: { type: "tous" },
      beneficiaireIds: [...pourMarc, ...pourLucie].map((b) => b.id),
      equipe: [marc.id, ...(lucie ? [lucie.id] : [])],
      dateDebut: ctx.jour,
    })
    .returning();
  await db.insert(s.ciblesCampagne).values([
    ...pourMarc.map((b) => ({ campagneId: campagne.id, beneficiaireId: b.id, vagueDate: ctx.jour, assigneA: marc.id })),
    ...pourLucie.map((b) => ({ campagneId: campagne.id, beneficiaireId: b.id, vagueDate: ctx.jour, assigneA: lucie?.id ?? null })),
  ]);
};
