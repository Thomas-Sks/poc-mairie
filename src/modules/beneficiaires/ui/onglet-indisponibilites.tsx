/** Onglet « Indisponibilités » (E5-US1 à US3) : absences en cours, à venir et passées. */
import { aujourdhui, formaterDate } from "@/shared/domain/dates";
import { INDISPONIBILITE_LIBELLES, type Ton } from "@/shared/domain/vocabulaire";
import { Pastille, Section, Surface } from "@/shared/ui/elements";
import { ETAT_INDISPONIBILITE_LIBELLES, etatIndisponibilite, type EtatIndisponibilite } from "../domain/indisponibilites";
import { casDUsage } from "../infrastructure";
import { signalerRetourAction } from "./actions";
import { BoutonAction } from "./bouton-action";
import { chargerFiche } from "./cadre-fiche";
import { BoutonDeclarerIndisponibilite } from "./bouton-declarer-indisponibilite";

const TON: Record<EtatIndisponibilite, Ton> = { en_cours: "warn", a_venir: "accent", terminee: "neutre" };

export async function OngletIndisponibilites({ id }: { id: string }) {
  const { ctx, droits } = await chargerFiche(id);
  const indisponibilites = await casDUsage.listerIndisponibilites(ctx, { beneficiaireId: id });
  const jour = aujourdhui(ctx.maintenant);

  return (
    <Surface className="p-5 sm:p-6">
      <Section titre="Indisponibilités" actions={droits.ecrire && <BoutonDeclarerIndisponibilite beneficiaireId={id} aujourdhui={jour} />}>
        <p className="text-muted-foreground">Pendant une indisponibilité, la personne est exclue des campagnes d&apos;appel (« absente – ne pas appeler »).</p>
        {indisponibilites.length === 0 ? (
          <p className="border-t pt-4 text-muted-foreground">Aucune indisponibilité déclarée.</p>
        ) : (
          <ul className="divide-y border-t">
            {indisponibilites.map((i) => {
              const etat = etatIndisponibilite(i, jour);
              return (
                <li key={i.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{INDISPONIBILITE_LIBELLES[i.type]}</span>
                      <Pastille ton={TON[etat]}>{ETAT_INDISPONIBILITE_LIBELLES[etat]}</Pastille>
                    </p>
                    <p>
                      Du {formaterDate(i.debut)} {i.fin ? `au ${formaterDate(i.fin)}` : "jusqu'à nouvel ordre"}
                    </p>
                    {(i.joignabilite || i.source) && (
                      <p className="text-sm text-muted-foreground">{[i.joignabilite, i.source && `source : ${i.source}`].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  {droits.ecrire && etat === "en_cours" && <BoutonAction action={signalerRetourAction.bind(null, i.id)}>Signaler le retour</BoutonAction>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </Surface>
  );
}
