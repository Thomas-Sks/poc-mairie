/**
 * Cadre commun des pages de fiche : en-tête, informations prioritaires (E5-US4), synthèse (E1-US2), onglets.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Info, MapPinOff } from "lucide-react";
import { z } from "zod";
import { contexteAvec } from "@/shared/infrastructure/session";
import { ajouterJours, aujourdhui, formaterDate } from "@/shared/domain/dates";
import {
  INDISPONIBILITE_LIBELLES,
  INTERACTION_LIBELLES,
  MOTIF_ARCHIVAGE_LIBELLES,
  RELATION_LIBELLES,
  STATUT_CIBLE_LIBELLES,
  STATUT_FICHE_LIBELLES,
} from "@/shared/domain/vocabulaire";
import { Bandeau, EnTetePage, Libelle, Pastille, PastillePriorite, Surface } from "@/shared/ui/elements";
import { libelleAdresse, nomComplet } from "../domain/fiche";
import type { Synthese } from "../domain/synthese";
import { casDUsage } from "../infrastructure";
import { ActionsFiche } from "./actions-fiche";
import { tonResultat } from "./libelles";
import { OngletsFiche } from "./onglets-fiche";

const FORMAT_LOCAL = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Charge la fiche ou renvoie une 404 (identifiant invalide, autre commune, inexistante). */
export async function chargerFiche(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await contexteAvec("fiches.lire");
  const consultation = await casDUsage.consulterFiche(ctx, { id });
  if (!consultation) notFound();
  return { ctx, ...consultation };
}

function ElementSynthese({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Libelle>{libelle}</Libelle>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const nonRenseigne = <span className="text-subtle-foreground">Aucun</span>;

function BlocSynthese({ s, cible }: { s: Synthese; cible: { campagne: string; statut: keyof typeof STATUT_CIBLE_LIBELLES; exclue: boolean; motifExclusion: string | null } | null }) {
  return (
    <Surface aria-label="Synthèse" className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 xl:grid-cols-6">
      <ElementSynthese libelle="Âge">
        <p className="font-semibold">
          {s.age} ans{s.vitSeul && <span className="font-normal text-muted-foreground"> · vit seul(e)</span>}
        </p>
      </ElementSynthese>
      <ElementSynthese libelle="Priorité">
        <div className="flex flex-wrap items-center gap-2">
          <PastillePriorite niveau={s.niveau} score={s.score} />
          {s.niveauForce && <span className="text-sm text-muted-foreground">forcé</span>}
        </div>
      </ElementSynthese>
      <ElementSynthese libelle="Prises en charge">
        {s.prisesActives.length ? <p>{s.prisesActives.join(", ")}</p> : <p className="text-warn">Aucune aide à domicile</p>}
      </ElementSynthese>
      <ElementSynthese libelle="Indisponibilité">
        {s.indisponibilite ? (
          <div className="flex flex-col gap-1">
            <Pastille ton="warn" className="w-fit">
              {INDISPONIBILITE_LIBELLES[s.indisponibilite.type]}
            </Pastille>
            <span className="text-sm text-muted-foreground">
              {s.indisponibilite.fin ? `jusqu'au ${formaterDate(s.indisponibilite.fin)}` : "jusqu'à nouvel ordre"} · ne pas appeler
            </span>
          </div>
        ) : (
          <p>Présente à domicile</p>
        )}
      </ElementSynthese>
      <ElementSynthese libelle="Dernier contact">
        {s.dernierContact ? (
          <div className="flex flex-col gap-1">
            <span>
              {formaterDate(aujourdhui(s.dernierContact.date))} · {INTERACTION_LIBELLES[s.dernierContact.type]}
            </span>
            {s.dernierContact.resultat && (
              <Pastille ton={tonResultat(s.dernierContact.resultat)} className="w-fit">
                {STATUT_CIBLE_LIBELLES[s.dernierContact.resultat]}
              </Pastille>
            )}
          </div>
        ) : (
          nonRenseigne
        )}
      </ElementSynthese>
      <ElementSynthese libelle="Prochain rappel">
        {s.prochainRappel ? (
          <div className="flex flex-col gap-0.5">
            <span className={s.prochainRappel.enRetard ? "font-semibold text-err" : "font-semibold"}>
              {formaterDate(s.prochainRappel.echeance)}
              {s.prochainRappel.enRetard && " · en retard"}
            </span>
            <span className="line-clamp-2 text-sm text-muted-foreground">{s.prochainRappel.objet}</span>
          </div>
        ) : (
          nonRenseigne
        )}
      </ElementSynthese>
      {cible && (
        <div className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4">
          <Libelle>Alerte en cours</Libelle>
          <span className="font-semibold">{cible.campagne}</span>
          <Pastille ton={cible.exclue ? "neutre" : tonResultat(cible.statut)}>{cible.exclue ? "Exclue de l'appel du jour" : STATUT_CIBLE_LIBELLES[cible.statut]}</Pastille>
          {cible.exclue && cible.motifExclusion && <span className="text-sm text-muted-foreground">{cible.motifExclusion}</span>}
        </div>
      )}
    </Surface>
  );
}

export async function CadreFiche({ id, children }: { id: string; children: ReactNode }) {
  const { ctx, fiche, synthese, cibleActive, droits } = await chargerFiche(id);
  const [cercle, referentiels] = await Promise.all([casDUsage.listerCercle(ctx, { beneficiaireId: id }), casDUsage.consulterReferentiels(ctx)]);
  const jour = aujourdhui(ctx.maintenant);
  const b = fiche.beneficiaire;
  const adresse = `${libelleAdresse(fiche.foyer)}, ${fiche.foyer.codePostal} ${fiche.foyer.ville}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <EnTetePage
        retour={
          <Link href="/beneficiaires" className="inline-flex min-h-11 w-fit items-center gap-2 font-medium text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden />
            Bénéficiaires
          </Link>
        }
        titre={
          <span className="flex flex-wrap items-center gap-3">
            {nomComplet(b)}
            {fiche.statut !== "active" && <Pastille ton={fiche.statut === "archivee" ? "neutre" : "warn"}>{STATUT_FICHE_LIBELLES[fiche.statut]}</Pastille>}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {adresse}
            {fiche.foyer.adresseAVerifier && (
              <span className="inline-flex items-center gap-1 font-medium text-warn">
                <MapPinOff className="size-4" aria-hidden />
                Adresse à vérifier
              </span>
            )}
          </span>
        }
        actions={
          <ActionsFiche
            beneficiaireId={id}
            droits={droits}
            archivee={fiche.statut === "archivee"}
            cercle={cercle.map((l) => ({ id: l.contactId, nom: `${[l.contact.prenom, l.contact.nom].filter(Boolean).join(" ")} (${RELATION_LIBELLES[l.relation]})` }))}
            equipe={referentiels.equipe.map((u) => ({ id: u.id, nom: `${u.prenom} ${u.nom}` }))}
            moiId={ctx.utilisateur.id}
            maintenantLocal={FORMAT_LOCAL.format(ctx.maintenant).replace(" ", "T")}
            aujourdhui={jour}
            demain={ajouterJours(jour, 1)}
            niveauCalcule={fiche.niveauPriorite}
            niveauForce={fiche.niveauForce}
          />
        }
      />

      {b.infoPrioritaire && (
        <Bandeau ton="warn" className="flex items-start gap-3 text-[1.0625rem]">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">Information prioritaire : </span>
            {b.infoPrioritaire}
          </span>
        </Bandeau>
      )}
      {fiche.statut === "archivee" && (
        <Bandeau ton="accent">
          Fiche archivée{fiche.motifArchivage && ` · ${MOTIF_ARCHIVAGE_LIBELLES[fiche.motifArchivage]}`}
          {fiche.motifStatut && ` – ${fiche.motifStatut}`}. Elle n&apos;apparaît plus dans les listes ni les campagnes.
        </Bandeau>
      )}

      <BlocSynthese s={synthese} cible={cibleActive} />

      <div className="flex flex-col gap-6">
        <OngletsFiche beneficiaireId={id} compteurs={{ "/cercle": cercle.length }} />
        {children}
      </div>
    </div>
  );
}
