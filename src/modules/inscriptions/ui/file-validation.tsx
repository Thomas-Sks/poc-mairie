import Link from "next/link";
import { ChevronRight, QrCode, SquareArrowOutUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { aujourdhui, calculerAge, formaterDateHeure } from "@/shared/domain/dates";
import { EnTetePage, EtatVide, Page, Pastille, PastillePriorite, Section, Surface } from "@/shared/ui/elements";
import type { InscriptionEnregistree } from "../application/ports";
import type { InscriptionEnFile } from "../application/file-validation";

const nomFiche = (f: { civilite: string; prenom: string; nom: string }) => `${f.civilite} ${f.prenom} ${f.nom}`;

/** E7-US3 — File « Inscriptions à valider », triée par score de priorité. */
export function FileValidation({ file, traitees, maintenant }: { file: InscriptionEnFile[]; traitees: InscriptionEnregistree[]; maintenant: Date }) {
  return (
    <Page>
      <EnTetePage
        titre="Inscriptions à valider"
        description="Demandes reçues par le formulaire en ligne, de la plus prioritaire à la moins prioritaire. Le score n'est pas visible du demandeur."
        actions={
          <>
            <Link href="/inscription/qr" className={buttonVariants({ variant: "ghost" })}>
              <QrCode aria-hidden />
              Affichette avec QR code
            </Link>
            <Link href="/inscription" target="_blank" className={buttonVariants({ variant: "outline" })}>
              <SquareArrowOutUpRight aria-hidden />
              Ouvrir le formulaire public
            </Link>
          </>
        }
      />

      <Surface className="overflow-hidden">
        {file.length === 0 ? (
          <div className="px-6">
            <EtatVide titre="Aucune inscription en attente" description="Les nouvelles demandes arrivent ici dès leur envoi, avec une notification." />
          </div>
        ) : (
          <>
          {/* Mobile : une ligne cliquable par demande. */}
          <ul className="divide-y md:hidden">
            {file.map((i) => (
              <li key={i.id}>
                <Link href={`/inscriptions/${i.id}`} className="flex min-h-11 items-center gap-3 px-4 py-4 hover:bg-muted">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {i.fiches.map((f) => (
                      <span key={f.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{nomFiche(f)}</span>
                        <PastillePriorite niveau={f.niveauPriorite} score={f.score} />
                      </span>
                    ))}
                    {i.fiches.some((f) => f.doublons.length > 0) && (
                      <Pastille ton="warn" className="self-start">
                        Doublon possible
                      </Pastille>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {i.adresse ?? "Adresse non renseignée"} · reçue le {formaterDateHeure(i.soumisLe)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative overflow-x-auto max-md:hidden">
            <table className="w-full min-w-[56rem] text-left">
              <caption className="sr-only">Inscriptions en attente de validation, triées par priorité</caption>
              <thead className="border-b text-sm text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Priorité</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Personne(s)</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Adresse</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Rempli par</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Reçue le</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {file.map((i) => {
                  const doublon = i.fiches.some((f) => f.doublons.length > 0);
                  return (
                    <tr key={i.id} className="align-top hover:bg-muted/50">
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          {i.fiches.map((f) => (
                            <PastillePriorite key={f.id} niveau={f.niveauPriorite} score={f.score} />
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          {i.fiches.map((f) => (
                            <span key={f.id}>
                              <span className="font-semibold">{nomFiche(f)}</span>
                              <span className="text-muted-foreground"> · {calculerAge(f.dateNaissance, aujourdhui(maintenant))} ans</span>
                            </span>
                          ))}
                          {doublon && (
                            <Pastille ton="warn" className="self-start">
                              Doublon possible
                            </Pastille>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">{i.adresse ?? "Non renseignée"}</td>
                      <td className="px-5 py-4">{i.reponses.remplisseur === "tiers" ? "Un proche" : "La personne"}</td>
                      <td className="px-5 py-4 tabular whitespace-nowrap">{formaterDateHeure(i.soumisLe)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/inscriptions/${i.id}`} className={buttonVariants({ variant: "outline" })}>
                          Examiner<span className="sr-only"> l&apos;inscription de {i.fiches.map(nomFiche).join(" et ")}</span>
                          <ChevronRight aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Surface>

      {traitees.length > 0 && (
        <Section titre="Traitées récemment">
          <Surface>
            <ul className="divide-y">
              {traitees.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
                  <div className="flex min-w-0 flex-col">
                    <Link href={`/inscriptions/${i.id}`} className="font-semibold text-primary hover:underline">
                      {i.fiches.length ? i.fiches.map(nomFiche).join(" et ") : nomsDepuisReponses(i.reponses)}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {i.traiteePar ? `Par ${i.traiteePar}` : "Traitée"}
                      {i.traiteeLe && ` le ${formaterDateHeure(i.traiteeLe)}`}
                      {i.motifRejet && ` · Motif : ${i.motifRejet}`}
                    </span>
                  </div>
                  <Pastille ton={i.statut === "validee" ? "ok" : "neutre"}>{i.statut === "validee" ? "Validée" : "Rejetée"}</Pastille>
                </li>
              ))}
            </ul>
          </Surface>
        </Section>
      )}
    </Page>
  );
}

export function nomsDepuisReponses(reponses: Record<string, unknown>): string {
  const personnes = Array.isArray(reponses.personnes) ? (reponses.personnes as { civilite?: string; prenom?: string; nom?: string }[]) : [];
  return personnes.map((p) => [p.civilite, p.prenom, p.nom?.toUpperCase()].filter(Boolean).join(" ")).join(" et ") || "Inscription";
}
