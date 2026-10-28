/**
 * E15 — Cas d'usage de l'import Excel guidé (admin, permission « import »).
 * La lecture du fichier se fait dans le navigateur ; le serveur reçoit les lignes brutes, les réanalyse
 * (aucune confiance accordée au client) et crée les fiches valides.
 */
import type { Contexte } from "@/shared/application/contexte";
import { aujourdhui } from "@/shared/domain/dates";
import { exiger } from "@/shared/domain/permissions";
import { calculerScore, type GrilleScore } from "@/shared/domain/priorite";
import { extraireFaits } from "@/modules/beneficiaires/domain/faits-priorite";
import { analyserLignes, cleFoyer, type CorrespondanceValeurs, type FicheImport, type LigneAnalysee } from "../domain/analyse";
import { cleEntete, signatureFormat, type Destination } from "../domain/champs";
import type { FicheACreer, ImportRepository, MappingSauvegarde } from "./ports";

export type EntreeAnalyse = {
  entetes: string[];
  lignes: string[][];
  /** Numéro (1-based) dans le tableur de la première ligne de `lignes`. */
  premiereLigne: number;
  destinations: Destination[];
  valeurs: CorrespondanceValeurs;
};

async function analyser(deps: { imports: ImportRepository }, ctx: Contexte, e: EntreeAnalyse): Promise<LigneAnalysee[]> {
  const [existants, voiesConnues] = await Promise.all([deps.imports.fichesComparables(ctx.commune.id), deps.imports.voiesConnues(ctx.commune.id)]);
  return analyserLignes(e.lignes, e.premiereLigne, { entetes: e.entetes, destinations: e.destinations, valeurs: e.valeurs }, { existants, voiesConnues, aujourdhui: aujourdhui(ctx.maintenant) });
}

export async function previsualiserImport(deps: { imports: ImportRepository }, ctx: Contexte, e: EntreeAnalyse) {
  exiger(ctx.utilisateur.role, "import");
  return analyser(deps, ctx, e);
}

/** RG-01 : score de chaque fiche importée, à partir des informations disponibles dans le fichier. */
export function scorerFiche(f: FicheImport, jour: string, grille: GrilleScore): FicheACreer {
  const r = calculerScore(
    extraireFaits({
      beneficiaire: {
        dateNaissance: f.dateNaissance,
        modeDeVie: f.modeDeVie,
        deplacement: f.deplacement,
        protection: f.protection,
        troublesCognitifs: false,
        pasDeTelephone: !f.telephoneFixe && !f.telephoneMobile,
        retourHospitalisationLe: null,
      },
      foyer: { sousLesToits: false, pieceFraiche: null, etage: f.adresse.etage, typeLogement: null },
      cercle: f.contact ? [{ relation: f.contact.relation, possedeCles: false, ville: f.contact.ville, telephone: f.contact.telephone }] : [],
      prisesEnCharge: f.teleassistance ? [{ type: "teleassistance", possedeCles: false, dateFin: null }] : [],
      aujourdhui: jour,
    }),
    grille,
  );
  return { ...f, score: r.score, niveauPriorite: r.niveau };
}

export async function importerFiches(
  deps: { imports: ImportRepository },
  ctx: Contexte,
  e: EntreeAnalyse & { statut: "active" | "en_attente"; nomFichier: string },
) {
  exiger(ctx.utilisateur.role, "import");
  const lignes = await analyser(deps, ctx, e);
  const jour = aujourdhui(ctx.maintenant);
  const grille = await deps.imports.grilleScore(ctx.commune.id);

  const foyers = new Map<string, FicheACreer[]>();
  for (const l of lignes) {
    if (!l.fiche) continue;
    const cle = cleFoyer(l.fiche);
    foyers.set(cle, [...(foyers.get(cle) ?? []), scorerFiche(l.fiche, jour, grille)]);
  }
  const codePostal = await deps.imports.communeCodePostal(ctx.commune.id);
  const cree = await deps.imports.creerFiches(ctx.commune.id, [...foyers.values()], {
    statut: e.statut,
    auteurId: ctx.utilisateur.id,
    aujourdhui: jour,
    commune: { nom: ctx.commune.nom, codePostal },
  });

  // E15-US2 : le mapping est mémorisé pour le prochain fichier de même format.
  await deps.imports.enregistrerMapping(
    ctx.commune.id,
    {
      signature: signatureFormat(e.entetes),
      nom: e.nomFichier,
      colonnes: Object.fromEntries(e.entetes.map((h, i) => [cleEntete(h), e.destinations[i] ?? "ignorer"])),
      valeurs: e.valeurs,
    },
    ctx.utilisateur.id,
  );

  return { ...cree, rejets: lignes.filter((l) => l.erreurs.length > 0) };
}

export async function trouverMapping(deps: { imports: ImportRepository }, ctx: Contexte, entetes: string[]): Promise<MappingSauvegarde | null> {
  exiger(ctx.utilisateur.role, "import");
  return deps.imports.trouverMapping(ctx.commune.id, signatureFormat(entetes));
}
