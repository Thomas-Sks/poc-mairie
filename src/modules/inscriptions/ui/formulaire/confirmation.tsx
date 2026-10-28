"use client";

import type { RefObject } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccuseReception } from "../../domain/transformation";
import type { CommuneFormulaire } from "./etapes-formulaire";

/** E7-US4 — Accusé de réception affiché au demandeur (l'envoi du SMS ou de l'email est simulé). */
export function Confirmation({
  reference,
  accuse,
  commune,
  onRecommencer,
  titreRef,
}: {
  reference: string;
  accuse: AccuseReception | null;
  commune: CommuneFormulaire;
  onRecommencer: () => void;
  titreRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <CircleCheck className="size-12 text-ok" aria-hidden />
        <h1 ref={titreRef} tabIndex={-1} className="text-[1.75rem] font-bold leading-tight outline-none">
          Votre demande d&apos;inscription a bien été reçue
        </h1>
        <p className="text-lg">
          Référence de votre demande : <strong className="tabular whitespace-nowrap">{reference}</strong>
        </p>
        {accuse && (
          <p role="status" className="text-lg">
            {accuse.canal === "sms" ? "Un SMS de confirmation vient d'être envoyé au " : "Un email de confirmation vient d'être envoyé à "}
            <strong>{accuse.destinataire}</strong>.
          </p>
        )}
      </div>

      <section aria-labelledby="titre-suite" className="flex flex-col gap-3 border-t border-input pt-6 text-lg">
        <h2 id="titre-suite" className="text-xl font-bold">
          Et maintenant ?
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>Un agent de la {commune.structureNom} vérifie votre demande, et vous appelle si une information manque.</li>
          <li>Une fois l&apos;inscription validée, vous êtes inscrit(e) au registre des personnes vulnérables de {commune.nom}.</li>
          <li>En cas d&apos;alerte (canicule, grand froid, inondation…), nous prendrons de vos nouvelles par téléphone.</li>
        </ol>
        <p>
          Une question, un changement de situation ? Appelez le{" "}
          <a className="font-semibold text-primary underline" href={`tel:${commune.structureTelephone.replace(/\s/g, "")}`}>
            {commune.structureTelephone}
          </a>
          .
        </p>
      </section>

      <Button variant="outline" size="lg" className="h-14 self-start text-lg" onClick={onRecommencer}>
        Inscrire une autre personne
      </Button>
    </div>
  );
}
