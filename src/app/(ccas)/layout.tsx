import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { utilisateurs } from "@/shared/infrastructure/db/schema";
import { obtenirContexte } from "@/shared/infrastructure/session";
import { MenuLateral, MenuMobile } from "@/shared/ui/menu-lateral";
import { navigationPour } from "@/shared/ui/navigation";
import { SelecteurUtilisateur } from "@/shared/ui/selecteur-utilisateur";
import { CentreNotifications } from "@/modules/notifications/ui/centre-notifications";

/** Coque de l'interface CCAS (admin, agents) : menu latéral sur desktop, tiroir sur mobile/tablette. */
export default async function LayoutCcas({ children }: LayoutProps<"/">) {
  const ctx = await obtenirContexte();
  if (ctx.utilisateur.role === "benevole") redirect("/benevole");

  const equipe = await db
    .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role })
    .from(utilisateurs)
    .where(eq(utilisateurs.communeId, ctx.commune.id))
    .orderBy(asc(utilisateurs.createdAt));

  const entrees = navigationPour(ctx.utilisateur.role);

  return (
    <div className="flex min-h-dvh">
      <MenuLateral entrees={entrees} commune={ctx.commune.nom} structure={ctx.commune.structureNom} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <MenuMobile entrees={entrees} commune={ctx.commune.nom} structure={ctx.commune.structureNom} />
            <span className="font-semibold lg:hidden max-sm:hidden">{ctx.commune.structureNom}</span>
          </div>
          <div className="flex items-center gap-2">
            <CentreNotifications />
            <SelecteurUtilisateur utilisateurs={equipe} courantId={ctx.utilisateur.id} />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
