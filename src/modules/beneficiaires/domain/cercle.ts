/**
 * E2 — Cercle de proches : tri par rang d'appel (vue liste, E2-US4) et disposition du graphe radial (E2-US3).
 * Distance au centre = rang d'appel ; couleur = famille de relation.
 */
import { GROUPE_DE_RELATION, type GroupeRelation, type Relation } from "@/shared/domain/vocabulaire";

export type MembreCercle = {
  lienId: string;
  contactId: string;
  prenom: string | null;
  nom: string;
  relation: Relation;
  rangAppel: number;
};

export function trierParRang<T extends { rangAppel: number }>(membres: T[], nomDe: (m: T) => string): T[] {
  return [...membres].sort((a, b) => a.rangAppel - b.rangAppel || nomDe(a).localeCompare(nomDe(b), "fr"));
}

export const GROUPE_LIBELLES: Record<GroupeRelation, string> = {
  famille: "Famille",
  voisinage: "Voisinage et amis",
  sante: "Professionnels de santé",
  aide: "Aide à domicile",
  institution: "Institutions et autres",
};

export function groupeDe(relation: Relation): GroupeRelation {
  return GROUPE_DE_RELATION[relation];
}

/** Rang d'appel suivant à proposer pour un nouveau contact. */
export function rangSuivant(membres: Pick<MembreCercle, "rangAppel">[]): number {
  return membres.reduce((max, m) => Math.max(max, m.rangAppel), 0) + 1;
}

export type NoeudGraphe<T> = { membre: T; x: number; y: number; anneau: number };

export type DispositionGraphe<T> = {
  taille: number;
  centre: number;
  anneaux: number[]; // rayons des anneaux, du rang le plus faible au plus éloigné
  libellesAnneaux: string[];
  noeuds: NoeudGraphe<T>[];
};

/**
 * Place les contacts sur des anneaux concentriques (anneau = rang d'appel, plafonné à `anneauxMax`).
 * Sur chaque anneau, les nœuds sont répartis régulièrement, avec un décalage d'un anneau à l'autre
 * pour éviter que les étiquettes ne s'alignent.
 */
export function disposerGraphe<T extends Pick<MembreCercle, "rangAppel" | "nom">>(
  membres: T[],
  { taille = 520, anneauxMax = 4 }: { taille?: number; anneauxMax?: number } = {},
): DispositionGraphe<T> {
  const centre = taille / 2;
  const tries = trierParRang(membres, (m) => m.nom);
  // Un anneau par rang effectivement utilisé (les rangs « troués » 1, 2, 9 donnent 3 anneaux).
  const rangs = [...new Set(tries.map((m) => m.rangAppel))];
  const nbAnneaux = Math.max(1, Math.min(anneauxMax, rangs.length));
  const rayonMin = taille * 0.2;
  const rayonMax = taille * 0.4;
  const pas = nbAnneaux > 1 ? (rayonMax - rayonMin) / (nbAnneaux - 1) : 0;
  const anneaux = Array.from({ length: nbAnneaux }, (_, i) => rayonMin + i * pas);
  const libellesAnneaux = anneaux.map((_, i) =>
    i === nbAnneaux - 1 && rangs.length > nbAnneaux ? `Rang ${rangs[i]} et +` : `Rang ${rangs[i] ?? i + 1}`,
  );

  const parAnneau = new Map<number, T[]>();
  for (const m of tries) {
    const anneau = Math.min(rangs.indexOf(m.rangAppel) + 1, nbAnneaux);
    parAnneau.set(anneau, [...(parAnneau.get(anneau) ?? []), m]);
  }

  const noeuds: NoeudGraphe<T>[] = [];
  for (const [anneau, liste] of parAnneau) {
    const rayon = anneaux[anneau - 1];
    // Départ décalé de l'axe vertical (où sont écrits les libellés d'anneaux), puis décalage d'un anneau à l'autre.
    const decalage = Math.PI / 6 + (anneau - 1) * (Math.PI / 5);
    liste.forEach((membre, i) => {
      const angle = -Math.PI / 2 + decalage + (2 * Math.PI * i) / liste.length;
      noeuds.push({
        membre,
        anneau,
        x: Math.round((centre + rayon * Math.cos(angle)) * 10) / 10,
        y: Math.round((centre + rayon * Math.sin(angle)) * 10) / 10,
      });
    });
  }
  return { taille, centre, anneaux, libellesAnneaux, noeuds };
}
