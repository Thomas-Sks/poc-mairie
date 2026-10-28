import Link from "next/link";
import { ChevronRight, PhoneForwarded } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formaterHeure } from "@/shared/domain/dates";
import { Bandeau, Pastille, Surface } from "@/shared/ui/elements";
import type { PersonneDeMaListe } from "../application/ports";
import { STATUT_BENEVOLE, resteAFaire } from "../domain/ma-liste";
import { nomPrononce } from "../domain/script";
import { RafraichissementAuto } from "./indicateur-reseau";

function quand(p: PersonneDeMaListe, maintenant: Date): string | null {
  if (!resteAFaire(p.statut)) return null;
  if (p.verrouilleParAutre) return "Quelqu'un l'appelle déjà";
  if (p.prochaineTentativeAt && p.prochaineTentativeAt > maintenant) return `Rappeler à ${formaterHeure(p.prochaineTentativeAt).replace(":", "h")}`;
  // Pas d'heure de rappel : la pastille « À appeler » suffit (pas de répétition).
  return null;
}

function Ligne({ p, maintenant, lien }: { p: PersonneDeMaListe; maintenant: Date; lien: boolean }) {
  const statut = STATUT_BENEVOLE[p.statut];
  const moment = quand(p, maintenant);
  const contenu = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold">
          {p.civilite} {p.prenom} {nomPrononce(p.nom)}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span>{p.age} ans</span>
          <Pastille ton={statut.ton} className="text-lg">
            {statut.libelle}
          </Pastille>
          {moment && <span>{moment}</span>}
        </span>
      </div>
      {lien && <ChevronRight className="size-6 shrink-0 text-subtle-foreground" aria-hidden />}
    </>
  );
  return (
    <li>
      {lien ? (
        <Link href={`/benevole/appel/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted sm:px-5">
          {contenu}
        </Link>
      ) : (
        <div className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-5">{contenu}</div>
      )}
    </li>
  );
}

/** E10-US3 « Ma liste ». */
export function MaListe({
  prenom,
  aFaire,
  faits,
  suivanteId,
  maintenant,
  rendues,
}: {
  prenom: string;
  aFaire: PersonneDeMaListe[];
  faits: PersonneDeMaListe[];
  suivanteId: string | null;
  maintenant: Date;
  rendues: number | null;
}) {
  const vide = aFaire.length === 0 && faits.length === 0;
  const prochainRappel = aFaire
    .map((p) => p.prochaineTentativeAt)
    .filter((d): d is Date => d !== null && d > maintenant)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <RafraichissementAuto />
      <div className="flex flex-col gap-1">
        <h1 className="text-[1.75rem] font-bold leading-tight">Ma liste</h1>
        <p className="text-muted-foreground">
          {vide
            ? `Bonjour ${prenom}.`
            : aFaire.length === 0
              ? `Bravo ${prenom}, tous vos appels du jour sont faits.`
              : `Bonjour ${prenom}, ${aFaire.length} personne${aFaire.length > 1 ? "s" : ""} à appeler aujourd'hui.`}
        </p>
      </div>

      {rendues !== null && (
        <Bandeau ton="accent">
          {rendues > 0
            ? `C'est noté : ${rendues} personne${rendues > 1 ? "s ont été confiées" : " a été confiée"} à l'équipe. Merci pour votre aide !`
            : "C'est noté. Il n'y avait plus personne à appeler dans votre liste. Merci pour votre aide !"}
        </Bandeau>
      )}

      {vide ? (
        <Surface className="flex flex-col gap-2 p-6">
          <p className="text-xl font-semibold">Aucun appel à passer pour le moment.</p>
          <p className="text-muted-foreground">Vous serez prévenu quand une alerte sera déclenchée.</p>
        </Surface>
      ) : (
        <>
          {suivanteId ? (
            <Link href={`/benevole/appel/${suivanteId}`} className={cn(buttonVariants({ size: "lg" }), "h-16 w-full gap-3 text-xl")}>
              <PhoneForwarded className="size-6" aria-hidden />
              Personne suivante
            </Link>
          ) : (
            aFaire.length > 0 && (
              <p className="font-medium">
                {prochainRappel
                  ? `Prochain rappel à ${formaterHeure(prochainRappel).replace(":", "h")}. Revenez un peu plus tard.`
                  : "Les personnes restantes sont déjà en cours d'appel."}
              </p>
            )
          )}

          {aFaire.length > 0 && (
            <Surface aria-labelledby="titre-a-appeler">
              <h2 id="titre-a-appeler" className="border-b px-4 py-3 text-xl font-semibold sm:px-5">
                À appeler
              </h2>
              <ul className="divide-y">
                {aFaire.map((p) => (
                  <Ligne key={p.id} p={p} maintenant={maintenant} lien={!p.verrouilleParAutre} />
                ))}
              </ul>
            </Surface>
          )}

          {faits.length > 0 && (
            <Surface aria-labelledby="titre-faits">
              <h2 id="titre-faits" className="border-b px-4 py-3 text-xl font-semibold sm:px-5">
                Déjà appelées
              </h2>
              <ul className="divide-y">
                {faits.map((p) => (
                  <Ligne key={p.id} p={p} maintenant={maintenant} lien={false} />
                ))}
              </ul>
            </Surface>
          )}
        </>
      )}
    </div>
  );
}
