import Link from "next/link";
import type { Role } from "@/shared/domain/vocabulaire";
import { SelecteurUtilisateur } from "@/shared/ui/selecteur-utilisateur";
import { IndicateurReseau } from "./indicateur-reseau";

/** En-tête minimal (E10-US8 : pas de menu) : structure, « Je n'ai plus de temps », sélecteur du POC. */
export function EnTeteBenevole({
  structure,
  utilisateurs,
  courantId,
}: {
  structure: string;
  utilisateurs: { id: string; prenom: string; nom: string; role: Role }[];
  courantId: string;
}) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <Link href="/benevole" className="min-w-0 font-semibold leading-snug">
            {structure}
          </Link>
          <Link
            href="/benevole/rendre"
            className="inline-flex min-h-12 shrink-0 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Je n&apos;ai plus de temps
          </Link>
        </div>
        <div className="flex justify-end">
          <SelecteurUtilisateur utilisateurs={utilisateurs} courantId={courantId} />
        </div>
        <div className="empty:hidden sm:basis-full">
          <IndicateurReseau />
        </div>
      </div>
    </header>
  );
}
