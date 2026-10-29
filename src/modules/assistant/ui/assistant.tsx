"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PastillePriorite, Surface } from "@/shared/ui/elements";
import type { PersonneListee, ReponseAssistant } from "../domain/reponse";
import { poserQuestionAction } from "./actions";

type Echange = { id: number; question: string; reponse: ReponseAssistant | null; erreur: string | null };

/** Assistant : une question, une réponse. Les plus récentes en haut, juste sous le champ. */
export function Assistant({ questionInitiale, suggestions }: { questionInitiale: string | null; suggestions: readonly string[] }) {
  const [texte, setTexte] = useState("");
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const [enCours, demarrer] = useTransition();
  const compteur = useRef(0);
  const initiale = useRef(false);

  const poser = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const id = ++compteur.current;
    setEchanges((e) => [{ id, question: q, reponse: null, erreur: null }, ...e]);
    setTexte("");
    demarrer(async () => {
      const r = await poserQuestionAction(q);
      setEchanges((e) => e.map((x) => (x.id === id ? { ...x, reponse: r.ok ? r.reponse : null, erreur: r.ok ? null : r.erreur } : x)));
    });
  };

  useEffect(() => {
    if (questionInitiale && !initiale.current) {
      initiale.current = true;
      poser(questionInitiale);
    }
  }, [questionInitiale]);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          poser(texte);
        }}
      >
        <Label htmlFor="question" className="text-base font-semibold">
          Votre question
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="question"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ex. Liste des personnes P1 qui vivent seules"
            autoComplete="off"
            maxLength={300}
            className="h-12 flex-1 text-lg"
          />
          <Button type="submit" size="lg" className="h-12" disabled={enCours || !texte.trim()}>
            <Send aria-hidden />
            Poser la question
          </Button>
        </div>
      </form>

      {echanges.length === 0 && <Suggestions titre="Exemples de questions" suggestions={suggestions} poser={poser} />}

      <div className="flex flex-col gap-6" aria-live="polite">
        {echanges.map((e) => (
          <section key={e.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{e.question}</h2>
            {e.erreur ? (
              <p className="text-err">{e.erreur}</p>
            ) : e.reponse ? (
              <Reponse question={e.question} reponse={e.reponse} poser={poser} />
            ) : (
              <p className="text-muted-foreground">Je cherche…</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Suggestions({ titre, suggestions, poser }: { titre?: string; suggestions: readonly string[]; poser: (q: string) => void }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {titre && <p className="font-semibold">{titre}</p>}
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <Button variant="outline" className="h-auto min-h-11 w-full justify-start py-2 text-left whitespace-normal" onClick={() => poser(s)}>
              {s}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Compris({ puces }: { puces: string[] }) {
  if (puces.length === 0) return null;
  return <p className="text-muted-foreground">J&apos;ai compris : {puces.join(" · ")}</p>;
}

function Reponse({ question, reponse, poser }: { question: string; reponse: ReponseAssistant; poser: (q: string) => void }) {
  switch (reponse.type) {
    case "nombre":
      return (
        <Surface className="flex flex-col gap-4 p-5 sm:p-6">
          <p className="tabular text-3xl font-bold">{reponse.phrase}</p>
          <Compris puces={reponse.compris} />
          {reponse.lignes.length > 0 && (
            <ul className="flex flex-col gap-3 border-t pt-4">
              {reponse.lignes.map((l) => (
                <li key={l.libelle} className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3">
                  <span className="truncate">{l.libelle}</span>
                  <span className="h-3 rounded-sm bg-accent" aria-hidden>
                    <span className="block h-full rounded-sm bg-primary" style={{ width: `${Math.round(l.part * 100)}%` }} />
                  </span>
                  <span className="tabular font-semibold">{l.effectif}</span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      );
    case "personnes":
      return (
        <Surface className="flex flex-col">
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <p className="text-xl font-semibold">{reponse.phrase}</p>
            <Compris puces={reponse.compris} />
            {reponse.telechargeable && (
              <a href={`/api/assistant/export?q=${encodeURIComponent(question)}`} className={cn(buttonVariants(), "w-fit")} download>
                <Download aria-hidden />
                Télécharger en Excel
              </a>
            )}
          </div>
          <ListePersonnes personnes={reponse.personnes} />
        </Surface>
      );
    case "fiches":
      return (
        <Surface className="flex flex-col">
          <p className="p-5 text-xl font-semibold sm:p-6">{reponse.phrase}</p>
          <ListePersonnes personnes={reponse.personnes} />
        </Surface>
      );
    case "message":
      return (
        <div className="flex flex-col gap-3">
          <p>{reponse.phrase}</p>
          <Suggestions suggestions={reponse.suggestions} poser={poser} />
        </div>
      );
  }
}

function ListePersonnes({ personnes }: { personnes: PersonneListee[] }) {
  if (personnes.length === 0) return null;
  return (
    <ul className="divide-y border-t">
      {personnes.map((p) => (
        <li key={p.id}>
          <Link href={`/beneficiaires/${p.id}`} className="flex min-h-14 items-center gap-3 px-5 py-2 hover:bg-muted sm:px-6">
            <PastillePriorite niveau={p.priorite} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">
                {p.civilite} {p.prenom} {p.nom}, {p.age} ans
              </span>
              <span className="truncate text-sm text-muted-foreground">{[p.adresse, p.telephone].filter(Boolean).join(" · ")}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
