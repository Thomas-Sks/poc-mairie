"use client";

/**
 * Écrans qui suivent un résultat : « Qui appeler ensuite ? » (E10-US5), « Danger » (E10-US6),
 * choix du besoin (E10-US7) et fin d'appel.
 */
import { useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleCheck,
  Droplet,
  Ellipsis,
  House,
  Phone,
  PhoneForwarded,
  PhoneMissed,
  Pill,
  ShoppingBasket,
  Siren,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BESOIN_LIBELLES, RELATION_LIBELLES, type Besoin } from "@/shared/domain/vocabulaire";
import { Bandeau, Surface } from "@/shared/ui/elements";
import type { ProcheAAppeler } from "../application/ports";
import { BESOINS_RAPIDES } from "../domain/besoins";
import { RESULTAT_PROCHE_LIBELLES, type ResultatProche } from "../domain/resultats";
import { useEtatFile } from "./file-attente";

export const lienTel = (numero: string) => `tel:${numero.replace(/[^\d+]/g, "")}`;

/** Grand bouton d'appel : lien `tel:` sur mobile, numéro en très grand sur ordinateur. */
export function BoutonAppeler({ numero, libelle }: { numero: string; libelle: string }) {
  return (
    <>
      <a href={lienTel(numero)} className={cn(buttonVariants({ size: "lg" }), "h-16 w-full gap-3 text-xl md:hidden")}>
        <Phone className="size-6" aria-hidden />
        {libelle}
      </a>
      <div className="hidden flex-col gap-1 md:flex">
        <span className="text-muted-foreground">Composez le</span>
        <a href={lienTel(numero)} className="tabular text-5xl font-bold tracking-tight text-primary hover:underline">
          {numero}
        </a>
      </div>
    </>
  );
}

function EnTeteEcran({ titre, texte, icone: Icone, ton = "primary" }: { titre: string; texte?: string; icone: LucideIcon; ton?: "primary" | "err" }) {
  return (
    <div className="flex flex-col gap-2">
      <Icone className={cn("size-10", ton === "err" ? "text-err" : "text-primary")} aria-hidden />
      <h1 className={cn("text-[1.75rem] font-bold leading-tight", ton === "err" && "text-err")}>{titre}</h1>
      {texte && <p>{texte}</p>}
    </div>
  );
}

// ─── E10-US5 « Qui appeler ensuite ? » ─────────────────────────────────────────

const ICONES_PROCHE: Record<ResultatProche, LucideIcon> = { confirme: UserCheck, va_passer: House, ne_repond_pas: PhoneMissed };

export function EcranCercle({
  personne,
  cercle,
  envoi,
  onResultat,
  onTerminer,
}: {
  personne: string;
  cercle: ProcheAAppeler[];
  envoi: boolean;
  onResultat: (proche: ProcheAAppeler, resultat: ResultatProche) => void;
  onTerminer: () => void;
}) {
  const [index, setIndex] = useState(0);
  const proche = cercle[index];

  if (!proche) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <EnTeteEcran
          icone={PhoneMissed}
          titre={cercle.length ? "Plus personne à appeler" : "Aucun proche à appeler"}
          texte={`${personne} sera rappelé(e) plus tard. Si plus personne ne répond, l'équipe du CCAS prendra le relais.`}
        />
        <Button size="lg" className="h-14 text-lg" onClick={onTerminer}>
          Terminer
        </Button>
      </div>
    );
  }

  const suivants = cercle.slice(index + 1);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <EnTeteEcran icone={PhoneForwarded} titre="Qui appeler ensuite ?" texte={`${personne} ne répond pas. Appelez son proche :`} />
      <Surface className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col">
          <span className="text-muted-foreground">{RELATION_LIBELLES[proche.relation]}</span>
          <span className="text-2xl font-bold">{proche.prenom}</span>
        </div>
        <BoutonAppeler numero={proche.telephone} libelle={`Appeler ${proche.prenom}`} />
        <div className="flex flex-col gap-3 border-t pt-5">
          <h2 className="font-semibold">Qu&apos;a dit {proche.prenom} ?</h2>
          {(Object.keys(RESULTAT_PROCHE_LIBELLES) as ResultatProche[]).map((r) => {
            const Icone = ICONES_PROCHE[r];
            return (
              <Button
                key={r}
                variant="outline"
                size="lg"
                disabled={envoi}
                className="h-auto min-h-14 justify-start gap-3 whitespace-normal py-3 text-left text-lg"
                onClick={() => {
                  onResultat(proche, r);
                  if (r === "ne_repond_pas") setIndex(index + 1);
                }}
              >
                <Icone className="size-6 shrink-0" aria-hidden />
                {RESULTAT_PROCHE_LIBELLES[r]}
              </Button>
            );
          })}
        </div>
      </Surface>
      {suivants.length > 0 && (
        <p className="text-muted-foreground">
          Ensuite : {suivants.map((p) => `${RELATION_LIBELLES[p.relation]} (${p.prenom})`).join(", ")}
        </p>
      )}
      <Button variant="ghost" size="lg" className="self-start text-lg" onClick={onTerminer}>
        Terminer sans appeler de proche
      </Button>
    </div>
  );
}

// ─── E10-US6 « Danger » ────────────────────────────────────────────────────────

const NUMEROS_URGENCE = [
  { numero: "15", libelle: "SAMU" },
  { numero: "18", libelle: "Pompiers" },
  { numero: "112", libelle: "Urgences" },
  { numero: "114", libelle: "Personnes sourdes ou malentendantes (SMS)" },
] as const;

export function EcranDanger({
  consigne,
  precisionInitiale,
  envoi,
  onPrevenir,
  onAnnuler,
}: {
  consigne: string | null;
  precisionInitiale: string;
  envoi: boolean;
  onPrevenir: (precision: string) => void;
  onAnnuler: () => void;
}) {
  const [precision, setPrecision] = useState(precisionInitiale);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <EnTeteEcran icone={Siren} ton="err" titre="Urgence : appelez les secours" texte="Si la personne est en danger, appelez d'abord les secours." />
      {consigne && <Bandeau ton="err">À dire tout de suite : « {consigne} »</Bandeau>}
      <ul className="grid grid-cols-3 gap-3">
        {NUMEROS_URGENCE.map((n) => (
          <li key={n.numero} className={n.numero === "114" ? "col-span-3" : undefined}>
            <a
              href={lienTel(n.numero)}
              className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-err bg-card px-3 py-2 text-center text-err hover:bg-err-soft"
            >
              <span className="tabular text-3xl font-bold">{n.numero}</span>
              <span className="text-lg">{n.libelle}</span>
            </a>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onPrevenir(precision);
        }}
      >
        <label htmlFor="precision-danger" className="font-semibold">
          Que se passe-t-il ? En une phrase
        </label>
        <Input
          id="precision-danger"
          value={precision}
          maxLength={300}
          onChange={(e) => setPrecision(e.target.value)}
          placeholder="Ex. : elle est tombée et ne peut pas se relever"
          className="h-14 text-lg"
        />
        <Button type="submit" size="lg" disabled={envoi} className="h-16 bg-err text-xl text-white hover:bg-err/90">
          <Siren className="size-6" aria-hidden />
          Prévenir l&apos;équipe du CCAS
        </Button>
      </form>
      <Button variant="ghost" size="lg" className="self-start text-lg" onClick={onAnnuler}>
        Revenir à l&apos;appel
      </Button>
    </div>
  );
}

// ─── E10-US7 Choix du besoin ───────────────────────────────────────────────────

const ICONES_BESOIN: Record<(typeof BESOINS_RAPIDES)[number], LucideIcon> = {
  eau: Droplet,
  courses: ShoppingBasket,
  medicaments: Pill,
  visite: House,
  autre: Ellipsis,
};

export function EcranBesoin({
  personne,
  feminin,
  preselection,
  envoi,
  onTransmettre,
  onAnnuler,
}: {
  personne: string;
  feminin: boolean;
  preselection: Besoin[];
  envoi: boolean;
  onTransmettre: (besoins: Besoin[], precision: string) => void;
  onAnnuler: () => void;
}) {
  const [choix, setChoix] = useState<Besoin[]>(preselection);
  const [precision, setPrecision] = useState("");
  const basculer = (b: Besoin) => setChoix((c) => (c.includes(b) ? c.filter((x) => x !== b) : [...c, b]));
  return (
    <form
      className="mx-auto flex w-full max-w-xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onTransmettre(choix, precision);
      }}
    >
      <EnTeteEcran icone={Check} titre={`De quoi ${feminin ? "a-t-elle" : "a-t-il"} besoin ?`} texte={`Choisissez ce dont ${personne} a besoin. L'équipe du CCAS s'en occupe.`} />
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Besoins</legend>
        {BESOINS_RAPIDES.map((b) => {
          const Icone = ICONES_BESOIN[b];
          const actif = choix.includes(b);
          return (
            <button
              key={b}
              type="button"
              aria-pressed={actif}
              onClick={() => basculer(b)}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-lg font-semibold",
                actif ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                b === "autre" && "col-span-2",
              )}
            >
              <Icone className="size-7" aria-hidden />
              {BESOIN_LIBELLES[b]}
            </button>
          );
        })}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="precision-besoin" className="font-semibold">
          Précision <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <Input
          id="precision-besoin"
          value={precision}
          maxLength={300}
          onChange={(e) => setPrecision(e.target.value)}
          placeholder="Ex. : 2 packs d'eau, ordonnance à la pharmacie"
          className="h-14 text-lg"
        />
      </div>
      <Button type="submit" size="lg" disabled={envoi || choix.length === 0} className="h-16 text-xl">
        Transmettre à l&apos;équipe
      </Button>
      <Button type="button" variant="ghost" size="lg" className="self-start text-lg" onClick={onAnnuler}>
        Revenir à l&apos;appel
      </Button>
    </form>
  );
}

// ─── Fin d'appel ───────────────────────────────────────────────────────────────

export function EcranTermine({ message, horsConnexion }: { message: string; horsConnexion: boolean }) {
  const { enAttente } = useEtatFile();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <EnTeteEcran icone={CircleCheck} titre="C'est noté, merci !" texte={message} />
      {horsConnexion && enAttente > 0 && (
        <Bandeau ton="accent">Pas de réseau pour le moment : le résultat est gardé sur ce téléphone et sera envoyé automatiquement.</Bandeau>
      )}
      <Link href="/benevole/suivante" className={cn(buttonVariants({ size: "lg" }), "h-16 w-full gap-3 text-xl")}>
        <PhoneForwarded className="size-6" aria-hidden />
        Personne suivante
      </Link>
      <Link href="/benevole" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-14 w-full text-lg")}>
        Revenir à ma liste
      </Link>
    </div>
  );
}
