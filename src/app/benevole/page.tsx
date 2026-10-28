import { obtenirContexte } from "@/shared/infrastructure/session";
import { casDUsageBenevole } from "@/modules/benevole/infrastructure";
import { MaListe } from "@/modules/benevole/ui/ma-liste";
import { PremierLancement } from "@/modules/benevole/ui/premier-lancement";

export default async function PageMaListe({ searchParams }: PageProps<"/benevole">) {
  const ctx = await obtenirContexte();
  const vue = await casDUsageBenevole.consulterMaListe(ctx);
  if (vue.etape === "engagement") return <PremierLancement prenom={ctx.utilisateur.prenom} />;

  const { rendues } = await searchParams;
  const nbRendues = typeof rendues === "string" && /^\d+$/.test(rendues) ? Number(rendues) : null;
  return (
    <MaListe
      prenom={ctx.utilisateur.prenom}
      aFaire={vue.aFaire}
      faits={vue.faits}
      suivanteId={vue.suivanteId}
      maintenant={ctx.maintenant}
      rendues={nbRendues}
    />
  );
}
