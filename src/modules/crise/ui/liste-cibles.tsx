"use client";

import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Phone, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formaterHeure } from "@/shared/domain/dates";
import { STATUT_CIBLE_LIBELLES } from "@/shared/domain/vocabulaire";
import { EtatVide, Pastille, PastillePriorite, Surface } from "@/shared/ui/elements";
import { estTraitee, tonStatut } from "../domain/tableau-de-bord";
import { assignerAction, reintegrerAction } from "./actions";
import type { CibleVue, DonneesTableau } from "./tableau-de-bord";
import { BadgeIa } from "./badge-ia";
import { nomPersonne } from "./libelles";

type Filtre = "a_traiter" | "traitees" | "exclues" | "toutes";

const FILTRES: { valeur: Filtre; libelle: string; garde: (c: CibleVue) => boolean }[] = [
  { valeur: "a_traiter", libelle: "À appeler", garde: (c) => !c.exclue && !estTraitee(c.statut) },
  { valeur: "traitees", libelle: "Traitées", garde: (c) => !c.exclue && estTraitee(c.statut) },
  { valeur: "exclues", libelle: "Exclues (couvertes)", garde: (c) => c.exclue },
  { valeur: "toutes", libelle: "Toutes", garde: () => true },
];

type Props = {
  campagneId: string;
  cibles: CibleVue[];
  membres: DonneesTableau["membres"];
  active: boolean;
  nbTentativesMax: number;
  onTraiter: (cibleId: string) => void;
  onChange: () => void;
};

/** Lignes affichées d'un coup : la liste complète d'une canicule (150 personnes) rendrait l'écran interminable. */
const PAR_PAGE = 25;

export function ListeCibles({ campagneId, cibles, membres, active, nbTentativesMax, onTraiter, onChange }: Props) {
  const [filtre, setFiltre] = useState<Filtre>("a_traiter");
  const [nbAffichees, setNbAffichees] = useState(PAR_PAGE);
  const garde = FILTRES.find((f) => f.valeur === filtre)!.garde;
  const correspondantes = cibles.filter(garde);
  const visibles = correspondantes.slice(0, nbAffichees);
  const restantes = correspondantes.length - visibles.length;
  const appelants = membres.filter((m) => m.role !== "admin" && m.role !== "super_admin");
  const nomMembre = (uid: string | null) => {
    const m = membres.find((x) => x.id === uid);
    return m ? `${m.prenom} ${m.nom}` : null;
  };

  const assigner = async (cibleId: string, utilisateurId: string) => {
    const r = await assignerAction(campagneId, cibleId, utilisateurId || null);
    if (!r.ok) toast.error(r.erreur);
    onChange();
  };
  const reintegrer = async (c: CibleVue) => {
    const r = await reintegrerAction(c.id);
    if (!r.ok) toast.error(r.erreur);
    else toast.success(`${nomPersonne(c)} est réintégré(e) dans la liste d'appel.`);
    onChange();
  };

  const detail = (c: CibleVue) => {
    if (c.verrouActif && !estTraitee(c.statut))
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
          <Lock className="size-4" aria-hidden />
          En cours d&apos;appel par {nomMembre(c.verrouPar)}
        </span>
      );
    if (c.exclue) return <span className="text-muted-foreground">{c.motifExclusion}</span>;
    if (c.motifExclusion) return <span className="text-muted-foreground">Réintégré(e) · {c.motifExclusion}</span>;
    const morceaux: string[] = [];
    if (c.nbTentatives > 0 && !estTraitee(c.statut)) morceaux.push(`Tentative ${c.nbTentatives}/${nbTentativesMax}`);
    if (c.prochaineTentativeAt && !estTraitee(c.statut)) morceaux.push(`rappel à ${formaterHeure(new Date(c.prochaineTentativeAt))}`);
    if (c.note && estTraitee(c.statut)) morceaux.push(c.note);
    return morceaux.length ? <span className="text-muted-foreground">{morceaux.join(" · ")}</span> : null;
  };

  const actions = (c: CibleVue) => (
    <div className="flex flex-wrap justify-end gap-2">
      {c.appelIaId && (
        <Link href={`/campagnes/${campagneId}/appels-ia/${c.appelIaId}`} className={buttonVariants({ variant: "ghost" })}>
          Appel IA
        </Link>
      )}
      {active && c.exclue && (
        <Button variant="outline" onClick={() => reintegrer(c)}>
          <Undo2 aria-hidden />
          Réintégrer
        </Button>
      )}
      {active && !c.exclue && (
        <Button variant={estTraitee(c.statut) ? "ghost" : "outline"} onClick={() => onTraiter(c.id)}>
          <Phone aria-hidden />
          {estTraitee(c.statut) ? "Modifier" : "Traiter"}
        </Button>
      )}
    </div>
  );

  const selectAppelant = (c: CibleVue) =>
    active && !c.exclue && c.canal === "humain" ? (
      <select
        aria-label={`Appelant pour ${nomPersonne(c)}`}
        className="h-11 w-full min-w-36 rounded-lg border border-input bg-card px-2 text-[0.9375rem]"
        value={c.assigneA ?? ""}
        onChange={(e) => assigner(c.id, e.target.value)}
      >
        <option value="">Non assigné</option>
        {appelants.map((m) => (
          <option key={m.id} value={m.id}>
            {m.prenom} {m.nom}
          </option>
        ))}
      </select>
    ) : (
      <span className="text-muted-foreground">{c.canal === "ia" ? "Agent IA" : (nomMembre(c.assigneA) ?? "—")}</span>
    );

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Filtrer la liste" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Button
            key={f.valeur}
            variant={filtre === f.valeur ? "secondary" : "ghost"}
            aria-pressed={filtre === f.valeur}
            onClick={() => {
              setFiltre(f.valeur);
              setNbAffichees(PAR_PAGE);
            }}
          >
            {f.libelle}
            <span className="tabular text-muted-foreground">{cibles.filter(f.garde).length}</span>
          </Button>
        ))}
      </div>

      <Surface>
        {visibles.length === 0 ? (
          <div className="px-5">
            <EtatVide titre="Personne dans cette catégorie" />
          </div>
        ) : (
          <>
            {/* Tablette et desktop : tableau */}
            <div className="max-md:hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 pl-5">#</TableHead>
                    <TableHead>Personne</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-44">Appelant</TableHead>
                    <TableHead className="pr-5 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((c) => (
                    <TableRow key={c.id} className={cn(c.exclue && "text-muted-foreground")}>
                      <TableCell className="pl-5 align-top tabular text-muted-foreground">{c.rang}</TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{nomPersonne(c)}</span>
                            <PastillePriorite niveau={c.niveau} score={c.score} />
                            {c.canal === "ia" && <BadgeIa />}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {c.telephone && <span className="tabular">{c.telephone} · </span>}
                            {c.adresse}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <div className="flex flex-col items-start gap-1">
                          <Pastille ton={tonStatut(c.statut)}>{STATUT_CIBLE_LIBELLES[c.statut]}</Pastille>
                          <span className="text-sm">{detail(c)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{selectAppelant(c)}</TableCell>
                      <TableCell className="pr-5 align-top">{actions(c)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile : liste */}
            <ul className="divide-y md:hidden">
              {visibles.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-muted-foreground">{c.rang}.</span>
                    <span className="font-semibold">{nomPersonne(c)}</span>
                    <PastillePriorite niveau={c.niveau} />
                    {c.canal === "ia" && <BadgeIa />}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {c.telephone && <span className="tabular">{c.telephone} · </span>}
                    {c.adresse}
                  </span>
                  <div className="flex flex-col items-start gap-1">
                    <Pastille ton={tonStatut(c.statut)}>{STATUT_CIBLE_LIBELLES[c.statut]}</Pastille>
                    <span className="text-sm">{detail(c)}</span>
                  </div>
                  {selectAppelant(c)}
                  <div className="[&>div]:justify-start">{actions(c)}</div>
                </li>
              ))}
            </ul>
            {restantes > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
                <span className="text-muted-foreground">
                  {visibles.length} sur {correspondantes.length}
                </span>
                <Button variant="outline" onClick={() => setNbAffichees((n) => n + PAR_PAGE)}>
                  Afficher {Math.min(PAR_PAGE, restantes)} de plus
                </Button>
              </div>
            )}
          </>
        )}
      </Surface>
    </div>
  );
}
