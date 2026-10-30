/**
 * Pages du registre (Server Components). Les fichiers de `src/app` se contentent de les rendre.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contexte } from "@/shared/application/contexte";
import { formaterDate } from "@/shared/domain/dates";
import { peut } from "@/shared/domain/permissions";
import { EnTetePage, EtatVide, LienRetour, Page, Surface } from "@/shared/ui/elements";
import { contexteAvec } from "@/shared/infrastructure/session";
import { decrireFiltre } from "../domain/filtre";
import { ListeIntrouvable } from "../application/rechercher-beneficiaire-ids";
import { casDUsage } from "../infrastructure";
import { ActionsListe } from "./actions-liste";
import { TableauBeneficiaires } from "./tableau-beneficiaires";
import type { Droits } from "./types";

const droitsDe = (ctx: Contexte): Droits => ({
  ecrire: peut(ctx.utilisateur.role, "fiches.ecrire"),
  exporter: peut(ctx.utilisateur.role, "export"),
  sante: peut(ctx.utilisateur.role, "fiches.sante"),
  archiver: peut(ctx.utilisateur.role, "fiches.archiver"),
});

export async function PageBeneficiaires({ question }: { question?: string } = {}) {
  const ctx = await contexteAvec("fiches.lire");
  const referentiels = await casDUsage.chargerReferentiels(ctx);
  const droits = droitsDe(ctx);
  return (
    <Page className="max-w-none">
      <EnTetePage
        titre="Bénéficiaires"
        description="Posez votre question : le tableau et la carte n'affichent que les personnes concernées."
        actions={
          droits.ecrire && (
            <Button render={<Link href="/beneficiaires/nouveau" />} nativeButton={false}>
              <Plus aria-hidden /> Nouvelle fiche
            </Button>
          )
        }
      />
      <TableauBeneficiaires
        referentiels={referentiels}
        droits={droits}
        ressource="beneficiaires"
        questionInitiale={question}
      />
    </Page>
  );
}

export async function PageListes() {
  const ctx = await contexteAvec("fiches.lire");
  const [listes, equipe] = await Promise.all([casDUsage.listerListes(ctx), casDUsage.chargerReferentiels(ctx).then((r) => r.equipe)]);
  const noms = Object.fromEntries(equipe.map((m) => [m.id, `${m.prenom} ${m.nom}`]));
  return (
    <Page>
      <EnTetePage
        titre="Listes"
        description="Les listes que vous avez enregistrées depuis Bénéficiaires."
        actions={
          <Button variant="outline" render={<Link href="/beneficiaires" />} nativeButton={false}>
            Créer depuis le tableau
          </Button>
        }
      />
      <Surface>
        {listes.length === 0 ? (
          <div className="px-5">
            <EtatVide
              titre="Aucune liste enregistrée"
              description="Dans le tableau des bénéficiaires, filtrez (par exemple une rue et une plage de numéros) puis choisissez « Enregistrer la liste »."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {listes.map((l) => {
              return (
                <li key={l.id}>
                  <Link href={`/listes/${l.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-background">
                    <span className="min-w-0 flex-1 basis-72 font-semibold text-primary">{l.nom}</span>
                    <span className="tabular w-32 font-medium">
                      {l.nb} personne{l.nb > 1 ? "s" : ""}
                    </span>
                    <span className="w-56 text-[0.9375rem] text-muted-foreground">
                      {formaterDate(l.createdAt.toISOString().slice(0, 10))}
                      {l.creePar && noms[l.creePar] ? ` · ${noms[l.creePar]}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </Page>
  );
}

export async function PageListe({ id }: { id: string }) {
  const ctx = await contexteAvec("fiches.lire");
  let liste;
  try {
    liste = await casDUsage.consulterListe(ctx, id);
  } catch (e) {
    if (e instanceof ListeIntrouvable) notFound();
    throw e;
  }
  const referentiels = await casDUsage.chargerReferentiels(ctx);
  const droits = droitsDe(ctx);
  const noms = Object.fromEntries(referentiels.equipe.map((m) => [m.id, `${m.prenom} ${m.nom}`]));
  const criteres = decrireFiltre(liste.filtre, { utilisateurs: noms }).map((p) => p.libelle);
  const enregistree = `Enregistrée le ${formaterDate(liste.createdAt.toISOString().slice(0, 10))}`;
  // Liste dynamique : on rappelle ses critères, sauf s'ils redisent son nom.
  const description =
    liste.type === "dynamique" && criteres.length > 0 && criteres.join(" · ") !== liste.nom ? `${enregistree} · ${criteres.join(" · ")}` : enregistree;
  return (
    <Page className="max-w-none">
      <EnTetePage
        retour={<LienRetour href="/listes">Toutes les listes</LienRetour>}
        titre={liste.nom}
        description={description}
        actions={droits.ecrire && <ActionsListe id={liste.id} nom={liste.nom} />}
      />
      <TableauBeneficiaires referentiels={referentiels} droits={droits} listeId={liste.id} ressource={`liste:${liste.id}`} />
    </Page>
  );
}
