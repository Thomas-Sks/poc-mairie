"use client";

import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Download, FileText, Phone, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formaterDateLongue, formaterHeure } from "@/shared/domain/dates";
import { ALERTE_LIBELLES, STATUT_CIBLE_LIBELLES, STATUTS_CIBLE } from "@/shared/domain/vocabulaire";
import { Bandeau, EnTetePage, Libelle, Page, Pastille, Section, Surface } from "@/shared/ui/elements";
import type { TableauDeBord } from "../application";
import { CATEGORIES_COUVERTURE, COUVERTURE_LIBELLES, COUVERTURE_TONS, tonStatut } from "../domain/tableau-de-bord";
import { BadgeIa } from "./badge-ia";
import { BoutonCloturer } from "./bouton-cloturer";
import { DialogueRepartition } from "./dialogue-repartition";
import { LienRetour } from "./lien-retour";
import { ListeCibles } from "./liste-cibles";
import { PanneauAppel } from "./panneau-appel";
import { CANAL_LIBELLES, COULEUR_TON, NIVEAU_ALERTE_LIBELLES, NIVEAU_ALERTE_TONS, nomPersonne, type Jsonifie } from "./libelles";

const CarteStatuts = dynamic(() => import("./carte-statuts").then((m) => m.CarteStatuts), {
  ssr: false,
  loading: () => <div className="h-80 bg-muted" aria-hidden />,
});

export type DonneesTableau = Jsonifie<TableauDeBord>;
export type CibleVue = DonneesTableau["cibles"][number];

export function TableauDeBordCampagne({ initial, vagueDemandee }: { initial: DonneesTableau; vagueDemandee: string | null }) {
  const id = initial.campagne.id;
  const client = useQueryClient();
  const cle = ["campagne", id, vagueDemandee];
  const { data = initial } = useQuery({
    queryKey: cle,
    queryFn: async () => {
      const r = await fetch(`/api/campagnes/${id}/tableau${vagueDemandee ? `?vague=${vagueDemandee}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error("Lecture impossible");
      return (await r.json()) as DonneesTableau;
    },
    initialData: initial,
    refetchInterval: 2500,
  });
  const rafraichir = () => client.invalidateQueries({ queryKey: cle });
  const [cibleOuverte, setCibleOuverte] = useState<string | null>(null);

  const { campagne, indicateurs, cibles, membres } = data;
  const active = campagne.statut === "active" && data.estVagueDuJour;
  const parId = new Map(cibles.map((c) => [c.id, c]));
  const prioritaires = indicateurs.prioritaires.map((p) => parId.get(p)).filter((c): c is CibleVue => Boolean(c));
  const nomMembre = (uid: string | null) => {
    const m = membres.find((x) => x.id === uid);
    return m ? `${m.prenom} ${m.nom}` : null;
  };
  const total = cibles.length;
  const ouvrir = (cibleId: string) => setCibleOuverte(cibleId);

  return (
    <Page>
      <EnTetePage
        retour={<LienRetour href="/alertes">Alertes et campagnes</LienRetour>}
        titre={campagne.nom}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {campagne.alerte && (
              <>
                {ALERTE_LIBELLES[campagne.alerte.type]}
                <Pastille ton={campagne.statut === "active" ? NIVEAU_ALERTE_TONS[campagne.alerte.niveau] : "neutre"}>
                  {NIVEAU_ALERTE_LIBELLES[campagne.alerte.niveau]}
                </Pastille>
              </>
            )}
            <span>
              {data.vague ? `Vague du ${formaterDateLongue(data.vague)}` : "Aucune vague"} · {CANAL_LIBELLES[campagne.canal]}
            </span>
          </span>
        }
        actions={
          <>
            {active && <DialogueRepartition campagneId={id} membres={membres} equipe={campagne.equipe} onFait={rafraichir} />}
            <a href={`/api/campagnes/${id}/export${data.vague ? `?vague=${data.vague}` : ""}`} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden />
              Export de secours (CSV)
            </a>
            <Link href={`/campagnes/${id}/rapport`} className={buttonVariants({ variant: "outline" })}>
              <FileText aria-hidden />
              Rapport
            </Link>
            {campagne.statut === "active" && data.peutCloturer && campagne.alerte && (
              <BoutonCloturer alerteId={campagne.alerte.id} libelle={ALERTE_LIBELLES[campagne.alerte.type]} />
            )}
          </>
        }
      />

      {campagne.statut === "cloturee" && (
        <Bandeau ton="accent">
          Campagne clôturée{campagne.dateFin ? ` le ${formaterDateLongue(campagne.dateFin)}` : ""} : consultation seule.{" "}
          <Link href={`/campagnes/${id}/rapport`} className="underline underline-offset-4">
            Voir le rapport
          </Link>
        </Bandeau>
      )}
      {indicateurs.ia > 0 && (
        <Bandeau ton="accent" className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Bot className="size-5 shrink-0" aria-hidden />
            Démonstration : les appels IA affichés sont fictifs. Cette fonctionnalité est une évolution à venir.
          </span>
          <Link href={`/campagnes/${id}/reglages-ia`} className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4">
            <Settings2 className="size-4" aria-hidden />
            Réglages IA
          </Link>
        </Bandeau>
      )}

      {data.vagues.length > 1 && (
        <nav aria-label="Vagues de la campagne" className="flex flex-wrap items-center gap-2">
          <Libelle className="mr-1">Vagues</Libelle>
          {data.vagues.map((v) => (
            <Link
              key={v}
              href={`/campagnes/${id}?vague=${v}`}
              aria-current={v === data.vague ? "page" : undefined}
              className={buttonVariants({ variant: v === data.vague ? "secondary" : "ghost", size: "default" })}
            >
              {v.split("-").reverse().slice(0, 2).join("/")}
            </Link>
          ))}
        </nav>
      )}

      {prioritaires.length > 0 && (
        <Surface aria-labelledby="titre-priorites" className="border-err">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <h2 id="titre-priorites" className="text-xl font-semibold text-err">
              À traiter en priorité ({prioritaires.length})
            </h2>
          </div>
          <ul className="divide-y px-5">
            {prioritaires.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{nomPersonne(c)}</span>
                    <Pastille ton={tonStatut(c.statut)}>
                      {c.statut === "escalade_humain" && c.canal === "ia" ? "Escaladé par l'IA" : STATUT_CIBLE_LIBELLES[c.statut]}
                    </Pastille>
                    {c.canal === "ia" && <BadgeIa />}
                  </div>
                  <span className="text-muted-foreground">
                    {c.telephone && (
                      <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className="tabular underline-offset-4 hover:underline">
                        {c.telephone}
                      </a>
                    )}
                    {c.telephone && " · "}
                    {c.adresse}
                  </span>
                  {c.note && <span>{c.note}</span>}
                  {c.verrouActif && <span className="text-sm font-semibold text-primary">En cours d&apos;appel par {nomMembre(c.verrouPar)}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.appelIaId && (
                    <Link href={`/campagnes/${id}/appels-ia/${c.appelIaId}`} className={buttonVariants({ variant: "outline" })}>
                      Voir l&apos;appel IA
                    </Link>
                  )}
                  {active && (
                    <Button onClick={() => ouvrir(c.id)}>
                      <Phone aria-hidden />
                      Traiter
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface aria-labelledby="titre-couverture" className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titre-couverture" className="text-xl font-semibold">
            Couverture du jour
          </h2>
          <span className="text-sm text-muted-foreground">
            {total} personnes · mis à jour à {formaterHeure(new Date(data.maintenant))}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          {CATEGORIES_COUVERTURE.map((cat) => (
            <li key={cat} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: COULEUR_TON[COUVERTURE_TONS[cat]] }} aria-hidden />
                {COUVERTURE_LIBELLES[cat]}
              </span>
              <span className={cn("text-3xl font-bold tabular", cat === "danger" && indicateurs.couverture[cat] > 0 && "text-err")}>
                {indicateurs.couverture[cat]}
              </span>
            </li>
          ))}
        </ul>
        {total > 0 && (
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Répartition de la couverture du jour">
            {CATEGORIES_COUVERTURE.map((cat) => (
              <span key={cat} style={{ width: `${(indicateurs.couverture[cat] / total) * 100}%`, background: COULEUR_TON[COUVERTURE_TONS[cat]] }} />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 border-t pt-4">
          <Libelle>Détail par statut</Libelle>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]">
            <span>
              En cours d&apos;appel : <strong className="tabular">{indicateurs.enCours}</strong>
            </span>
            {STATUTS_CIBLE.filter((s) => indicateurs.statuts[s]).map((s) => (
              <span key={s}>
                {STATUT_CIBLE_LIBELLES[s]} : <strong className="tabular">{indicateurs.statuts[s]}</strong>
              </span>
            ))}
          </p>
        </div>
      </Surface>

      <div className="grid gap-8 lg:grid-cols-2">
        <Surface aria-labelledby="titre-progression" className="flex flex-col gap-4 p-5">
          <h2 id="titre-progression" className="text-xl font-semibold">
            Progression par appelant
          </h2>
          {indicateurs.progression.length === 0 ? (
            <p className="text-muted-foreground">Aucun appel n&apos;est encore assigné. Utilisez « Répartir les appels ».</p>
          ) : (
            <ul className="divide-y">
              {indicateurs.progression.map((p) => {
                const pct = Math.round((p.traitees / p.total) * 100);
                return (
                  <li key={p.utilisateurId} className="flex flex-col gap-2 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{nomMembre(p.utilisateurId) ?? "Utilisateur inconnu"}</span>
                      <span className="tabular text-muted-foreground">
                        {p.traitees} / {p.total} traités
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression de ${nomMembre(p.utilisateurId)}`}>
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
        <Surface aria-labelledby="titre-carte" className="flex flex-col gap-4 overflow-hidden pt-5">
          <h2 id="titre-carte" className="px-5 text-xl font-semibold">
            Carte des statuts
          </h2>
          <CarteStatuts cibles={cibles} />
        </Surface>
      </div>

      <Section titre="Liste d'appel">
        <ListeCibles
          campagneId={id}
          cibles={cibles}
          membres={membres}
          active={active}
          nbTentativesMax={campagne.relance.nbTentatives}
          onTraiter={ouvrir}
          onChange={rafraichir}
        />
      </Section>

      <PanneauAppel
        cibleId={cibleOuverte}
        cible={cibleOuverte ? (parId.get(cibleOuverte) ?? null) : null}
        onFermer={() => {
          setCibleOuverte(null);
          rafraichir();
        }}
        onEnregistre={rafraichir}
      />
    </Page>
  );
}
