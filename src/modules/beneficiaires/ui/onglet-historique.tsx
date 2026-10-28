/**
 * Onglet « Historique » : rappels à venir (E4-US2) et timeline filtrable par type et par période (E3-US2),
 * interactions de campagne mises en évidence, modifications de la fiche (E1-US3).
 */
import Link from "next/link";
import {
  Bell,
  Bot,
  ChevronRight,
  History,
  House,
  Mail,
  Megaphone,
  MessageSquare,
  Phone,
  PhoneIncoming,
  Send,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { aujourdhui, formaterDate, formaterDateHeure } from "@/shared/domain/dates";
import { BESOIN_LIBELLES, INTERACTION_LIBELLES, STATUT_CIBLE_LIBELLES, TYPES_INTERACTION, type TypeInteraction } from "@/shared/domain/vocabulaire";
import { Pastille, Section, Surface } from "@/shared/ui/elements";
import { cn } from "@/lib/utils";
import { filtrerTimeline, PERIODE_LIBELLES, PERIODES, type FiltreType, type Periode } from "../domain/journal";
import type { InteractionVue, ModificationVue } from "../application/ports";
import { casDUsage } from "../infrastructure";
import { marquerRappelFaitAction } from "./actions";
import { BoutonAction } from "./bouton-action";
import { chargerFiche } from "./cadre-fiche";
import { tonResultat } from "./libelles";

const ICONES: Record<TypeInteraction, LucideIcon> = {
  appel_sortant: Phone,
  appel_entrant: PhoneIncoming,
  visite: House,
  sms: MessageSquare,
  email: Mail,
  courrier: Send,
  appel_ia: Bot,
  passage_intervenant: UserCheck,
};

const FILTRES_TYPE: { valeur: FiltreType; libelle: string }[] = [
  { valeur: "tous", libelle: "Tout" },
  { valeur: "campagne", libelle: "Interactions de campagne d'alerte" },
  ...TYPES_INTERACTION.map((t) => ({ valeur: t, libelle: INTERACTION_LIBELLES[t] })),
  { valeur: "modification", libelle: "Modifications de la fiche" },
];

type Evenement =
  | { genre: "interaction"; type: TypeInteraction; date: Date; campagneId: string | null; interaction: InteractionVue }
  | { genre: "modification"; type: null; date: Date; campagneId: null; modifications: ModificationVue[]; auteur: string | null };

/** Les changements enregistrés ensemble (même instant, même auteur) forment un seul événement. */
function regrouperModifications(modifications: ModificationVue[]): Evenement[] {
  const groupes = new Map<string, ModificationVue[]>();
  for (const m of modifications) {
    const cle = `${Math.floor(m.at.getTime() / 1000)}|${m.auteur ?? ""}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), m]);
  }
  return [...groupes.values()].map((liste) => ({ genre: "modification", type: null, date: liste[0].at, campagneId: null, modifications: liste, auteur: liste[0].auteur }));
}

const CLASSE_SELECT =
  "h-11 w-full rounded-lg border border-input bg-card px-3 pr-8 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto";

export async function OngletHistorique({ id, type, periode }: { id: string; type?: string; periode?: string }) {
  const { ctx, droits } = await chargerFiche(id);
  const { interactions, modifications, rappels } = await casDUsage.consulterJournal(ctx, { beneficiaireId: id });
  const jour = aujourdhui(ctx.maintenant);

  const filtreType: FiltreType = FILTRES_TYPE.some((f) => f.valeur === type) ? (type as FiltreType) : "tous";
  const filtrePeriode: Periode = (PERIODES as readonly string[]).includes(periode ?? "") ? (periode as Periode) : "12m";

  const evenements: Evenement[] = [
    ...interactions.map((i) => ({ genre: "interaction" as const, type: i.type, date: i.survenueLe, campagneId: i.campagne?.id ?? null, interaction: i })),
    ...regrouperModifications(modifications),
  ];
  const visibles = filtrerTimeline(evenements, { type: filtreType, periode: filtrePeriode }, jour);
  const aFaire = rappels.filter((r) => r.faitLe === null);
  const faits = rappels.length - aFaire.length;

  return (
    <div className="flex flex-col gap-6">
      <Surface className="p-5 sm:p-6">
        <Section titre="Rappels à venir">
          {aFaire.length === 0 ? (
            <p className="text-muted-foreground">Aucun rappel en attente{faits ? ` (${faits} déjà traité${faits > 1 ? "s" : ""})` : ""}.</p>
          ) : (
            <ul className="divide-y">
              {aFaire.map((r) => {
                const enRetard = r.echeance < jour;
                return (
                  <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Bell className={cn("mt-1 size-4 shrink-0", enRetard ? "text-err" : "text-subtle-foreground")} aria-hidden />
                      <div className="flex flex-col">
                        <span className="font-medium">{r.objet}</span>
                        <span className={cn("text-sm", enRetard ? "font-semibold text-err" : "text-muted-foreground")}>
                          {r.echeance === jour ? "Aujourd'hui" : formaterDate(r.echeance)}
                          {enRetard && " · en retard"}
                          {r.assigne && ` · ${r.assigne}`}
                          {r.urgent && " · urgent"}
                        </span>
                      </div>
                    </div>
                    {droits.ecrire && (
                      <BoutonAction action={marquerRappelFaitAction.bind(null, id, r.id)}>
                        Marquer comme fait
                      </BoutonAction>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <Section titre="Historique">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9375rem] font-medium">Type</span>
              <select name="type" defaultValue={filtreType} className={CLASSE_SELECT}>
                {FILTRES_TYPE.map((f) => (
                  <option key={f.valeur} value={f.valeur}>
                    {f.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9375rem] font-medium">Période</span>
              <select name="periode" defaultValue={filtrePeriode} className={CLASSE_SELECT}>
                {PERIODES.map((p) => (
                  <option key={p} value={p}>
                    {PERIODE_LIBELLES[p]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline">
              Filtrer
            </Button>
          </form>

          {visibles.length === 0 ? (
            <p className="border-t pt-4 text-muted-foreground">Rien sur cette période.</p>
          ) : (
            <ol className="flex flex-col border-t">
              {visibles.map((ev) =>
                ev.genre === "interaction" ? (
                  <LigneInteraction key={ev.interaction.id} i={ev.interaction} beneficiaireId={id} />
                ) : (
                  <LigneModification key={`m-${ev.modifications[0].id}`} modifications={ev.modifications} auteur={ev.auteur} date={ev.date} />
                ),
              )}
            </ol>
          )}
        </Section>
      </Surface>
    </div>
  );
}

function LigneInteraction({ i, beneficiaireId }: { i: InteractionVue; beneficiaireId: string }) {
  const Icone = ICONES[i.type];
  return (
    <li className={cn("flex gap-3 border-b py-4 last:border-b-0", i.campagne && "border-l-4 border-l-primary pl-3")}>
      <Icone className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{INTERACTION_LIBELLES[i.type]}</span>
          <span className="text-muted-foreground">
            {formaterDateHeure(i.survenueLe)}
            {i.dureeMinutes ? ` · ${i.dureeMinutes} min` : ""}
          </span>
          {i.resultat && <Pastille ton={tonResultat(i.resultat)}>{STATUT_CIBLE_LIBELLES[i.resultat]}</Pastille>}
        </p>
        {i.campagne && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Megaphone className="size-4" aria-hidden />
            Campagne : {i.campagne.nom}
          </p>
        )}
        {i.compteRendu && <p>{i.compteRendu}</p>}
        {i.besoins.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Besoins :</span>
            {i.besoins.map((b) => (
              <Pastille key={b} ton="warn">
                {BESOIN_LIBELLES[b]}
              </Pastille>
            ))}
          </p>
        )}
        {i.actionSuivi && <p className="text-sm">Suivi prévu : {i.actionSuivi}</p>}
        <p className="text-sm text-muted-foreground">{[i.auteur && `Par ${i.auteur}`, i.interlocuteur && `avec ${i.interlocuteur}`].filter(Boolean).join(" ")}</p>
        {i.aDetailIa && (
          <Link href={`/beneficiaires/${beneficiaireId}/appels-ia/${i.id}`} className="inline-flex min-h-11 w-fit items-center gap-1 font-medium text-primary hover:underline">
            Voir la transcription
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

function LigneModification({ modifications, auteur, date }: { modifications: ModificationVue[]; auteur: string | null; date: Date }) {
  return (
    <li className="flex gap-3 border-b py-4 last:border-b-0">
      <History className="mt-1 size-5 shrink-0 text-subtle-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-semibold">Fiche modifiée</span>
          <span className="text-muted-foreground">
            {formaterDateHeure(date)}
            {auteur && ` · par ${auteur}`}
          </span>
        </p>
        <ul className="flex flex-col gap-1 text-[0.9375rem]">
          {modifications.map((m) => (
            <li key={m.id} className="break-words">
              <span className="text-muted-foreground">{m.champ} : </span>
              <span className="text-subtle-foreground line-through">{m.ancienneValeur ?? "vide"}</span>
              <span aria-hidden> → </span>
              <span className="sr-only"> devient </span>
              <span className="font-medium">{m.nouvelleValeur ?? "vide"}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
