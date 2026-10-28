/**
 * Cas d'usage de l'écran « Appel » (E10-US4 à US7) : ouverture, verrou, résultats, demandes.
 * Chaque cas d'usage revérifie le rôle ET l'appartenance de la personne au bénévole (RG-07).
 */
import type { Contexte } from "@/shared/application/contexte";
import type { Besoin } from "@/shared/domain/vocabulaire";
import type { ResultatAppel, ResultatProche } from "../domain/issue-appel";
import { evaluerReponses, filtrerReponses } from "../domain/questions";
import { nomPrononce, rendreTexte, type ScriptAppel } from "../domain/script";
import { ficheAccessible } from "./acces";
import type { FicheAppel, IssueEnregistrement, JournalAppels, LectureBenevole } from "./ports";

type Deps = { lecture: LectureBenevole; journal: JournalAppels };

export type EcranAppel = Omit<FicheAppel, "script"> & {
  /** Script avec les variables déjà injectées. */
  script: ScriptAppel;
  structure: { nom: string; telephone: string };
};

export async function ouvrirAppel(deps: Pick<Deps, "lecture">, ctx: Contexte, cibleId: string): Promise<EcranAppel> {
  const fiche = await ficheAccessible(deps.lecture, ctx, cibleId);
  const variables = {
    civilite: fiche.civilite,
    nom: nomPrononce(fiche.nom),
    prenom: fiche.prenom,
    prenomAppelant: ctx.utilisateur.prenom,
    structure: ctx.commune.structureNom,
    commune: ctx.commune.nom,
  };
  const r = (t: string) => rendreTexte(t, variables);
  const s = fiche.script;
  return {
    ...fiche,
    script: {
      ...s,
      introduction: r(s.introduction),
      conclusion: r(s.conclusion),
      questions: s.questions.map((q) => ({ ...q, texte: r(q.texte), consigne: q.consigne && r(q.consigne) })),
    },
    structure: { nom: ctx.commune.structureNom, telephone: ctx.commune.structureTelephone },
  };
}

export async function prendreVerrou(deps: Deps, ctx: Contexte, cibleId: string): Promise<boolean> {
  await ficheAccessible(deps.lecture, ctx, cibleId);
  return deps.journal.prendreVerrou(ctx.commune.id, cibleId, ctx.utilisateur.id, ctx.maintenant);
}

export async function libererVerrou(deps: Deps, ctx: Contexte, cibleId: string): Promise<void> {
  await ficheAccessible(deps.lecture, ctx, cibleId);
  await deps.journal.libererVerrou(ctx.commune.id, cibleId, ctx.utilisateur.id);
}

const appelant = (ctx: Contexte) => ({ id: ctx.utilisateur.id, prenom: ctx.utilisateur.prenom, nom: ctx.utilisateur.nom });

export type EntreeResultat = {
  idOperation: string;
  cibleId: string;
  resultat: ResultatAppel;
  reponses: Record<string, unknown>;
  besoins: Besoin[];
  note: string | null;
  precision: string | null;
};

export async function enregistrerResultat(deps: Deps, ctx: Contexte, e: EntreeResultat): Promise<IssueEnregistrement> {
  const fiche = await ficheAccessible(deps.lecture, ctx, e.cibleId);
  // Les conséquences des réponses (tag isolement, besoins) sont recalculées ici, pas reçues du navigateur.
  const reponses = filtrerReponses(fiche.script.questions, e.reponses);
  const evaluation = evaluerReponses(fiche.script.questions, reponses);
  const besoins =
    e.resultat === "besoin" ? [...new Set<Besoin>([...e.besoins, ...evaluation.besoins])] : [];
  return deps.journal.enregistrerResultat({
    idOperation: e.idOperation,
    communeId: ctx.commune.id,
    appelant: appelant(ctx),
    cibleId: e.cibleId,
    maintenant: ctx.maintenant,
    resultat: e.resultat,
    reponses,
    besoins,
    tags: evaluation.tags,
    note: e.note,
    precision: e.precision,
  });
}

export type EntreeProche = { idOperation: string; cibleId: string; lienId: string; resultat: ResultatProche; note: string | null };

export async function enregistrerResultatProche(deps: Deps, ctx: Contexte, e: EntreeProche): Promise<IssueEnregistrement> {
  const fiche = await ficheAccessible(deps.lecture, ctx, e.cibleId);
  // RG-07 : seul un proche du cercle de cette personne peut être concerné.
  if (!fiche.cercle.some((p) => p.lienId === e.lienId)) throw new Error("Proche inconnu pour cette personne.");
  return deps.journal.enregistrerResultatProche({
    idOperation: e.idOperation,
    communeId: ctx.commune.id,
    appelant: appelant(ctx),
    cibleId: e.cibleId,
    maintenant: ctx.maintenant,
    lienId: e.lienId,
    resultat: e.resultat,
    note: e.note,
  });
}

export type EntreeDemande = { idOperation: string; cibleId: string; nature: "visite" | "info"; sujet: string | null };

export async function creerDemande(deps: Deps, ctx: Contexte, e: EntreeDemande): Promise<void> {
  await ficheAccessible(deps.lecture, ctx, e.cibleId);
  if (e.nature === "info" && !e.sujet?.trim()) throw new Error("Précisez le sujet de la demande.");
  await deps.journal.creerDemande({
    idOperation: e.idOperation,
    communeId: ctx.commune.id,
    appelant: appelant(ctx),
    cibleId: e.cibleId,
    maintenant: ctx.maintenant,
    nature: e.nature,
    sujet: e.sujet?.trim() || null,
  });
}
