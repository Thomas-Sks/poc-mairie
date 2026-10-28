import type { Contexte } from "@/shared/application/contexte";
import { AccesRefuse, exiger } from "@/shared/domain/permissions";
import {
  appliquerPeriode,
  droitsDashboard,
  placerNouveau,
  widgetCompatible,
  type Disposition,
  type DroitsDashboard,
  type TypeWidget,
  type Widget,
} from "../domain/dashboard";
import type { DefinitionRequete, Periode } from "../domain/requete";
import type { ResultatAffiche } from "../domain/secret";
import { executerRequete } from "./explorer";
import type { Dashboard, DashboardRepository, MoteurStatistiques } from "./ports";

type Deps = { dashboards: DashboardRepository; moteur: MoteurStatistiques };

const utilisateur = (ctx: Contexte) => ({ id: ctx.utilisateur.id, estAdmin: ctx.utilisateur.role === "admin" });
const droits = (ctx: Contexte, d: Dashboard) => droitsDashboard(d, utilisateur(ctx));

async function charger(deps: Deps, ctx: Contexte, id: string, droit: keyof DroitsDashboard): Promise<Dashboard> {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  const d = await deps.dashboards.obtenir(ctx.commune.id, id);
  if (!d || !droits(ctx, d).voir) throw new Error("Tableau de bord introuvable.");
  if (!droits(ctx, d)[droit]) throw new AccesRefuse("statistiques.lire");
  return d;
}

export async function listerDashboards(deps: Deps, ctx: Contexte) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  const tous = await deps.dashboards.lister(ctx.commune.id);
  return tous.filter((d) => droits(ctx, d).voir).map((d) => ({ ...d, droits: droits(ctx, d) }));
}

export type WidgetCalcule = Widget & { resultat: ResultatAffiche | null; erreur: string | null };

/** Dashboard et résultats de tous ses widgets, avec le filtre de période global (E12-US5). */
export async function consulterDashboard(deps: Deps, ctx: Contexte, entree: { id: string; periode: Periode | null; masquerPetitsEffectifs: boolean }) {
  const d = await charger(deps, ctx, entree.id, "voir");
  const referentiels = await deps.moteur.referentiels(ctx.commune.id);
  const widgets: WidgetCalcule[] = await Promise.all(
    d.widgets.map(async (w) => {
      try {
        const definition = appliquerPeriode(w.requete, entree.periode);
        const resultat = await executerRequete(deps, ctx, { definition, masquerPetitsEffectifs: entree.masquerPetitsEffectifs, referentiels });
        return { ...w, resultat, erreur: null };
      } catch {
        return { ...w, resultat: null, erreur: "Ce widget n'a pas pu être calculé." };
      }
    }),
  );
  return { dashboard: { ...d, widgets }, droits: droits(ctx, d) };
}

export async function creerDashboard(deps: Deps, ctx: Contexte, nom: string) {
  exiger(ctx.utilisateur.role, "statistiques.lire");
  return deps.dashboards.creer(ctx.commune.id, ctx.utilisateur.id, nom);
}

export async function modifierDashboard(deps: Deps, ctx: Contexte, entree: { id: string; nom?: string; partage?: boolean }) {
  const d = await charger(deps, ctx, entree.id, "modifier");
  await deps.dashboards.modifier(ctx.commune.id, d.id, {
    ...(entree.nom ? { nom: entree.nom } : {}),
    ...(entree.partage !== undefined && !d.predefini ? { partage: entree.partage } : {}),
  });
}

export async function enregistrerDisposition(deps: Deps, ctx: Contexte, entree: { id: string; dispositions: Record<string, Disposition> }) {
  const d = await charger(deps, ctx, entree.id, "modifier");
  const widgets = d.widgets.map((w) => (entree.dispositions[w.id] ? { ...w, layout: entree.dispositions[w.id] } : w));
  await deps.dashboards.modifier(ctx.commune.id, d.id, { widgets });
}

export async function ajouterWidget(
  deps: Deps,
  ctx: Contexte,
  entree: { id: string; titre: string; type: TypeWidget; definition: DefinitionRequete },
) {
  const d = await charger(deps, ctx, entree.id, "modifier");
  if (!widgetCompatible(entree.type, entree.definition)) throw new Error("Ce type de widget ne convient pas à cette requête.");
  const widget: Widget = {
    id: `w-${Date.now().toString(36)}`,
    titre: entree.titre,
    type: entree.type,
    requete: entree.definition,
    layout: placerNouveau(d.widgets, entree.type),
  };
  await deps.dashboards.modifier(ctx.commune.id, d.id, { widgets: [...d.widgets, widget] });
}

export async function retirerWidget(deps: Deps, ctx: Contexte, entree: { id: string; widgetId: string }) {
  const d = await charger(deps, ctx, entree.id, "modifier");
  await deps.dashboards.modifier(ctx.commune.id, d.id, { widgets: d.widgets.filter((w) => w.id !== entree.widgetId) });
}

export async function supprimerDashboard(deps: Deps, ctx: Contexte, id: string) {
  const d = await charger(deps, ctx, id, "supprimer");
  await deps.dashboards.supprimer(ctx.commune.id, d.id);
}
