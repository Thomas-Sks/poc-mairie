import { notFound } from "next/navigation";
import type { Contexte } from "@/shared/application/contexte";
import { formaterDate } from "@/shared/domain/dates";
import { ALERTE_LIBELLES } from "@/shared/domain/vocabulaire";
import { Bandeau, EnTetePage, Page, Pastille } from "@/shared/ui/elements";
import { casDUsageCrise } from "../infrastructure";
import { FormulaireCampagne } from "./formulaire-campagne";
import { LienRetour } from "./lien-retour";
import { NIVEAU_ALERTE_LIBELLES, NIVEAU_ALERTE_TONS } from "./libelles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PageCreationCampagne({ ctx, alerteId, listeIdInitiale }: { ctx: Contexte; alerteId: string; listeIdInitiale?: string }) {
  if (!UUID.test(alerteId)) notFound();
  const donnees = await casDUsageCrise.preparerCampagne(ctx, { alerteId });
  if (!donnees) notFound();
  const { alerte } = donnees;
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        retour={<LienRetour href="/alertes">Alertes et campagnes</LienRetour>}
        titre="Nouvelle campagne d'appels"
        description={
          <span className="flex flex-wrap items-center gap-2">
            {ALERTE_LIBELLES[alerte.type]} <Pastille ton={NIVEAU_ALERTE_TONS[alerte.niveau]}>{NIVEAU_ALERTE_LIBELLES[alerte.niveau]}</Pastille>
            depuis le {formaterDate(alerte.debut)} · {alerte.perimetre}
          </span>
        }
      />
      {alerte.statut === "cloturee" ? (
        <Bandeau ton="warn">Cette alerte est clôturée : impossible d&apos;y ajouter une campagne.</Bandeau>
      ) : (
        <FormulaireCampagne
          alerte={{ id: alerte.id, type: alerte.type }}
          nomParDefaut={donnees.nomParDefaut}
          script={donnees.script}
          relance={donnees.relance}
          listes={donnees.listes}
          voies={donnees.voies}
          quartiers={donnees.quartiers}
          membres={donnees.membres}
          nbActifs={donnees.nbActifs}
          listeIdInitiale={donnees.listes.some((l) => l.id === listeIdInitiale) ? listeIdInitiale : undefined}
        />
      )}
    </Page>
  );
}
