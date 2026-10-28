import type { ReactNode } from "react";
import type { Contexte } from "@/shared/application/contexte";
import { ROLE_LIBELLES } from "@/shared/domain/vocabulaire";
import { Bandeau, EnTetePage, Page, Pastille, Section, Surface } from "@/shared/ui/elements";
import { casDUsage } from "../infrastructure";
import { FormulaireGrille } from "./formulaire-grille";
import { FormulaireRelances } from "./formulaire-relances";
import { FormulaireRgpd } from "./formulaire-rgpd";
import { InviterBenevole } from "./inviter-benevole";
import { MaquetteAssistantIa } from "./maquette-assistant-ia";
import { ReinitialiserDemo } from "./reinitialiser-demo";

const SECTIONS = [
  { id: "equipe", libelle: "Équipe" },
  { id: "grille", libelle: "Grille de score" },
  { id: "relances", libelle: "Relances et anniversaires" },
  { id: "rgpd", libelle: "Textes RGPD" },
  { id: "assistant-ia", libelle: "Assistant IA" },
  { id: "demo", libelle: "Démo" },
];

/** Section titrée, ancrée pour la navigation interne. */
function Bloc({ id, titre, actions, children }: { id: string; titre: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-20">
      <Section titre={titre} actions={actions}>
        {children}
      </Section>
    </div>
  );
}

export async function PageParametres({ ctx }: { ctx: Contexte }) {
  const { parametres: p, equipe } = await casDUsage.lireParametres(ctx);

  return (
    <Page className="max-w-5xl">
      <EnTetePage titre="Paramètres" description={`Réglages du registre de ${ctx.commune.nom}, de l'équipe et de la démonstration.`} />

      <nav aria-label="Sections des paramètres" className="-mt-4 flex flex-wrap gap-x-1 gap-y-1">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex h-11 items-center rounded-lg px-3 font-medium text-primary hover:bg-accent">
            {s.libelle}
          </a>
        ))}
      </nav>

      <Bloc id="equipe" titre="Équipe" actions={<InviterBenevole />}>
        <Surface>
          <ul className="divide-y">
            {equipe.map((u) => (
              <li key={u.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {u.prenom} {u.nom}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {[u.email, u.telephone].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{ROLE_LIBELLES[u.role]}</span>
                  {!u.actif && <Pastille ton="neutre">Désactivé</Pastille>}
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      </Bloc>

      <Bloc id="grille" titre="Grille de score">
        <p className="-mt-2 max-w-[65ch] text-muted-foreground">
          Les points s&apos;additionnent pour donner un score de 0 à 100 qui fixe la priorité d&apos;appel de chaque personne.
        </p>
        <FormulaireGrille initiale={p.grilleScore} />
      </Bloc>

      <Bloc id="relances" titre="Relances et anniversaires">
        <FormulaireRelances
          initiales={{ relance: p.relance, anniversaireJoursAvant: p.anniversaireJoursAvant, verificationMois: p.verificationMois }}
        />
      </Bloc>

      <Bloc id="rgpd" titre="Textes RGPD">
        <p className="-mt-2 max-w-[65ch] text-muted-foreground">Ces textes informent les personnes inscrites au registre de leurs droits.</p>
        <FormulaireRgpd initiaux={p.rgpd} />
      </Bloc>

      <Bloc id="assistant-ia" titre="Assistant IA">
        <Bandeau ton="accent">Fonctionnalité en préparation – démonstration. Ces réglages ne sont pas encore actifs.</Bandeau>
        <MaquetteAssistantIa />
      </Bloc>

      <Bloc id="demo" titre="Démo">
        <Surface className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <p className="max-w-[65ch]">
            Recharge le jeu de démonstration : bénéficiaires fictifs de Lomme, équipe, canicule passée et scénario du jour. Les dates sont recalculées à partir d&apos;aujourd&apos;hui.
          </p>
          <ReinitialiserDemo />
        </Surface>
      </Bloc>
    </Page>
  );
}
