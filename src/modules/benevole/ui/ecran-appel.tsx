"use client";

/**
 * E10-US4 écran « Appel » : une personne à la fois, contenu strictement limité (RG-07).
 * Prend le verrou d'appel à l'ouverture et le rend à la sortie.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  DoorClosed,
  HandHelping,
  House,
  Info,
  MessageSquareText,
  PhoneMissed,
  PhoneOff,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Besoin, StatutCible } from "@/shared/domain/vocabulaire";
import { Bandeau, Surface } from "@/shared/ui/elements";
import type { EcranAppel as DonneesAppel } from "../application/appel";
import { besoinsPreselectionnes } from "../domain/besoins";
import type { ResultatAppel } from "../domain/resultats";
import { estPreoccupante, evaluerReponses, type Reponse, type Reponses } from "../domain/questions";
import { nomPrononce } from "../domain/script";
import { libererVerrouAction, prendreVerrouAction } from "./actions";
import { BoutonAppeler, EcranBesoin, EcranCercle, EcranDanger, EcranTermine, lienTel } from "./ecrans-suite";
import { envoyerOuMettreEnFile, type IssueEnvoiClient } from "./file-attente";
import type { NouvelleOperation } from "./operations";

type Etape =
  | { nom: "appel" }
  | { nom: "besoin" }
  | { nom: "cercle" }
  | { nom: "danger"; consigne: string | null; precision: string }
  | { nom: "termine"; message: string };

const BOUTONS: { resultat: ResultatAppel; libelle: string; icone: LucideIcon }[] = [
  { resultat: "tout_va_bien", libelle: "Joint – tout va bien", icone: CircleCheck },
  { resultat: "besoin", libelle: "Joint – a besoin de quelque chose", icone: HandHelping },
  { resultat: "ne_repond_pas", libelle: "Ne répond pas", icone: PhoneMissed },
  { resultat: "mauvais_numero", libelle: "Mauvais numéro", icone: PhoneOff },
  { resultat: "absent", libelle: "Absent (n'est pas chez lui)", icone: DoorClosed },
  { resultat: "evacuation", libelle: "Doit quitter son logement", icone: House },
  { resultat: "danger", libelle: "Danger – urgence", icone: Siren },
];

const RESULTAT_DU_STATUT: Partial<Record<StatutCible, ResultatAppel>> = {
  joint_besoin: "besoin",
  danger: "danger",
  evacuation: "evacuation",
};

const intervalleVerrouMs = 4 * 60_000;

export function EcranAppel({ donnees }: { donnees: DonneesAppel }) {
  const { cibleId, script } = donnees;
  const personne = `${donnees.civilite} ${donnees.prenom} ${nomPrononce(donnees.nom)}`;
  const feminin = donnees.civilite === "Mme";

  const [etape, setEtape] = useState<Etape>({ nom: "appel" });
  const [reponses, setReponses] = useState<Reponses>({});
  const [encartOuvert, setEncartOuvert] = useState(false);
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [horsConnexion, setHorsConnexion] = useState(false);
  const [occupe, setOccupe] = useState(donnees.verrouilleParAutre);
  const [demandeInfo, setDemandeInfo] = useState<string | null>(null);
  const fini = useRef(false);

  const evaluation = useMemo(() => evaluerReponses(script.questions, reponses), [script.questions, reponses]);
  const propose = evaluation.statutPropose ? RESULTAT_DU_STATUT[evaluation.statutPropose] : undefined;
  const principal: ResultatAppel = propose ?? "tout_va_bien";
  const avecEvacuation = script.questions.some((q) => q.statutPropose === "evacuation");

  // Verrou d'appel (E8-US7) : pris à l'ouverture, entretenu, rendu à la sortie.
  useEffect(() => {
    let actif = true;
    const prendre = () =>
      prendreVerrouAction(cibleId)
        .then((ok) => {
          if (actif && !ok && !fini.current) setOccupe(true);
        })
        .catch(() => {});
    void prendre();
    const entretien = window.setInterval(() => {
      if (!fini.current) void prendre();
    }, intervalleVerrouMs);
    const quitter = () => {
      if (!fini.current) navigator.sendBeacon(`/benevole/appel/${cibleId}/liberer`);
    };
    window.addEventListener("pagehide", quitter);
    return () => {
      actif = false;
      window.clearInterval(entretien);
      window.removeEventListener("pagehide", quitter);
      if (!fini.current) libererVerrouAction(cibleId).catch(() => {});
    };
  }, [cibleId]);

  async function envoyer(op: NouvelleOperation): Promise<IssueEnvoiClient> {
    setEnvoi(true);
    try {
      const issue = await envoyerOuMettreEnFile(op);
      if (issue.etat === "en_attente") setHorsConnexion(true);
      if (issue.etat === "refuse") toast.error(issue.message);
      return issue;
    } finally {
      setEnvoi(false);
    }
  }

  function terminer(message: string) {
    fini.current = true;
    setEtape({ nom: "termine", message });
    window.scrollTo(0, 0);
  }

  function aller(e: Etape) {
    setEtape(e);
    window.scrollTo(0, 0);
  }

  const operationResultat = (resultat: ResultatAppel, extra: { besoins?: Besoin[]; precision?: string } = {}): NouvelleOperation => ({
    type: "resultat",
    cibleId,
    resultat,
    reponses,
    besoins: extra.besoins ?? [],
    note: note || null,
    precision: extra.precision || null,
  });

  async function choisirResultat(resultat: ResultatAppel) {
    if (resultat === "besoin") return aller({ nom: "besoin" });
    if (resultat === "danger") return aller({ nom: "danger", consigne: null, precision: "" });
    if (resultat === "ne_repond_pas") {
      fini.current = true; // le verrou est rendu par l'enregistrement
      void envoyer(operationResultat("ne_repond_pas"));
      return aller({ nom: "cercle" });
    }
    const issue = await envoyer(operationResultat(resultat));
    if (issue.etat === "refuse") return;
    const messages: Partial<Record<ResultatAppel, string>> = {
      tout_va_bien: `${personne} va bien.`,
      mauvais_numero: "L'équipe va vérifier le numéro.",
      absent: `${personne} n'est pas chez ${feminin ? "elle" : "lui"} : c'est noté pour aujourd'hui.`,
      evacuation: "L'équipe du CCAS est prévenue et organise le relogement.",
    };
    terminer(messages[resultat] ?? "Le résultat est enregistré.");
  }

  async function demanderVisite() {
    const issue = await envoyer({ type: "demande", cibleId, nature: "visite", sujet: null });
    if (issue.etat !== "refuse") toast.success("Demande de visite transmise à l'équipe");
  }

  async function demanderInfos() {
    if (!demandeInfo?.trim()) return;
    const issue = await envoyer({ type: "demande", cibleId, nature: "info", sujet: demandeInfo });
    if (issue.etat !== "refuse") {
      toast.success("Demande d'information transmise à l'équipe");
      setDemandeInfo(null);
    }
  }

  // ─── Écrans de suite ───
  if (etape.nom === "termine") return <EcranTermine message={etape.message} horsConnexion={horsConnexion} />;
  if (etape.nom === "cercle") {
    return (
      <EcranCercle
        personne={personne}
        cercle={donnees.cercle}
        envoi={envoi}
        onResultat={async (proche, r) => {
          const issue = await envoyer({ type: "proche", cibleId, lienId: proche.lienId, resultat: r, note: null });
          if (issue.etat === "refuse" || r === "ne_repond_pas") return;
          terminer(r === "confirme" ? `${proche.prenom} confirme que tout va bien.` : `${proche.prenom} va passer voir ${personne}.`);
        }}
        onTerminer={() => terminer(`${personne} sera rappelé(e) plus tard.`)}
      />
    );
  }
  if (etape.nom === "danger") {
    return (
      <EcranDanger
        consigne={etape.consigne}
        precisionInitiale={etape.precision}
        envoi={envoi}
        onAnnuler={() => aller({ nom: "appel" })}
        onPrevenir={async (precision) => {
          const issue = await envoyer(operationResultat("danger", { precision }));
          if (issue.etat === "refuse") return;
          toast.success("SMS envoyé à l'astreinte (simulation)");
          terminer("L'équipe du CCAS et l'astreinte sont prévenues. Restez joignable si possible.");
        }}
      />
    );
  }
  if (etape.nom === "besoin") {
    return (
      <EcranBesoin
        personne={personne}
        feminin={feminin}
        preselection={besoinsPreselectionnes(evaluation.besoins)}
        envoi={envoi}
        onAnnuler={() => aller({ nom: "appel" })}
        onTransmettre={async (besoins, precision) => {
          const issue = await envoyer(operationResultat("besoin", { besoins, precision }));
          if (issue.etat === "refuse") return;
          terminer("Le besoin est transmis à l'équipe du CCAS, qui s'en occupe.");
        }}
      />
    );
  }

  // ─── Écran « Appel » ───
  if (occupe) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <h1 className="text-[1.75rem] font-bold leading-tight">Quelqu&apos;un appelle déjà {personne}</h1>
        <p>Une autre personne de l&apos;équipe est en ligne avec {feminin ? "elle" : "lui"}. Passez à la personne suivante.</p>
        <Link href="/benevole/suivante" className="inline-flex h-16 items-center justify-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground">
          Personne suivante
        </Link>
      </div>
    );
  }

  const [telephone, ...autresTelephones] = donnees.telephones;
  const numerosUtiles = [...script.numerosUtiles, { libelle: donnees.structure.nom, numero: donnees.structure.telephone }];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/benevole" className="inline-flex min-h-12 items-center gap-2 self-start font-semibold text-primary hover:underline">
        <ArrowLeft className="size-5" aria-hidden />
        Ma liste
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-[2rem] font-bold leading-tight">{personne}</h1>
            <p className="text-xl text-muted-foreground">{donnees.age} ans</p>
          </div>

          {donnees.infoPrioritaire && (
            <Bandeau ton="warn" className="flex items-start gap-3 text-lg">
              <Info className="mt-0.5 size-6 shrink-0" aria-hidden />
              {donnees.infoPrioritaire}
            </Bandeau>
          )}

          <Surface className="flex flex-col gap-3 p-5 sm:p-6">
            {telephone ? (
              <>
                <BoutonAppeler numero={telephone.numero} libelle={`Appeler ${feminin ? "Mme" : "M."} ${nomPrononce(donnees.nom)}`} />
                {autresTelephones.map((t) => (
                  <p key={t.numero} className="text-muted-foreground">
                    Autre numéro ({t.libelle.toLocaleLowerCase("fr-FR")}) :{" "}
                    <a href={lienTel(t.numero)} className="tabular whitespace-nowrap font-semibold text-primary underline underline-offset-4">
                      {t.numero}
                    </a>
                  </p>
                ))}
              </>
            ) : (
              <p className="font-semibold">Pas de numéro enregistré : demandez une visite à domicile ci-dessous.</p>
            )}
          </Surface>

          <Surface aria-labelledby="titre-script" className="flex flex-col divide-y">
            <div className="flex flex-col gap-3 p-5 sm:p-6">
              <h2 id="titre-script" className="flex items-center gap-2 text-xl font-semibold">
                <MessageSquareText className="size-6 text-primary" aria-hidden />
                Ce que vous pouvez dire
              </h2>
              <p className="max-w-[65ch]">« {script.introduction} »</p>
            </div>

            {script.questions.map((q, i) => {
              const reponse = reponses[q.id];
              const inquietant = estPreoccupante(q, reponse);
              const repondre = (r: Reponse) => {
                const suivantes = { ...reponses, [q.id]: r };
                setReponses(suivantes);
                if (q.afficherEncart && estPreoccupante(q, r)) setEncartOuvert(true);
              };
              return (
                <fieldset key={q.id} className="flex flex-col gap-3 p-5 sm:p-6">
                  <legend className="float-left mb-3 w-full font-semibold">
                    <span className="text-muted-foreground">Question {i + 1}. </span>
                    {q.texte}
                  </legend>
                  <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                    {(["oui", "non"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={reponse === r}
                        onClick={() => repondre(r)}
                        className={cn(
                          "h-12 rounded-lg border text-lg font-semibold",
                          reponse === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                        )}
                      >
                        {r === "oui" ? "Oui" : "Non"}
                      </button>
                    ))}
                  </div>
                  {inquietant && q.consigne && (
                    <p className="flex items-start gap-2 font-semibold text-warn">
                      <Info className="mt-1 size-5 shrink-0" aria-hidden />
                      <span>À dire : « {q.consigne} »</span>
                    </p>
                  )}
                  {inquietant && q.tag && (
                    <p className="text-muted-foreground">C&apos;est noté : l&apos;équipe saura que {feminin ? "elle" : "il"} se sent seul{feminin ? "e" : ""}.</p>
                  )}
                  {inquietant && q.afficherEncart && script.encart && (
                    <p className="font-semibold text-warn">Lisez-lui les {script.encart.titre.toLocaleLowerCase("fr-FR")} ci-dessous.</p>
                  )}
                </fieldset>
              );
            })}

            {script.encart && (
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-expanded={encartOuvert}
                  aria-controls="encart-recommandations"
                  onClick={() => setEncartOuvert(!encartOuvert)}
                  className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 text-left text-lg font-semibold hover:bg-muted sm:px-6"
                >
                  {script.encart.titre}
                  <ChevronDown className={cn("size-6 shrink-0", encartOuvert && "rotate-180")} aria-hidden />
                </button>
                {encartOuvert && (
                  <ul id="encart-recommandations" className="flex list-disc flex-col gap-2 px-5 pb-5 pl-10 sm:px-6 sm:pl-11">
                    {script.encart.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 p-5 sm:p-6">
              <p className="max-w-[65ch]">« {script.conclusion} »</p>
            </div>

            {script.boutonsSpecifiques.length > 0 && (
              <div className="flex flex-col gap-3 p-5 sm:p-6">
                {script.boutonsSpecifiques.map((b) => (
                  <Button
                    key={b.libelle}
                    variant="destructive"
                    size="lg"
                    className="h-auto min-h-14 justify-start gap-3 whitespace-normal py-3 text-left text-lg"
                    onClick={() => aller({ nom: "danger", consigne: b.consigne, precision: b.libelle })}
                  >
                    <Siren className="size-6 shrink-0" aria-hidden />
                    {b.libelle}
                  </Button>
                ))}
              </div>
            )}
          </Surface>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Surface aria-labelledby="titre-resultat" className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 id="titre-resultat" className="text-xl font-semibold">
              Comment s&apos;est passé l&apos;appel ?
            </h2>
            <div className="flex flex-col gap-3">
              {BOUTONS.filter((b) => b.resultat !== "evacuation" || avecEvacuation).map((b) => {
                const Icone = b.icone;
                const estPrincipal = b.resultat === principal;
                const danger = b.resultat === "danger";
                return (
                  <Button
                    key={b.resultat}
                    size="lg"
                    variant={estPrincipal && !danger ? "default" : danger ? "destructive" : "outline"}
                    disabled={envoi}
                    onClick={() => choisirResultat(b.resultat)}
                    className={cn(
                      "h-auto min-h-14 justify-start gap-3 whitespace-normal py-3 text-left text-lg",
                      estPrincipal && danger && "bg-err text-white hover:bg-err/90",
                    )}
                  >
                    <Icone className="size-6 shrink-0" aria-hidden />
                    {b.libelle}
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 border-t pt-4">
              <label htmlFor="note-appel" className="font-semibold">
                Note <span className="font-normal text-muted-foreground">(facultatif)</span>
              </label>
              <Textarea id="note-appel" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="min-h-24 text-lg" />
            </div>
            <div className="flex flex-col gap-3 border-t pt-4">
              <Button variant="outline" size="lg" disabled={envoi} onClick={demanderVisite} className="h-auto min-h-14 justify-start gap-3 whitespace-normal py-3 text-left text-lg">
                <House className="size-6 shrink-0" aria-hidden />
                Besoin d&apos;une visite à domicile
              </Button>
              {demandeInfo === null ? (
                <Button variant="outline" size="lg" onClick={() => setDemandeInfo("")} className="h-auto min-h-14 justify-start gap-3 whitespace-normal py-3 text-left text-lg">
                  <Info className="size-6 shrink-0" aria-hidden />
                  Demande d&apos;info sur des services seniors
                </Button>
              ) : (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void demanderInfos();
                  }}
                >
                  <label htmlFor="sujet-info" className="font-semibold">
                    Sur quel sujet ?
                  </label>
                  <Input
                    id="sujet-info"
                    autoFocus
                    value={demandeInfo}
                    maxLength={300}
                    onChange={(e) => setDemandeInfo(e.target.value)}
                    placeholder="Ex. : portage de repas, téléalarme"
                    className="h-12 text-lg"
                  />
                  <div className="flex gap-3">
                    <Button type="submit" variant="outline" size="lg" disabled={envoi || !demandeInfo.trim()} className="flex-1 text-lg">
                      Envoyer la demande
                    </Button>
                    <Button type="button" variant="ghost" size="lg" onClick={() => setDemandeInfo(null)} className="text-lg">
                      Annuler
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Surface>
        </div>
      </div>

      <footer aria-label="Numéros utiles" className="flex flex-col gap-2 border-t pt-4">
        <h2 className="font-semibold">Numéros utiles</h2>
        <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-8">
          {numerosUtiles.map((n) => (
            <li key={n.libelle}>
              {n.libelle} :{" "}
              <a href={lienTel(n.numero)} className="tabular whitespace-nowrap font-semibold text-primary underline underline-offset-4">
                {n.numero}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
