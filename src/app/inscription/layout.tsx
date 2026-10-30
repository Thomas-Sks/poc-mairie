import type { Metadata } from "next";
import { communePublique } from "@/modules/inscriptions/infrastructure";

export const metadata: Metadata = { title: "Inscription au registre des personnes vulnérables" };

/** Les coordonnées de la commune viennent de la base : rendu à la demande, jamais au build. */
export const dynamic = "force-dynamic";

/** Mise en page publique (sans coque CCAS ni sélecteur d'utilisateur), mobile d'abord, gros caractères. */
export default async function LayoutInscription({ children }: LayoutProps<"/inscription">) {
  const commune = await communePublique();
  return (
    <div className="flex min-h-dvh flex-col text-lg">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3">
        Aller au formulaire
      </a>
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-0.5 px-4 py-4 sm:px-6">
          <p className="text-xl font-bold leading-tight">{commune.structureNom}</p>
          <p className="text-base text-muted-foreground">Registre des personnes vulnérables · Ville de {commune.nom}</p>
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t bg-card print:hidden">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 text-base text-muted-foreground sm:px-6">
          {commune.structureNom} · <a className="text-primary underline" href={`tel:${commune.structureTelephone.replace(/\s/g, "")}`}>{commune.structureTelephone}</a>
        </div>
      </footer>
    </div>
  );
}
