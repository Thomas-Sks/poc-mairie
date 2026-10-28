import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { EnTeteBenevole } from "@/modules/benevole/ui/en-tete";
import { utilisateursDuSelecteur } from "@/modules/benevole/infrastructure";

export const metadata: Metadata = { title: "Mes appels" };

/** Interface bénévole « appel uniquement » (E10) : aucun menu, un en-tête minimal. */
export default async function LayoutBenevole({ children }: LayoutProps<"/benevole">) {
  const ctx = await obtenirContexte();
  // RG-07 : cette interface est réservée aux bénévoles (l'admin peut prendre leur place via le sélecteur).
  if (ctx.utilisateur.role !== "benevole") redirect("/");
  const utilisateurs = await utilisateursDuSelecteur(ctx.commune.id);

  return (
    <div className="flex min-h-dvh flex-col text-lg">
      <EnTeteBenevole structure={ctx.commune.structureNom} utilisateurs={utilisateurs} courantId={ctx.utilisateur.id} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
