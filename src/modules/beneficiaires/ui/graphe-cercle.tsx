"use client";
/**
 * E2-US3 — Graphe radial du cercle (SVG maison) : bénéficiaire au centre, distance = rang d'appel,
 * couleur = famille de relation. Un clic sur un nœud affiche ses coordonnées et un bouton « Appeler ».
 */
import { useState } from "react";
import { KeyRound, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RELATION_LIBELLES, type GroupeRelation, type Relation } from "@/shared/domain/vocabulaire";
import { disposerGraphe, GROUPE_LIBELLES, groupeDe } from "../domain/cercle";

export type NoeudCercle = {
  lienId: string;
  nom: string;
  prenom: string | null;
  relation: Relation;
  rangAppel: number;
  structure: string | null;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  ville: string | null;
  disponibilites: string | null;
  possedeCles: boolean;
  estUrgence: boolean;
};

/** Couleurs du graphe : l'accent et ses déclinaisons sobres (tokens --chart-*). */
const COULEURS: Record<GroupeRelation, { fond: string; texte: string }> = {
  famille: { fond: "var(--chart-1)", texte: "#ffffff" },
  voisinage: { fond: "var(--chart-2)", texte: "#ffffff" },
  sante: { fond: "var(--chart-4)", texte: "#ffffff" },
  aide: { fond: "var(--chart-3)", texte: "var(--foreground)" },
  institution: { fond: "var(--chart-5)", texte: "#ffffff" },
};

const initiales = (n: NoeudCercle) => `${n.prenom?.[0] ?? ""}${n.nom[0] ?? ""}`.toUpperCase();
const nomAffiche = (n: NoeudCercle) => [n.prenom, n.nom].filter(Boolean).join(" ");
const tel = (numero: string) => `tel:${numero.replace(/\s/g, "")}`;

export function GrapheCercle({ noeuds, centre }: { noeuds: NoeudCercle[]; centre: string }) {
  const [selection, setSelection] = useState<string | null>(noeuds[0]?.lienId ?? null);
  const g = disposerGraphe(noeuds, { taille: 520, anneauxMax: 4 });
  const choisi = noeuds.find((n) => n.lienId === selection) ?? null;
  const groupesPresents = [...new Set(noeuds.map((n) => groupeDe(n.relation)))];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-4">
        <svg viewBox={`0 0 ${g.taille} ${g.taille}`} className="mx-auto w-full max-w-[520px]" role="group" aria-label={`Cercle de ${centre}`}>
          {g.anneaux.map((r, i) => (
            <g key={r}>
              <circle cx={g.centre} cy={g.centre} r={r} fill="none" stroke="var(--border)" strokeDasharray="4 6" />
              <text x={g.centre} y={g.centre + r - 6} textAnchor="middle" fontSize="12" fill="var(--subtle-foreground)">
                {g.libellesAnneaux[i]}
              </text>
            </g>
          ))}
          {g.noeuds.map((n) => (
            <line key={`l-${n.membre.lienId}`} x1={g.centre} y1={g.centre} x2={n.x} y2={n.y} stroke="var(--input)" strokeWidth={1.5} />
          ))}
          <circle cx={g.centre} cy={g.centre} r={34} fill="var(--foreground)" />
          <text x={g.centre} y={g.centre + 5} textAnchor="middle" fontSize="14" fontWeight="600" fill="#ffffff">
            {centre}
          </text>
          {g.noeuds.map((n) => {
            const m = n.membre;
            const couleur = COULEURS[groupeDe(m.relation)];
            const actif = m.lienId === selection;
            return (
              <g
                key={m.lienId}
                role="button"
                tabIndex={0}
                aria-pressed={actif}
                aria-label={`${nomAffiche(m)}, ${RELATION_LIBELLES[m.relation]}, rang ${m.rangAppel}${m.possedeCles ? ", possède les clés" : ""}`}
                onClick={() => setSelection(m.lienId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelection(m.lienId);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--ring)]"
              >
                <circle cx={n.x} cy={n.y} r={actif ? 29 : 25} fill="var(--card)" stroke={actif ? "var(--primary)" : "transparent"} strokeWidth={3} />
                <circle cx={n.x} cy={n.y} r={22} fill={couleur.fond} />
                <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="14" fontWeight="600" fill={couleur.texte}>
                  {initiales(m)}
                </text>
                {m.possedeCles && (
                  <g transform={`translate(${n.x + 12}, ${n.y - 30})`}>
                    <circle cx={8} cy={8} r={10} fill="var(--card)" stroke="var(--border)" />
                    <KeyRound x={2} y={2} width={12} height={12} color="var(--primary)" aria-hidden />
                  </g>
                )}
                <text x={n.x} y={n.y + 42} textAnchor="middle" fontSize="13" fontWeight={actif ? 700 : 500} fill="var(--foreground)">
                  {m.prenom ?? m.nom}
                </text>
              </g>
            );
          })}
        </svg>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Légende">
          {groupesPresents.map((gr) => (
            <li key={gr} className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: COULEURS[gr].fond }} aria-hidden />
              {GROUPE_LIBELLES[gr]}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Possède les clés
          </li>
        </ul>
      </div>

      <div aria-live="polite" className="flex flex-col gap-4 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        {choisi ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">{nomAffiche(choisi)}</p>
              <p className="text-muted-foreground">
                {RELATION_LIBELLES[choisi.relation]} · rang {choisi.rangAppel}
                {choisi.structure && ` · ${choisi.structure}`}
              </p>
            </div>
            {(choisi.possedeCles || choisi.estUrgence) && (
              <ul className="flex flex-col gap-1 text-[0.9375rem]">
                {choisi.possedeCles && (
                  <li className="flex items-center gap-2">
                    <KeyRound className="size-4 text-primary" aria-hidden />
                    Possède les clés
                  </li>
                )}
                {choisi.estUrgence && <li>Personne à prévenir en cas d&apos;urgence</li>}
              </ul>
            )}
            <dl className="grid gap-2 text-[0.9375rem]">
              {choisi.telephone && (
                <div>
                  <dt className="text-sm text-muted-foreground">Téléphone</dt>
                  <dd className="tabular font-medium">{choisi.telephone}</dd>
                </div>
              )}
              {choisi.telephone2 && (
                <div>
                  <dt className="text-sm text-muted-foreground">Autre téléphone</dt>
                  <dd className="tabular font-medium">{choisi.telephone2}</dd>
                </div>
              )}
              {choisi.email && (
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="break-all">{choisi.email}</dd>
                </div>
              )}
              {choisi.ville && (
                <div>
                  <dt className="text-sm text-muted-foreground">Ville</dt>
                  <dd>{choisi.ville}</dd>
                </div>
              )}
              {choisi.disponibilites && (
                <div>
                  <dt className="text-sm text-muted-foreground">Disponibilités</dt>
                  <dd>{choisi.disponibilites}</dd>
                </div>
              )}
            </dl>
            {choisi.telephone && (
              <Button variant="outline" nativeButton={false} render={<a href={tel(choisi.telephone)} />} className={cn("w-full")}>
                <Phone aria-hidden />
                Appeler {choisi.prenom ?? choisi.nom}
              </Button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Choisissez une personne dans le graphe pour voir ses coordonnées.</p>
        )}
      </div>
    </div>
  );
}
