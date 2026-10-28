import Link from "next/link";
import { PencilLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { aujourdhui, calculerAge, formaterDate, formaterDateHeure } from "@/shared/domain/dates";
import { Bandeau, EnTetePage, Libelle, LienRetour, Page, PastillePriorite, Proprietes, Section, Surface } from "@/shared/ui/elements";
import { MOTIF_DOUBLON_LIBELLES } from "../domain/doublons";
import { lireReponses } from "../domain/lecture";
import type { DetailInscription } from "../application/file-validation";
import { referenceInscription } from "../application/soumettre-inscription";
import { ActionsInscription, BoutonFusion } from "./actions-inscription";
import { nomsDepuisReponses } from "./file-validation";

const nomFiche = (f: { civilite: string; prenom: string; nom: string }) => `${f.civilite} ${f.prenom} ${f.nom}`;

/** E7-US3 — Détail d'une inscription : réponses lisibles, priorité calculée, doublons et décision. */
export function DetailInscriptionVue({ inscription: i, maintenant }: { inscription: DetailInscription; maintenant: Date }) {
  const enAttente = i.statut === "en_attente";
  const fichesEnAttente = i.fiches.filter((f) => f.statut === "en_attente");
  const noms = i.fiches.length ? i.fiches.map(nomFiche).join(" et ") : nomsDepuisReponses(i.reponses);
  const jour = aujourdhui(maintenant);

  return (
    <Page>
      <EnTetePage
        retour={<LienRetour href="/inscriptions">Inscriptions à valider</LienRetour>}
        titre={noms}
        description={`Demande ${referenceInscription(i.id)} reçue le ${formaterDateHeure(i.soumisLe)}, remplie par ${i.reponses.remplisseur === "tiers" ? "un proche" : "la personne elle-même"}.`}
        actions={enAttente && fichesEnAttente.length > 0 && <ActionsInscription id={i.id} noms={fichesEnAttente.map(nomFiche).join(" et ")} nbFiches={fichesEnAttente.length} />}
      />

      {i.statut === "validee" && (
        <Bandeau ton="ok">
          Inscription validée{i.traiteePar ? ` par ${i.traiteePar}` : ""}
          {i.traiteeLe ? ` le ${formaterDateHeure(i.traiteeLe)}` : ""}.
        </Bandeau>
      )}
      {i.statut === "rejetee" && (
        <Bandeau ton="err">
          Inscription rejetée{i.traiteePar ? ` par ${i.traiteePar}` : ""}
          {i.traiteeLe ? ` le ${formaterDateHeure(i.traiteeLe)}` : ""}. Motif : {i.motifRejet ?? "non précisé"}.
        </Bandeau>
      )}

      {enAttente &&
        fichesEnAttente.flatMap((f) =>
          f.doublons.map((d) => (
            <Bandeau key={`${f.id}-${d.id}`} ton="warn" className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Doublon possible : {nomFiche(f)} ressemble à{" "}
                <Link href={`/beneficiaires/${d.id}`} className="underline underline-offset-2">
                  la fiche existante de {d.libelle}
                </Link>{" "}
                ({d.motifs.map((m) => MOTIF_DOUBLON_LIBELLES[m]).join(", ")}).
              </span>
              <BoutonFusion inscriptionId={i.id} ficheEnAttenteId={f.id} ficheExistanteId={d.id} libelleExistante={d.libelle} libelleEnAttente={nomFiche(f)} />
            </Bandeau>
          )),
        )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Surface className="divide-y">
          {lireReponses(i.reponses).map((section) => (
            <div key={section.titre} className="flex flex-col gap-4 px-6 py-5">
              <h2 className="text-lg font-semibold">{section.titre}</h2>
              {section.elements.some((e) => e.valeur) ? (
                <Proprietes items={section.elements.filter((e) => e.valeur)} />
              ) : (
                <p className="text-subtle-foreground">Non renseigné</p>
              )}
            </div>
          ))}
        </Surface>

        <div className="flex flex-col gap-6">
          {i.fiches.map((f) => (
            <Surface key={f.id} className="flex flex-col gap-4 p-5">
              <Section
                titre={<span className="text-lg">{nomFiche(f)}</span>}
                actions={<PastillePriorite niveau={f.niveauPriorite} score={f.score} />}
              >
                <p className="text-muted-foreground">
                  {calculerAge(f.dateNaissance, jour)} ans · né(e) le {formaterDate(f.dateNaissance)}
                </p>
                <div className="flex flex-col gap-2">
                  <Libelle>Score de priorité (RG-01)</Libelle>
                  {f.criteres.length ? (
                    <ul className="flex flex-col divide-y">
                      {f.criteres.map((c) => (
                        <li key={c.critere} className="flex justify-between gap-3 py-1.5">
                          <span>{c.critere}</span>
                          <span className="tabular font-semibold">+{c.points}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Aucun critère de fragilité.</p>
                  )}
                </div>
                <Link href={`/beneficiaires/${f.id}`} className={`${buttonVariants({ variant: "outline" })} self-start`}>
                  <PencilLine aria-hidden />
                  {f.statut === "en_attente" ? "Compléter la fiche" : "Voir la fiche"}
                </Link>
              </Section>
            </Surface>
          ))}
          {enAttente && fichesEnAttente.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Pour compléter puis valider : complétez la fiche (santé, GIR, informations prioritaires…), revenez ici puis validez l&apos;inscription.
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}
