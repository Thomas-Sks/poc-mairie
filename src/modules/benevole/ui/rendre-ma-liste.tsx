import Link from "next/link";
import { Clock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rendreMaListeAction } from "./actions";

/** E10-US9 « Je n'ai plus de temps » : confirmation avant de rendre la liste. */
export function RendreMaListe() {
  return (
    <form action={rendreMaListeAction} className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Clock className="size-10 text-primary" aria-hidden />
        <h1 className="text-[1.75rem] font-bold leading-tight">Vous n&apos;avez plus de temps ?</h1>
        <p>
          Pas de souci. Les personnes que vous n&apos;avez pas encore appelées seront confiées à quelqu&apos;un d&apos;autre de
          l&apos;équipe. Les appels déjà faits restent enregistrés.
        </p>
      </div>
      <Button type="submit" size="lg" className="h-16 text-xl">
        Rendre ma liste
      </Button>
      <Link href="/benevole" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-14 text-lg")}>
        Continuer mes appels
      </Link>
    </form>
  );
}
