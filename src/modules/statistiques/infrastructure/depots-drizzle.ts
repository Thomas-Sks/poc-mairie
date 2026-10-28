import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/db/client";
import { dashboards, requetesStat, utilisateurs, type WidgetDashboard } from "@/shared/infrastructure/db/schema";
import { schemaWidget, type Widget } from "../domain/dashboard";
import { lireDefinition } from "../domain/requete";
import type { DashboardRepository, RequeteEnregistree, RequeteRepository } from "../application/ports";

const nomAuteur = sql<string | null>`case when ${utilisateurs.id} is null then null else ${utilisateurs.prenom} || ' ' || ${utilisateurs.nom} end`;

export const requeteRepositoryDrizzle: RequeteRepository = {
  async lister(communeId) {
    const lignes = await db
      .select({ id: requetesStat.id, nom: requetesStat.nom, definition: requetesStat.definition, auteur: nomAuteur, creeLe: requetesStat.createdAt })
      .from(requetesStat)
      .leftJoin(utilisateurs, eq(utilisateurs.id, requetesStat.creePar))
      .where(eq(requetesStat.communeId, communeId))
      .orderBy(desc(requetesStat.createdAt), asc(requetesStat.nom));
    return lignes.flatMap((l): RequeteEnregistree[] => {
      const definition = lireDefinition(l.definition);
      return definition ? [{ ...l, definition }] : [];
    });
  },
  async obtenir(communeId, id) {
    const toutes = await this.lister(communeId);
    return toutes.find((r) => r.id === id) ?? null;
  },
  async creer(communeId, auteurId, nom, definition) {
    const [ligne] = await db.insert(requetesStat).values({ communeId, nom, definition, creePar: auteurId }).returning({ id: requetesStat.id });
    return ligne.id;
  },
  async supprimer(communeId, id) {
    await db.delete(requetesStat).where(and(eq(requetesStat.communeId, communeId), eq(requetesStat.id, id)));
  },
};

const lireWidgets = (brut: WidgetDashboard[]): Widget[] =>
  brut.flatMap((w) => {
    const r = schemaWidget.safeParse(w);
    return r.success ? [r.data] : [];
  });

const colonnes = {
  id: dashboards.id,
  nom: dashboards.nom,
  predefini: dashboards.predefini,
  partage: dashboards.partage,
  widgets: dashboards.widgets,
  creePar: dashboards.creePar,
  auteur: nomAuteur,
};

export const dashboardRepositoryDrizzle: DashboardRepository = {
  async lister(communeId) {
    const lignes = await db
      .select(colonnes)
      .from(dashboards)
      .leftJoin(utilisateurs, eq(utilisateurs.id, dashboards.creePar))
      .where(eq(dashboards.communeId, communeId))
      .orderBy(desc(dashboards.predefini), asc(dashboards.createdAt));
    return lignes.map((l) => ({ ...l, widgets: lireWidgets(l.widgets) }));
  },
  async obtenir(communeId, id) {
    const [l] = await db
      .select(colonnes)
      .from(dashboards)
      .leftJoin(utilisateurs, eq(utilisateurs.id, dashboards.creePar))
      .where(and(eq(dashboards.communeId, communeId), eq(dashboards.id, id)));
    return l ? { ...l, widgets: lireWidgets(l.widgets) } : null;
  },
  async creer(communeId, auteurId, nom) {
    const [l] = await db.insert(dashboards).values({ communeId, nom, creePar: auteurId, partage: true, widgets: [] }).returning({ id: dashboards.id });
    return l.id;
  },
  async modifier(communeId, id, champs) {
    await db
      .update(dashboards)
      .set(champs)
      .where(and(eq(dashboards.communeId, communeId), eq(dashboards.id, id)));
  },
  async supprimer(communeId, id) {
    await db.delete(dashboards).where(and(eq(dashboards.communeId, communeId), eq(dashboards.id, id)));
  },
};
