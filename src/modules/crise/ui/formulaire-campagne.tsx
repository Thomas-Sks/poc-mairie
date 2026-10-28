"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Libelle, Surface } from "@/shared/ui/elements";
import type { ParametresRelance } from "@/shared/domain/campagne";
import { ROLE_LIBELLES, type Canal, type Frequence, type Role, type TypeAlerte } from "@/shared/domain/vocabulaire";
import type { ContenuScript } from "@/shared/infrastructure/db/schema";
import { compterSelectionAction, creerCampagneAction } from "./actions";
import { Champ, ChoixSegmente, classeSelect } from "./champs";
import { CANAL_LIBELLES, FREQUENCE_LIBELLES } from "./libelles";

type Props = {
  alerte: { id: string; type: TypeAlerte };
  nomParDefaut: string;
  script: ContenuScript;
  relance: ParametresRelance;
  listes: { id: string; nom: string; type: "dynamique" | "figee"; nb: number | null }[];
  voies: string[];
  quartiers: string[];
  membres: { id: string; prenom: string; nom: string; role: Role }[];
  nbActifs: number;
  /** Liste présélectionnée (ex. sélection venue du tableau des bénéficiaires). */
  listeIdInitiale?: string;
};

type TypeSource = "tous" | "liste" | "filtre";
type Parite = "tous" | "pair" | "impair";

const entier = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Math.trunc(Number(v))));

/** E9-US2 / E9-US3 : création d'une campagne d'appels à partir d'une alerte. */
export function FormulaireCampagne(props: Props) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const localise = props.alerte.type === "inondation" || props.alerte.type === "tempete";

  // Qui appeler
  const [typeSource, setTypeSource] = useState<TypeSource>(props.listeIdInitiale ? "liste" : localise ? "filtre" : "tous");
  const [listeId, setListeId] = useState(props.listeIdInitiale ?? props.listes[0]?.id ?? "");
  const [voie, setVoie] = useState(localise && props.voies.includes("Rue du Marais") ? "Rue du Marais" : "");
  const [numeroMin, setNumeroMin] = useState(localise ? "1" : "");
  const [numeroMax, setNumeroMax] = useState(localise ? "41" : "");
  const [parite, setParite] = useState<Parite>(localise ? "impair" : "tous");
  const [quartier, setQuartier] = useState("");
  const [nb, setNb] = useState<number | null>(props.nbActifs);

  // Paramètres
  const [nom, setNom] = useState(props.nomParDefaut);
  const [frequence, setFrequence] = useState<Frequence>("quotidienne");
  const [frequenceJours, setFrequenceJours] = useState("2");
  const [canal, setCanal] = useState<Canal>(props.alerte.type === "canicule" || props.alerte.type === "grand_froid" ? "mixte" : "humain");
  const [nbTentatives, setNbTentatives] = useState(String(props.relance.nbTentatives));
  const [delais, setDelais] = useState(props.relance.delaisMinutes.join(", "));
  const [escaladeCercle, setEscaladeCercle] = useState(props.relance.escaladeCercle);
  const [script, setScript] = useState(props.script);

  // Équipe
  const appelants = props.membres.filter((m) => m.role !== "admin" && m.role !== "super_admin");
  const [equipe, setEquipe] = useState<string[]>(appelants.map((m) => m.id));
  const [repartir, setRepartir] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const source =
    typeSource === "tous"
      ? ({ type: "tous" } as const)
      : typeSource === "liste"
        ? ({ type: "liste", listeId } as const)
        : ({
            type: "filtre",
            filtre: { voie: voie || undefined, numeroMin: entier(numeroMin), numeroMax: entier(numeroMax), parite, quartier: quartier || undefined },
          } as const);
  const cleSource = JSON.stringify(source);

  useEffect(() => {
    if (typeSource === "liste" && !listeId) return;
    let annule = false;
    const minuteur = setTimeout(async () => {
      const r = await compterSelectionAction(JSON.parse(cleSource));
      if (!annule) setNb(r.ok ? r.nb : null);
    }, 250);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [cleSource, typeSource, listeId]);

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!nb) {
      setErreur("Aucune personne ne correspond à cette sélection.");
      return;
    }
    const delaisMinutes = delais
      .split(/[,;\s]+/)
      .map((d) => Number(d))
      .filter((d) => Number.isFinite(d) && d > 0);
    demarrer(async () => {
      const r = await creerCampagneAction({
        alerteId: props.alerte.id,
        nom: nom.trim(),
        type: props.alerte.type,
        script,
        frequence,
        frequenceJours: frequence === "tous_n_jours" ? Math.max(2, Number(frequenceJours) || 2) : null,
        canal,
        relance: { ...props.relance, nbTentatives: Math.max(1, Number(nbTentatives) || 3), delaisMinutes, escaladeCercle },
        source,
        equipe,
        repartirAutomatiquement: repartir,
      });
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      toast.success("Campagne lancée : la liste d'appels du jour est prête.");
      for (const sms of r.smsSimules) toast(sms);
      router.push(`/campagnes/${r.campagneId}`);
    });
  };

  const majQuestion = (i: number, texte: string) =>
    setScript((s) => ({ ...s, questions: s.questions.map((q, k) => (k === i ? { ...q, texte } : q)) }));

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-6" noValidate>
      <Surface className="flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="titre-qui">
        <h2 id="titre-qui" className="text-xl font-semibold">
          Qui appeler ?
        </h2>
        <ChoixSegmente
          nom="source"
          libelle="Personnes à appeler"
          valeur={typeSource}
          onChange={setTypeSource}
          options={[
            { valeur: "tous", libelle: "Tous les bénéficiaires actifs" },
            { valeur: "liste", libelle: "Une liste sauvegardée" },
            { valeur: "filtre", libelle: "Une zone géographique" },
          ]}
        />
        {typeSource === "liste" &&
          (props.listes.length === 0 ? (
            <p className="text-muted-foreground">Aucune liste sauvegardée pour l&apos;instant. Créez-en une depuis le tableau des bénéficiaires.</p>
          ) : (
            <Champ id="liste" libelle="Liste">
              <select id="liste" className={classeSelect} value={listeId} onChange={(e) => setListeId(e.target.value)}>
                {props.listes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom} {l.type === "dynamique" ? "(mise à jour automatique)" : `(${l.nb} personnes)`}
                  </option>
                ))}
              </select>
            </Champ>
          ))}
        {typeSource === "filtre" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Champ id="voie" libelle="Rue" className="sm:col-span-2">
              <Input id="voie" list="voies" value={voie} onChange={(e) => setVoie(e.target.value)} placeholder="Ex. Rue du Marais" autoComplete="off" />
              <datalist id="voies">
                {props.voies.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </Champ>
            <Champ id="numero-min" libelle="Du numéro">
              <Input id="numero-min" inputMode="numeric" value={numeroMin} onChange={(e) => setNumeroMin(e.target.value)} />
            </Champ>
            <Champ id="numero-max" libelle="Au numéro">
              <Input id="numero-max" inputMode="numeric" value={numeroMax} onChange={(e) => setNumeroMax(e.target.value)} />
            </Champ>
            <div className="sm:col-span-2">
              <ChoixSegmente
                nom="parite"
                libelle="Côté de la rue"
                valeur={parite}
                onChange={setParite}
                options={[
                  { valeur: "tous", libelle: "Tous les numéros" },
                  { valeur: "impair", libelle: "Numéros impairs" },
                  { valeur: "pair", libelle: "Numéros pairs" },
                ]}
              />
            </div>
            <Champ id="quartier" libelle="Quartier" className="sm:col-span-2">
              <select id="quartier" className={classeSelect} value={quartier} onChange={(e) => setQuartier(e.target.value)}>
                <option value="">Tous les quartiers</option>
                {props.quartiers.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
        )}
        <p className="border-t pt-4 text-lg" aria-live="polite">
          <span className="font-bold tabular">{nb ?? "…"}</span> personne{(nb ?? 0) > 1 ? "s" : ""} concernée{(nb ?? 0) > 1 ? "s" : ""}
          <span className="block text-base text-muted-foreground">
            La liste est figée au lancement. Les personnes couvertes par un passage d&apos;intervenant ou absentes sont exclues automatiquement, avec le motif.
          </span>
        </p>
      </Surface>

      <Surface className="flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="titre-parametres">
        <h2 id="titre-parametres" className="text-xl font-semibold">
          Paramètres
        </h2>
        <Champ id="nom" libelle="Nom de la campagne">
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
        </Champ>
        <div className="flex flex-col gap-3">
          <ChoixSegmente
            nom="frequence"
            libelle="Fréquence"
            valeur={frequence}
            onChange={setFrequence}
            options={(["unique", "quotidienne", "tous_n_jours"] as const).map((f) => ({ valeur: f, libelle: FREQUENCE_LIBELLES[f] }))}
          />
          {frequence === "tous_n_jours" && (
            <Champ id="frequence-jours" libelle="Nombre de jours entre deux appels" className="max-w-xs">
              <Input id="frequence-jours" inputMode="numeric" value={frequenceJours} onChange={(e) => setFrequenceJours(e.target.value)} />
            </Champ>
          )}
        </div>
        <ChoixSegmente
          nom="canal"
          libelle="Canal"
          valeur={canal}
          onChange={setCanal}
          options={(["humain", "mixte", "ia"] as const).map((c) => ({ valeur: c, libelle: CANAL_LIBELLES[c] }))}
        />
        {canal !== "humain" && (
          <p className="text-muted-foreground">
            Démonstration : les appels IA ne sont pas encore disponibles. Des résultats fictifs sont affichés pour les personnes éligibles (consentement IA,
            hors priorité P1).
          </p>
        )}
        <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
          <Champ id="tentatives" libelle="Nombre de tentatives">
            <Input id="tentatives" inputMode="numeric" value={nbTentatives} onChange={(e) => setNbTentatives(e.target.value)} />
          </Champ>
          <Champ id="delais" libelle="Délais entre tentatives (minutes)" aide="Par défaut : 30 puis 120 minutes.">
            <Input id="delais" value={delais} onChange={(e) => setDelais(e.target.value)} />
          </Champ>
          <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
            <Checkbox checked={escaladeCercle} onCheckedChange={(v) => setEscaladeCercle(Boolean(v))} />
            Après la dernière tentative, appeler le cercle de la personne (rang 1, puis 2…)
          </label>
        </div>
      </Surface>

      <Surface className="flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="titre-script">
        <div className="flex flex-col gap-1">
          <h2 id="titre-script" className="text-xl font-semibold">
            Script d&apos;appel
          </h2>
          <p className="text-muted-foreground">Copié depuis le modèle du type d&apos;alerte. Les modifications ne concernent que cette campagne.</p>
        </div>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">
            Modifier le script ({script.questions.length} questions)
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            <Champ id="introduction" libelle="Introduction">
              <Textarea id="introduction" rows={4} value={script.introduction} onChange={(e) => setScript((s) => ({ ...s, introduction: e.target.value }))} />
            </Champ>
            {script.questions.map((q, i) => (
              <Champ key={q.id} id={`question-${q.id}`} libelle={`Question ${i + 1}`}>
                <Textarea id={`question-${q.id}`} rows={2} value={q.texte} onChange={(e) => majQuestion(i, e.target.value)} />
              </Champ>
            ))}
            <Champ id="conclusion" libelle="Conclusion">
              <Textarea id="conclusion" rows={2} value={script.conclusion} onChange={(e) => setScript((s) => ({ ...s, conclusion: e.target.value }))} />
            </Champ>
          </div>
        </details>
      </Surface>

      <Surface className="flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="titre-equipe">
        <h2 id="titre-equipe" className="text-xl font-semibold">
          Équipe mobilisée
        </h2>
        <fieldset className="flex flex-col">
          <legend className="sr-only">Membres de l&apos;équipe</legend>
          <Libelle className="mb-1">Appelants</Libelle>
          <div className="grid sm:grid-cols-2">
            {appelants.map((m) => (
              <label key={m.id} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  checked={equipe.includes(m.id)}
                  onCheckedChange={(v) => setEquipe((e) => (v ? [...e, m.id] : e.filter((x) => x !== m.id)))}
                />
                <span>
                  {m.prenom} {m.nom} <span className="text-muted-foreground">· {ROLE_LIBELLES[m.role]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 border-t pt-4">
          <Checkbox checked={repartir} onCheckedChange={(v) => setRepartir(Boolean(v))} />
          Répartir automatiquement les appels entre ces personnes (par ordre de priorité)
        </label>
      </Surface>

      {erreur && (
        <p role="alert" className="font-medium text-err">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={enCours || !nb}>
          <Rocket aria-hidden />
          Lancer la campagne
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.push("/alertes")}>
          Plus tard
        </Button>
      </div>
    </form>
  );
}
