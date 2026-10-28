"use client";

import dynamic from "next/dynamic";
import type { CommuneFormulaire } from "./etapes-formulaire";

/** Le formulaire lit son brouillon dans le navigateur : il n'est donc rendu que côté client. */
const FormulaireSansSsr = dynamic(() => import("./formulaire-inscription").then((m) => m.FormulaireInscription), {
  ssr: false,
  loading: () => <p className="text-lg text-muted-foreground">Chargement du formulaire…</p>,
});

export function ChargeurFormulaire({ commune }: { commune: CommuneFormulaire }) {
  return <FormulaireSansSsr commune={commune} />;
}
