"use client";

/**
 * Fenêtres des actions du tableau : assigner (E8-US6), tag et statut (E8-US8), export CSV (E8-US9),
 * enregistrer une liste (E8-US5) et une vue (E8-US10).
 */
import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MOTIFS_ARCHIVAGE, MOTIF_ARCHIVAGE_LIBELLES, ROLE_LIBELLES, type MotifArchivage } from "@/shared/domain/vocabulaire";
import type { Filtre } from "../domain/filtre";
import { colonnesAutorisees, COLONNES, DEFINITIONS_COLONNES, contientDonneesSante, type Colonne, type ConfigVue, type StatutGroupe } from "../domain/tableau";
import { actionAjouterTag, actionAssigner, actionChangerStatut, actionCreerListe, actionEnregistrerVue, actionExporterCsv } from "./actions";
import { classeSelect } from "./panneau-filtres";
import { nomMembre, type Membre } from "./types";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function Fenetre({
  ouvert,
  fermer,
  titre,
  description,
  children,
  pied,
  large,
}: {
  ouvert: boolean;
  fermer: () => void;
  titre: string;
  description?: ReactNode;
  children: ReactNode;
  pied: ReactNode;
  large?: boolean;
}) {
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && fermer()}>
      <DialogContent className={`max-h-[90dvh] gap-5 overflow-y-auto rounded-lg p-6 text-base ${large ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-tight">{titre}</DialogTitle>
          {description && <DialogDescription className="text-base">{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="-mx-6 -mb-6 bg-card px-6 py-4">{pied}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaseACocher({ coche, onChange, children, desactive }: { coche: boolean; onChange: (v: boolean) => void; children: ReactNode; desactive?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <Checkbox checked={coche} onCheckedChange={(v) => onChange(Boolean(v))} disabled={desactive} />
      <span className="flex-1">{children}</span>
    </label>
  );
}

function Choix<T extends string>({ valeur, onChange, options, legende }: { valeur: T; onChange: (v: T) => void; options: { valeur: T; libelle: string; aide?: string }[]; legende: string }) {
  return (
    <RadioGroup value={valeur} onValueChange={(v) => onChange(v as T)} aria-label={legende} className="gap-1">
      {options.map((o) => (
        <label key={o.valeur} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
          <RadioGroupItem value={o.valeur} className="mt-1" />
          <span className="flex flex-col">
            <span className="font-medium">{o.libelle}</span>
            {o.aide && <span className="text-[0.9375rem] text-muted-foreground">{o.aide}</span>}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}

const useRafraichir = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["registre"] });
};

// ─── Assigner (E8-US6) ────────────────────────────────────────────────────────

export function FenetreAssigner({ ids, equipe, ouvert, fermer, onTermine }: { ids: string[]; equipe: Membre[]; ouvert: boolean; fermer: () => void; onTermine: () => void }) {
  const [choisis, setChoisis] = useState<string[]>([]);
  const [repartirAuto, setRepartirAuto] = useState(true);
  const [remplacer, setRemplacer] = useState(false);
  const [enCours, demarrer] = useTransition();
  const rafraichir = useRafraichir();
  const idRepartir = useId();
  const groupes = [
    { titre: "Équipe du CCAS", membres: equipe.filter((m) => m.role !== "benevole") },
    { titre: "Bénévoles", membres: equipe.filter((m) => m.role === "benevole") },
  ];
  const repartition = repartirAuto && choisis.length > 1;

  const valider = () =>
    demarrer(async () => {
      const r = await actionAssigner({ ids, utilisateurIds: choisis, repartirAutomatiquement: repartition, remplacer });
      if (!r.ok) return void toast.error(r.erreur);
      const noms = Object.fromEntries(equipe.map((m) => [m.id, m.prenom]));
      toast.success(
        repartition
          ? `Répartition faite : ${r.valeur.parPersonne.map((p) => `${noms[p.utilisateurId]} (${p.nb})`).join(", ")}`
          : `${pluriel(r.valeur.nbFiches, "personne")} assignée${r.valeur.nbFiches > 1 ? "s" : ""}`,
      );
      void rafraichir();
      setChoisis([]);
      onTermine();
      fermer();
    });

  return (
    <Fenetre
      ouvert={ouvert}
      fermer={fermer}
      titre={`Assigner ${pluriel(ids.length, "personne")}`}
      description="Choisissez un ou plusieurs collègues ou bénévoles."
      pied={
        <>
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button disabled={enCours || choisis.length === 0} onClick={valider}>
            {repartition ? "Répartir" : "Assigner"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {groupes.map(
          (g) =>
            g.membres.length > 0 && (
              <fieldset key={g.titre} className="flex flex-col">
                <legend className="mb-1 font-semibold">{g.titre}</legend>
                {g.membres.map((m) => (
                  <CaseACocher key={m.id} coche={choisis.includes(m.id)} onChange={(v) => setChoisis((c) => (v ? [...c, m.id] : c.filter((x) => x !== m.id)))}>
                    {nomMembre(m)} <span className="text-muted-foreground">· {ROLE_LIBELLES[m.role]}</span>
                  </CaseACocher>
                ))}
              </fieldset>
            ),
        )}
      </div>
      <div className="flex flex-col gap-3 border-t pt-4">
        <div className="flex items-start gap-3">
          <Switch id={idRepartir} checked={repartirAuto} onCheckedChange={setRepartirAuto} className="mt-1" />
          <label htmlFor={idRepartir} className="flex cursor-pointer flex-col">
            <span className="font-medium">Répartir automatiquement</span>
            <span className="text-[0.9375rem] text-muted-foreground">Parts égales entre les personnes choisies, les P1 en premier. Sinon, chacune reçoit toute la sélection.</span>
          </label>
        </div>
        <CaseACocher coche={remplacer} onChange={setRemplacer}>
          Remplacer les assignations existantes
        </CaseACocher>
      </div>
    </Fenetre>
  );
}

// ─── Ajouter un tag ───────────────────────────────────────────────────────────

export function FenetreTag({ ids, tags, ouvert, fermer }: { ids: string[]; tags: string[]; ouvert: boolean; fermer: () => void }) {
  const id = useId();
  const [tag, setTag] = useState("");
  const [enCours, demarrer] = useTransition();
  const rafraichir = useRafraichir();
  const valider = () =>
    demarrer(async () => {
      const r = await actionAjouterTag({ ids, tag });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success(`Tag « ${tag.trim()} » ajouté à ${pluriel(r.valeur, "fiche")}`);
      void rafraichir();
      setTag("");
      fermer();
    });
  return (
    <Fenetre
      ouvert={ouvert}
      fermer={fermer}
      titre="Ajouter un tag"
      description={`Le tag sera ajouté aux ${pluriel(ids.length, "fiche")} sélectionnée${ids.length > 1 ? "s" : ""}.`}
      pied={
        <>
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button disabled={enCours || !tag.trim()} onClick={valider}>
            Ajouter le tag
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          Tag
        </label>
        <Input id={id} list={`${id}-tags`} value={tag} maxLength={60} onChange={(e) => setTag(e.target.value)} placeholder="Ex. isolement social" />
        <datalist id={`${id}-tags`}>
          {tags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
    </Fenetre>
  );
}

// ─── Changer le statut ────────────────────────────────────────────────────────

export function FenetreStatut({ ids, peutArchiver, ouvert, fermer }: { ids: string[]; peutArchiver: boolean; ouvert: boolean; fermer: () => void }) {
  const id = useId();
  const [statut, setStatut] = useState<StatutGroupe>("active");
  const [motifArchivage, setMotifArchivage] = useState<MotifArchivage>("demenagement");
  const [motif, setMotif] = useState("");
  const [enCours, demarrer] = useTransition();
  const rafraichir = useRafraichir();
  const options: { valeur: StatutGroupe; libelle: string; aide: string }[] = [
    { valeur: "active", libelle: "Active", aide: "La personne est suivie normalement." },
    { valeur: "suspendue", libelle: "Suspendue", aide: "Suivi mis en pause (ex. séjour long hors commune)." },
    ...(peutArchiver ? [{ valeur: "archivee" as const, libelle: "Archivée", aide: "La fiche sort du registre (décès, déménagement…)." }] : []),
  ];
  const valider = () =>
    demarrer(async () => {
      const r = await actionChangerStatut({ ids, statut, motifArchivage: statut === "archivee" ? motifArchivage : undefined, motif: motif || undefined });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success(r.valeur === 0 ? "Aucune fiche à modifier" : `Statut modifié pour ${pluriel(r.valeur, "fiche")}`);
      void rafraichir();
      fermer();
    });
  return (
    <Fenetre
      ouvert={ouvert}
      fermer={fermer}
      titre="Changer le statut"
      description={`${pluriel(ids.length, "fiche")} sélectionnée${ids.length > 1 ? "s" : ""}.`}
      pied={
        <>
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button disabled={enCours || (statut === "suspendue" && !motif.trim())} onClick={valider}>
            Changer le statut
          </Button>
        </>
      }
    >
      <Choix legende="Nouveau statut" valeur={statut} onChange={setStatut} options={options} />
      {statut === "archivee" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-archivage`} className="font-medium">
            Motif d&apos;archivage
          </label>
          <select id={`${id}-archivage`} className={classeSelect} value={motifArchivage} onChange={(e) => setMotifArchivage(e.target.value as MotifArchivage)}>
            {MOTIFS_ARCHIVAGE.map((m) => (
              <option key={m} value={m}>
                {MOTIF_ARCHIVAGE_LIBELLES[m]}
              </option>
            ))}
          </select>
        </div>
      )}
      {statut !== "active" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-motif`} className="font-medium">
            {statut === "suspendue" ? "Motif de la suspension" : "Précision (facultatif)"}
          </label>
          <Textarea id={`${id}-motif`} rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} />
        </div>
      )}
    </Fenetre>
  );
}

// ─── Export CSV (E8-US9) ──────────────────────────────────────────────────────

export function FenetreExport({
  ids,
  total,
  filtre,
  listeId,
  colonnesVisibles,
  accesSante,
  ouvert,
  fermer,
}: {
  ids: string[];
  total: number;
  filtre: Filtre;
  listeId?: string;
  colonnesVisibles: Colonne[];
  accesSante: boolean;
  ouvert: boolean;
  fermer: () => void;
}) {
  const [colonnes, setColonnes] = useState<Colonne[]>(() => colonnesAutorisees(colonnesVisibles, accesSante));
  const [portee, setPortee] = useState<"selection" | "tout">(ids.length > 0 ? "selection" : "tout");
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, demarrer] = useTransition();
  const disponibles = colonnesAutorisees(COLONNES, accesSante);
  const sante = contientDonneesSante(colonnes);
  const nb = portee === "selection" ? ids.length : total;

  const exporter = () =>
    demarrer(async () => {
      const ordonnees = disponibles.filter((c) => colonnes.includes(c));
      const r = await actionExporterCsv({ filtre, listeId, ids: portee === "selection" ? ids : undefined, colonnes: ordonnees, confirmationSante: confirmation });
      if (!r.ok) return void toast.error(r.erreur);
      const url = URL.createObjectURL(new Blob([r.valeur.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.valeur.nomFichier;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export de ${pluriel(r.valeur.nb, "ligne")} enregistré dans le journal d'audit`);
      fermer();
    });

  return (
    <Fenetre
      large
      ouvert={ouvert}
      fermer={fermer}
      titre="Exporter en CSV"
      description="Fichier lisible dans Excel. Chaque export est tracé dans le journal d'audit."
      pied={
        <>
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button disabled={enCours || colonnes.length === 0 || nb === 0 || (sante && !confirmation)} onClick={exporter}>
            Exporter {pluriel(nb, "ligne")}
          </Button>
        </>
      }
    >
      {ids.length > 0 && (
        <Choix
          legende="Personnes à exporter"
          valeur={portee}
          onChange={setPortee}
          options={[
            { valeur: "selection", libelle: `La sélection (${ids.length})` },
            { valeur: "tout", libelle: `Tous les résultats du filtre (${total})` },
          ]}
        />
      )}
      <fieldset className="flex flex-col">
        <legend className="mb-1 font-semibold">Colonnes</legend>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {disponibles.map((c) => (
            <CaseACocher key={c} coche={colonnes.includes(c)} onChange={(v) => setColonnes((cs) => (v ? [...cs, c] : cs.filter((x) => x !== c)))}>
              {DEFINITIONS_COLONNES[c].libelle}
              {DEFINITIONS_COLONNES[c].sante && <span className="text-[0.9375rem] text-err"> · santé</span>}
            </CaseACocher>
          ))}
        </div>
      </fieldset>
      {sante && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="font-medium text-err">Cet export contient des données de santé.</p>
          <CaseACocher coche={confirmation} onChange={setConfirmation}>
            Je confirme exporter des données de santé, pour un usage strictement limité à la mission du CCAS.
          </CaseACocher>
        </div>
      )}
    </Fenetre>
  );
}

// ─── Enregistrer une liste (E8-US5) ───────────────────────────────────────────

export function FenetreListe({
  ids,
  total,
  filtre,
  listeId,
  ouvert,
  fermer,
}: {
  ids: string[];
  total: number;
  filtre: Filtre;
  listeId?: string;
  ouvert: boolean;
  fermer: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [nom, setNom] = useState("");
  const avecSelection = ids.length > 0;
  const [type, setType] = useState<"dynamique" | "figee" | "selection">(avecSelection ? "selection" : listeId ? "figee" : "dynamique");
  const [enCours, demarrer] = useTransition();
  const options = [
    ...(avecSelection ? [{ valeur: "selection" as const, libelle: `Les ${ids.length} personnes sélectionnées`, aide: "Liste figée, prête pour une campagne." }] : []),
    ...(!listeId ? [{ valeur: "dynamique" as const, libelle: "Liste dynamique", aide: "Le filtre est réévalué à chaque ouverture : la liste suit les mises à jour du registre." }] : []),
    { valeur: "figee" as const, libelle: `Liste figée (${total} personnes)`, aide: "Instantané des personnes à cet instant, nécessaire pour une campagne." },
  ];
  const valider = () =>
    demarrer(async () => {
      const r = await actionCreerListe({
        nom,
        type: type === "dynamique" ? "dynamique" : "figee",
        filtre,
        listeId,
        ids: type === "selection" ? ids : undefined,
      });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success(`Liste « ${nom.trim()} » enregistrée`);
      fermer();
      router.push(`/listes/${r.valeur}`);
    });
  return (
    <Fenetre
      ouvert={ouvert}
      fermer={fermer}
      titre="Enregistrer la liste"
      pied={
        <>
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button disabled={enCours || !nom.trim()} onClick={valider}>
            Enregistrer la liste
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          Nom de la liste
        </label>
        <Input id={id} value={nom} maxLength={120} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Inondation 28/10 – rue du Marais" />
      </div>
      <Choix legende="Type de liste" valeur={type} onChange={setType} options={options} />
    </Fenetre>
  );
}

// ─── Enregistrer une vue (E8-US10) ────────────────────────────────────────────

export function FenetreVue({ config, ouvert, fermer, onEnregistree }: { config: ConfigVue; ouvert: boolean; fermer: () => void; onEnregistree: () => void }) {
  const id = useId();
  const [nom, setNom] = useState("");
  const [enCours, demarrer] = useTransition();
  const valider = () =>
    demarrer(async () => {
      const r = await actionEnregistrerVue({ nom, config });
      if (!r.ok) return void toast.error(r.erreur);
      toast.success(`Vue « ${nom.trim()} » enregistrée`);
      setNom("");
      onEnregistree();
      fermer();
    });
  return (
    <Fenetre
      ouvert={ouvert}
      fermer={fermer}
      titre="Enregistrer la vue"
      description="Colonnes, filtres et tri actuels, retrouvables en un clic. Seul vous voyez vos vues."
      pied={
        <>
          <Button variant="outline" onClick={fermer}>
            Annuler
          </Button>
          <Button disabled={enCours || !nom.trim()} onClick={valider}>
            Enregistrer la vue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          Nom de la vue
        </label>
        <Input id={id} value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Mes P1 sans contact récent" />
      </div>
    </Fenetre>
  );
}

