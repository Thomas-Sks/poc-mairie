"use client";

/**
 * Champs du formulaire public : gros caractères (≥ 18 px), cibles ≥ 48 px, libellés toujours visibles,
 * erreurs reliées au champ (aria-describedby, aria-invalid) — RGAA AA (NF-04, E7-US5).
 */
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** « personnes.0.nom » → « champ-personnes-0-nom » (ancre du récapitulatif d'erreurs). */
export const idChamp = (cle: string) => `champ-${cle.replace(/\./g, "-")}`;

export function MessageErreur({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-2 font-semibold text-err">
      <CircleAlert className="mt-1 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Aide({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-base text-muted-foreground">
      {children}
    </p>
  );
}

const decrit = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

export const classeSaisie =
  "h-12 w-full rounded-lg border border-input bg-card px-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-err aria-invalid:ring-3 aria-invalid:ring-err/20";

export function ChampTexte({
  cle,
  label,
  aide,
  erreur,
  valeur,
  onChange,
  facultatif,
  className,
  ...props
}: {
  cle: string;
  label: string;
  aide?: ReactNode;
  erreur?: string;
  valeur: string;
  onChange: (v: string) => void;
  facultatif?: boolean;
  className?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "id">) {
  const id = idChamp(cle);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-lg font-semibold">
        {label}
        {facultatif && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </label>
      {aide && <Aide id={`${id}-aide`}>{aide}</Aide>}
      {erreur && <MessageErreur id={`${id}-erreur`}>{erreur}</MessageErreur>}
      <input
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit(aide !== undefined && `${id}-aide`, erreur !== undefined && `${id}-erreur`)}
        aria-required={facultatif ? undefined : true}
        className={classeSaisie}
        {...props}
      />
    </div>
  );
}

export function ChampListe({
  cle,
  label,
  erreur,
  valeur,
  onChange,
  options,
  facultatif,
}: {
  cle: string;
  label: string;
  erreur?: string;
  valeur: string;
  onChange: (v: string) => void;
  options: { valeur: string; libelle: string }[];
  facultatif?: boolean;
}) {
  const id = idChamp(cle);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-semibold">
        {label}
        {facultatif && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </label>
      {erreur && <MessageErreur id={`${id}-erreur`}>{erreur}</MessageErreur>}
      <select
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className={classeSaisie}
      >
        <option value="">Choisir…</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Groupe de boutons radio (fieldset + legend). Chaque option est une ligne cliquable de 56 px. */
export function ChoixUnique<T extends string>({
  cle,
  legende,
  aide,
  options,
  valeur,
  onChange,
  erreur,
  facultatif,
  enLigne,
}: {
  cle: string;
  legende: ReactNode;
  aide?: ReactNode;
  options: { valeur: T; libelle: ReactNode; detail?: ReactNode }[];
  valeur: T | "";
  onChange: (v: T) => void;
  erreur?: string;
  facultatif?: boolean;
  enLigne?: boolean;
}) {
  const id = idChamp(cle);
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className="flex flex-col gap-3 outline-none"
      aria-describedby={decrit(aide !== undefined && `${id}-aide`, erreur !== undefined && `${id}-erreur`)}
      aria-invalid={erreur ? true : undefined}
    >
      <legend className="mb-1 text-lg font-semibold">
        {legende}
        {facultatif && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </legend>
      {aide && <Aide id={`${id}-aide`}>{aide}</Aide>}
      {erreur && <MessageErreur id={`${id}-erreur`}>{erreur}</MessageErreur>}
      <div className={cn("flex gap-2", enLigne ? "flex-row flex-wrap" : "flex-col")}>
        {options.map((o) => (
          <label
            key={o.valeur}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 text-lg has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
              enLigne && "min-w-36 flex-1",
              erreur && "border-err",
            )}
          >
            <input
              type="radio"
              name={id}
              value={o.valeur}
              checked={valeur === o.valeur}
              onChange={() => onChange(o.valeur)}
              className="size-6 shrink-0 accent-primary focus-visible:outline-none"
            />
            <span className="flex flex-col">
              <span className="font-medium">{o.libelle}</span>
              {o.detail && <span className="text-base text-muted-foreground">{o.detail}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function OuiNon({
  cle,
  legende,
  aide,
  valeur,
  onChange,
  erreur,
  facultatif,
}: {
  cle: string;
  legende: ReactNode;
  aide?: ReactNode;
  valeur: boolean | null;
  onChange: (v: boolean) => void;
  erreur?: string;
  facultatif?: boolean;
}) {
  return (
    <ChoixUnique
      cle={cle}
      legende={legende}
      aide={aide}
      erreur={erreur}
      facultatif={facultatif}
      enLigne
      options={[
        { valeur: "oui", libelle: "Oui" },
        { valeur: "non", libelle: "Non" },
      ]}
      valeur={valeur === null ? "" : valeur ? "oui" : "non"}
      onChange={(v) => onChange(v === "oui")}
    />
  );
}

export function CaseACocher({
  cle,
  label,
  detail,
  coche,
  onChange,
  erreur,
}: {
  cle: string;
  label: ReactNode;
  detail?: ReactNode;
  coche: boolean;
  onChange: (v: boolean) => void;
  erreur?: string;
}) {
  const id = idChamp(cle);
  return (
    <div className="flex flex-col gap-2">
      {erreur && <MessageErreur id={`${id}-erreur`}>{erreur}</MessageErreur>}
      <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 py-2 text-lg">
        <input
          id={id}
          type="checkbox"
          checked={coche}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `${id}-erreur` : undefined}
          className="mt-0.5 size-6 shrink-0 accent-primary"
        />
        <span className="flex flex-col">
          <span className="font-medium">{label}</span>
          {detail && <span className="text-base text-muted-foreground">{detail}</span>}
        </span>
      </label>
    </div>
  );
}
