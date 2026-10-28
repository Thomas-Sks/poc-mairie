/** Onglet « Intervenants et planning » : semaine en cours (anti-doublon) et prises en charge (E6). */
import { aujourdhui, formaterDate } from "@/shared/domain/dates";
import { PRISE_EN_CHARGE_LIBELLES } from "@/shared/domain/vocabulaire";
import { Section, Surface } from "@/shared/ui/elements";
import { cn } from "@/lib/utils";
import { formaterHeureCourte, planningSemaine } from "../domain/planning";
import { casDUsage } from "../infrastructure";
import { chargerFiche } from "./cadre-fiche";
import { GestionPrises } from "./gestion-prises";

export async function OngletIntervenants({ id }: { id: string }) {
  const { ctx, droits } = await chargerFiche(id);
  const [prises, cercle, referentiels] = await Promise.all([
    casDUsage.listerPrisesEnCharge(ctx, { beneficiaireId: id }),
    casDUsage.listerCercle(ctx, { beneficiaireId: id }),
    casDUsage.consulterReferentiels(ctx),
  ]);
  const jour = aujourdhui(ctx.maintenant);
  const semaine = planningSemaine(prises, jour);
  const aDesPassages = semaine.some((j) => j.passages.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <Surface className="p-5 sm:p-6">
        <Section titre="Passages de la semaine">
          {aDesPassages ? (
            <ol className="grid divide-y md:grid-cols-7 md:divide-x md:divide-y-0 md:border-y">
              {semaine.map((j) => {
                const estAujourdhui = j.date === jour;
                return (
                  <li key={j.date} className={cn("flex flex-col gap-2 py-3 md:min-h-32 md:px-3")}>
                    <p className={cn("text-sm font-semibold", estAujourdhui ? "text-primary" : "text-muted-foreground")}>
                      {j.jour} {formaterDate(j.date).slice(0, 5)}
                      {estAujourdhui && " · aujourd'hui"}
                    </p>
                    {j.passages.length === 0 ? (
                      <p className="text-sm text-subtle-foreground">Aucun passage</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {j.passages.map((p, i) => (
                          <li key={i} className={cn("flex flex-col text-[0.9375rem] leading-snug", p.annule && "text-subtle-foreground line-through")}>
                            <span className="tabular font-semibold">{formaterHeureCourte(p.heureDebut)}</span>
                            <span>{PRISE_EN_CHARGE_LIBELLES[p.prise.type]}</span>
                            {p.annule && <span className="text-sm no-underline">exception</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-muted-foreground">Aucun passage d&apos;intervenant prévu. Ajoutez des créneaux aux prises en charge pour éviter les appels en doublon pendant une alerte.</p>
          )}
        </Section>
      </Surface>
      <Surface className="p-5 sm:p-6">
        <GestionPrises
          beneficiaireId={id}
          prises={prises}
          structures={referentiels.structures.map((s) => ({ id: s.id, nom: s.nom }))}
          cercle={cercle.map((l) => ({ id: l.contactId, nom: [l.contact.prenom, l.contact.nom].filter(Boolean).join(" ") }))}
          aujourdhui={jour}
          modifiable={droits.ecrire}
        />
      </Surface>
    </div>
  );
}
