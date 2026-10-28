"use client";
/**
 * Champs de formulaire (natifs, accessibles) et soumission des Server Actions sans réinitialisation du formulaire.
 */
import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ETAT_INITIAL, type EtatAction } from "./etat-action";

/**
 * Soumet le formulaire à une Server Action via useActionState, sans la réinitialisation automatique
 * de React 19 (on garde la saisie en cas d'erreur). `onSucces` est appelé une fois par réponse réussie.
 */
export function useFormulaire(action: (etat: EtatAction, fd: FormData) => Promise<EtatAction>, onSucces?: (etat: EtatAction) => void) {
  const [etat, executer, enCours] = useActionState(action, ETAT_INITIAL);
  const dernierJeton = useRef<number | undefined>(undefined);
  const rappel = useRef(onSucces);
  useEffect(() => {
    rappel.current = onSucces;
  });
  useEffect(() => {
    if (etat.jeton === undefined || etat.jeton === dernierJeton.current) return;
    dernierJeton.current = etat.jeton;
    if (etat.ok) {
      if (etat.message) toast.success(etat.message);
      rappel.current?.(etat);
    }
  }, [etat]);

  const onSubmit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const submitter = (ev.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(ev.currentTarget, submitter instanceof HTMLButtonElement ? submitter : null);
    startTransition(() => executer(fd));
  };
  return { etat, onSubmit, enCours };
}

/** Exécute une action ponctuelle (bouton) et affiche le résultat en toast. */
export async function lancer(action: () => Promise<EtatAction>) {
  const etat = await action();
  if (etat.ok) toast.success(etat.message ?? "Enregistré.");
  else toast.error(etat.message ?? "L'action n'a pas abouti.");
  return etat;
}

export function MessageErreur({ etat }: { etat: EtatAction }) {
  if (etat.ok || !etat.message) return null;
  return (
    <p role="alert" className="font-medium text-err">
      {etat.message}
    </p>
  );
}

const CLASSE_CONTROLE =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50";

type ProprietesChamp = { libelle: ReactNode; erreur?: string; aide?: ReactNode; className?: string; requis?: boolean };

/** Libellé + contrôle + aide + erreur, reliés par id (RGAA). */
export function Champ({
  libelle,
  erreur,
  aide,
  className,
  requis,
  children,
}: ProprietesChamp & { children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode }) {
  const id = useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-medium">
        {libelle}
        {requis && <span className="text-err"> *</span>}
      </label>
      {children({ id, "aria-invalid": erreur ? true : undefined, "aria-describedby": [idAide, idErreur].filter(Boolean).join(" ") || undefined })}
      {aide && (
        <p id={idAide} className="text-sm text-muted-foreground">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={idErreur} className="text-sm font-medium text-err">
          {erreur}
        </p>
      )}
    </div>
  );
}

export function ChampTexte({
  libelle,
  erreur,
  aide,
  className,
  requis,
  ...input
}: ProprietesChamp & React.ComponentProps<"input">) {
  return (
    <Champ libelle={libelle} erreur={erreur} aide={aide} className={className} requis={requis}>
      {(a11y) => <input {...a11y} {...input} required={requis} className={CLASSE_CONTROLE} />}
    </Champ>
  );
}

export function ChampZoneTexte({ libelle, erreur, aide, className, requis, ...zone }: ProprietesChamp & React.ComponentProps<"textarea">) {
  return (
    <Champ libelle={libelle} erreur={erreur} aide={aide} className={className} requis={requis}>
      {(a11y) => <textarea rows={3} {...a11y} {...zone} required={requis} className={cn(CLASSE_CONTROLE, "h-auto min-h-24 py-2")} />}
    </Champ>
  );
}

export function ChampSelect({
  libelle,
  erreur,
  aide,
  className,
  requis,
  options,
  vide,
  ...select
}: ProprietesChamp & React.ComponentProps<"select"> & { options: { valeur: string; libelle: string }[]; vide?: string }) {
  return (
    <Champ libelle={libelle} erreur={erreur} aide={aide} className={className} requis={requis}>
      {(a11y) => (
        <select {...a11y} {...select} required={requis} className={cn(CLASSE_CONTROLE, "pr-8")}>
          {vide !== undefined && <option value="">{vide}</option>}
          {options.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
      )}
    </Champ>
  );
}

/** Case à cocher avec zone cliquable ≥ 44 px. */
export function CaseACocher({ libelle, aide, className, ...input }: { libelle: ReactNode; aide?: ReactNode; className?: string } & React.ComponentProps<"input">) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", className)}>
      <input type="checkbox" {...input} className="mt-0.5 size-5 shrink-0 accent-primary" />
      <span className="flex flex-col">
        <span>{libelle}</span>
        {aide && <span className="text-sm text-muted-foreground">{aide}</span>}
      </span>
    </label>
  );
}

/** Groupe de cases (valeurs multiples sous un même nom). */
export function GroupeCases({
  legende,
  name,
  options,
  valeurs = [],
  erreur,
  colonnes = 2,
}: {
  legende: ReactNode;
  name: string;
  options: { valeur: string; libelle: string }[];
  valeurs?: string[];
  erreur?: string;
  colonnes?: 2 | 3 | 4 | 7;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[0.9375rem] font-medium">{legende}</legend>
      <div
        className={cn(
          "grid gap-x-4",
          colonnes === 2 && "sm:grid-cols-2",
          colonnes === 3 && "sm:grid-cols-3",
          colonnes === 4 && "grid-cols-2 sm:grid-cols-4",
          colonnes === 7 && "grid-cols-4 sm:grid-cols-7",
        )}
      >
        {options.map((o) => (
          <CaseACocher key={o.valeur} name={name} value={o.valeur} defaultChecked={valeurs.includes(o.valeur)} libelle={o.libelle} />
        ))}
      </div>
      {erreur && <p className="text-sm font-medium text-err">{erreur}</p>}
    </fieldset>
  );
}

/** Choix Oui / Non / non renseigné (valeurs « oui », « non », «  »). */
export function ChoixOuiNon({ libelle, name, valeur }: { libelle: ReactNode; name: string; valeur: boolean | null }) {
  const defaut = valeur === true ? "oui" : valeur === false ? "non" : "";
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[0.9375rem] font-medium">{libelle}</legend>
      <div className="flex flex-wrap gap-x-5">
        {[
          { v: "oui", l: "Oui" },
          { v: "non", l: "Non" },
          { v: "", l: "Ne sait pas" },
        ].map((o) => (
          <label key={o.v} className="flex min-h-11 cursor-pointer items-center gap-2">
            <input type="radio" name={name} value={o.v} defaultChecked={defaut === o.v} className="size-5 accent-primary" />
            {o.l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
