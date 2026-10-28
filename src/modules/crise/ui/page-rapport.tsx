import { notFound } from "next/navigation";
import type { Contexte } from "@/shared/application/contexte";
import { formaterDate, formaterDateHeure, formaterDateLongue } from "@/shared/domain/dates";
import { ALERTE_LIBELLES, BESOIN_LIBELLES, STATUT_CIBLE_LIBELLES, type Besoin } from "@/shared/domain/vocabulaire";
import { Bandeau, EnTetePage, Libelle, Page, Pastille, Section, Surface } from "@/shared/ui/elements";
import { casDUsageCrise } from "../infrastructure";
import { casDUsage as casDUsageRegistre } from "@/modules/registre/infrastructure";
import { decrireSource } from "../application";
import { tonStatut } from "../domain/tableau-de-bord";
import { BoutonImprimer } from "./bouton-imprimer";
import { LienRetour } from "./lien-retour";
import { CANAL_LIBELLES, NIVEAU_ALERTE_LIBELLES } from "./libelles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mise en page d'impression : on masque la coque de l'application et on retire les bordures. */
const STYLE_IMPRESSION = `
@media print {
  @page { size: A4; margin: 14mm; }
  body { background: #fff !important; font-size: 11pt; }
  aside, header.sticky, [data-sonner-toaster] { display: none !important; }
  .rapport section { break-inside: avoid; }
  .rapport .surface-rapport { border: 0 !important; padding: 0 !important; }
  .rapport table { font-size: 10pt; }
  .rapport tr { break-inside: avoid; }
}`;

export async function PageRapport({ ctx, campagneId }: { ctx: Contexte; campagneId: string }) {
  if (!UUID.test(campagneId)) notFound();
  const rapport = await casDUsageCrise.rapportCampagne(ctx, { campagneId });
  if (!rapport) notFound();
  const { campagne, stats, signalees } = rapport;
  const listes = campagne.source.type === "liste" ? await casDUsageRegistre.listerListes(ctx) : [];
  const alerte = campagne.alerte;
  const periode = stats.vagues.length
    ? stats.vagues.length === 1
      ? `le ${formaterDateLongue(stats.vagues[0])}`
      : `du ${formaterDateLongue(stats.vagues[0])} au ${formaterDateLongue(stats.vagues.at(-1)!)}`
    : "aucune vague";

  const chiffres = [
    { libelle: "Personnes suivies", valeur: stats.personnes },
    { libelle: "Contacts prévus", valeur: stats.contactsPrevus, aide: `${stats.vagues.length} vague${stats.vagues.length > 1 ? "s" : ""}` },
    { libelle: "Appels passés", valeur: stats.appelsPasses, aide: stats.appelsIa ? `dont ${stats.appelsIa} par l'IA (démonstration)` : undefined },
    { libelle: "Taux de couverture", valeur: `${stats.tauxCouverture} %` },
    { libelle: "Joints", valeur: stats.joints },
    { libelle: "Couverts par passage", valeur: stats.couvertsPassage },
    { libelle: "Couverts par un proche", valeur: stats.couvertsProche },
    { libelle: "Absents", valeur: stats.absents },
    { libelle: "Besoins signalés", valeur: stats.besoins },
    { libelle: "Situations de danger", valeur: stats.dangers, alerte: stats.dangers > 0 },
    { libelle: "Évacuations / relogements", valeur: stats.evacuations, alerte: stats.evacuations > 0 },
    { libelle: "Non joints à traiter", valeur: stats.nonJointsATraiter, alerte: stats.nonJointsATraiter > 0 },
  ];
  const besoins = Object.entries(stats.besoinsParType) as [Besoin, number][];

  return (
    <Page className="rapport max-w-5xl print:max-w-none print:p-0">
      <style>{STYLE_IMPRESSION}</style>
      <EnTetePage
        retour={<LienRetour href={`/campagnes/${campagne.id}`}>Tableau de bord de la campagne</LienRetour>}
        titre={`Rapport de campagne : ${campagne.nom}`}
        description={`${rapport.commune.structureNom} · ${rapport.commune.nom} · généré le ${formaterDateHeure(rapport.genereLe)}`}
        actions={<BoutonImprimer />}
      />
      {campagne.statut === "active" && (
        <Bandeau ton="warn" className="print:hidden">
          La campagne est toujours en cours : ce rapport est provisoire. Il sera définitif à la clôture de l&apos;alerte.
        </Bandeau>
      )}

      <Surface className="surface-rapport flex flex-col gap-5 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Contexte</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">
          {alerte && (
            <>
              <dt className="text-muted-foreground">Alerte</dt>
              <dd>
                {ALERTE_LIBELLES[alerte.type]} · {NIVEAU_ALERTE_LIBELLES[alerte.niveau]} · {alerte.perimetre}
                {alerte.clotureeLe && ` · clôturée le ${formaterDateHeure(alerte.clotureeLe)}`}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Période</dt>
          <dd>{periode.charAt(0).toUpperCase() + periode.slice(1)}</dd>
          <dt className="text-muted-foreground">Personnes ciblées</dt>
          <dd>{decrireSource(campagne.source, listes)}</dd>
          <dt className="text-muted-foreground">Canal</dt>
          <dd>{CANAL_LIBELLES[campagne.canal]}</dd>
        </dl>
      </Surface>

      <Surface className="surface-rapport flex flex-col gap-5 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Statistiques</h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4">
          {chiffres.map((c) => (
            <li key={c.libelle} className="flex flex-col">
              <span className="text-sm text-muted-foreground">{c.libelle}</span>
              <span className={`text-2xl font-bold tabular ${c.alerte ? "text-err" : ""}`}>{c.valeur}</span>
              {c.aide && <span className="text-sm text-muted-foreground">{c.aide}</span>}
            </li>
          ))}
        </ul>
        {besoins.length > 0 && (
          <div className="flex flex-col gap-1 border-t pt-4">
            <Libelle>Besoins par type</Libelle>
            <p>{besoins.map(([b, n]) => `${BESOIN_LIBELLES[b]} : ${n}`).join(" · ")}</p>
          </div>
        )}
        <div className="flex flex-col gap-2 border-t pt-4">
          <Libelle>Par vague</Libelle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left">
              <thead className="text-sm text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">Jour</th>
                  <th className="py-2 pr-4 text-right font-medium">Personnes</th>
                  <th className="py-2 pr-4 text-right font-medium">Couvertes</th>
                  <th className="py-2 text-right font-medium">Situations signalées</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular">
                {stats.parVague.map((v) => (
                  <tr key={v.vague}>
                    <td className="py-2 pr-4">{formaterDate(v.vague)}</td>
                    <td className="py-2 pr-4 text-right">{v.total}</td>
                    <td className="py-2 pr-4 text-right">{v.couverts}</td>
                    <td className="py-2 text-right">{v.signales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Surface>

      <Section titre={`Situations signalées et actions menées (${signalees.length})`}>
        {signalees.length === 0 ? (
          <p className="text-muted-foreground">Aucune situation particulière n&apos;a été signalée.</p>
        ) : (
          <Surface className="surface-rapport">
            <ul className="divide-y">
              {signalees.map((s) => (
                <li key={s.id} className="flex flex-col gap-1.5 px-5 py-4 print:px-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-muted-foreground">{formaterDate(s.vagueDate)}</span>
                    <span className="font-semibold">{s.personne}</span>
                    <Pastille ton={tonStatut(s.statut)}>{STATUT_CIBLE_LIBELLES[s.statut]}</Pastille>
                    {s.besoins.length > 0 && <span className="text-muted-foreground">{s.besoins.join(", ")}</span>}
                  </div>
                  <span className="text-sm text-muted-foreground">{s.adresse}</span>
                  {s.note && <span>{s.note}</span>}
                  {s.actions.length > 0 && (
                    <ul className="text-[0.9375rem] text-muted-foreground">
                      {s.actions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Surface>
        )}
        <p className="text-muted-foreground">
          {rapport.rappelsCrees > 0 ? `${rapport.rappelsCrees} tâche${rapport.rappelsCrees > 1 ? "s" : ""} de suivi créée${rapport.rappelsCrees > 1 ? "s" : ""} pour les besoins signalés.` : ""}
        </p>
      </Section>
    </Page>
  );
}
