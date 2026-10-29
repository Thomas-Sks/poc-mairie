/** Écrans « Bénévoles » côté CCAS : liste des bénévoles, puis personnes confiées à chacun. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { contexteAvec } from "@/shared/infrastructure/session";
import { EnTetePage, EtatVide, LienRetour, Page, PastillePriorite, Surface } from "@/shared/ui/elements";
import { BenevoleIntrouvable } from "../../application/gestion";
import { casDUsageGestionBenevoles } from "../../infrastructure";
import { AjouterBenevole } from "./ajouter-benevole";
import { BoutonRetirer } from "./bouton-retirer";
import { ConfierPersonnes } from "./confier-personnes";

const personnes = (n: number) => (n === 0 ? "Aucune personne confiée" : `${n} personne${n > 1 ? "s confiées" : " confiée"}`);

export async function PageBenevoles() {
  const ctx = await contexteAvec("benevoles.gerer");
  const benevoles = await casDUsageGestionBenevoles.listerBenevoles(ctx);
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        titre="Bénévoles"
        description="Chaque bénévole appelle les personnes que vous lui confiez, uniquement pendant une alerte. Il ne voit ni le registre, ni l'historique de l'année."
        actions={<AjouterBenevole />}
      />
      <Surface>
        {benevoles.length === 0 ? (
          <div className="px-5 sm:px-6">
            <EtatVide titre="Aucun bénévole pour le moment." description="Ajoutez un bénévole puis confiez-lui des personnes à appeler." />
          </div>
        ) : (
          <ul className="divide-y">
            {benevoles.map((b) => (
              <li key={b.id}>
                <Link href={`/benevoles/${b.id}`} className="flex min-h-16 items-center gap-4 px-5 py-3 hover:bg-muted sm:px-6">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">
                      {b.prenom} {b.nom}
                    </span>
                    <span className="truncate text-muted-foreground">{b.telephone ?? b.email}</span>
                  </span>
                  <span className="text-muted-foreground">{personnes(b.nbPersonnes)}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </Page>
  );
}

export async function PageBenevole({ id }: { id: string }) {
  const ctx = await contexteAvec("benevoles.gerer");
  let vue;
  try {
    vue = await casDUsageGestionBenevoles.consulterBenevole(ctx, id);
  } catch (e) {
    if (e instanceof BenevoleIntrouvable) notFound();
    throw e;
  }
  const { benevole: b, personnes: liste } = vue;
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        retour={<LienRetour href="/benevoles">Tous les bénévoles</LienRetour>}
        titre={`${b.prenom} ${b.nom}`}
        description={[b.telephone, b.email].filter(Boolean).join(" · ")}
        actions={<ConfierPersonnes benevoleId={b.id} prenom={b.prenom} />}
      />
      <section aria-labelledby="titre-confiees" className="flex flex-col gap-4">
        <h2 id="titre-confiees" className="text-xl font-semibold">
          {personnes(liste.length)}
        </h2>
        <Surface>
          {liste.length === 0 ? (
            <div className="px-5 sm:px-6">
              <EtatVide
                titre={`${b.prenom} n'a encore personne à appeler.`}
                description="Utilisez « Confier des personnes », ou sélectionnez des personnes dans Bénéficiaires (tableau ou carte) puis « Assigner »."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {liste.map((p) => (
                <li key={p.id} className="flex min-h-16 items-center gap-3 px-5 py-2 sm:px-6">
                  <PastillePriorite niveau={p.niveau} />
                  <Link href={`/beneficiaires/${p.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                    <span className="font-medium">
                      {p.civilite} {p.prenom} {p.nom}, {p.age} ans
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{p.adresse}</span>
                  </Link>
                  <BoutonRetirer benevoleId={b.id} beneficiaireId={p.id} nom={`${p.prenom} ${p.nom}`} />
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </section>
    </Page>
  );
}
