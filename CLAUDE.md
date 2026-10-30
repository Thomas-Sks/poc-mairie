@AGENTS.md

# POC Registre des personnes vulnérables (CCAS)

Application de suivi des personnes vulnérables pour les CCAS, qui devient l'outil de pilotage en cas d'alerte (canicule, grand froid, inondation).
Public d'environ 60 ans : peu de boutons, prise en main en 2-3 minutes. Mieux vaut moins de fonctionnalités que des écrans chargés.

Menu CCAS : Bénéficiaires (accueil) · Listes · Alertes · Bénévoles · Inscriptions (pastille rouge = demandes à valider) · Paramètres.
- **Assistant** (`modules/assistant`, cœur de l'app), intégré en haut de Bénéficiaires : une question en français filtre le tableau et la carte (filtre `ids` + `question`), un chiffre s'affiche au-dessus, un nom devient une recherche. Pas de page à part ni de vues enregistrées. Déterministe : l'IA (Claude, `ANTHROPIC_API_KEY` facultative) ne fait que du function calling sur le moteur de `modules/statistiques` ; chaque interprétation est figée dans `interpretations_assistant` et les réponses sont rédigées par gabarits. Sans clé, l'analyseur de mots-clés répond seul.
- **Bénévoles** (`modules/benevole/ui/gestion`) : on ajoute un bénévole et on lui confie des personnes (table `assignations`) ; pendant une alerte, la vague du jour les lui assigne. Il voit la fiche réduite et les « notes de cette alerte », jamais l'historique de l'année.
- **Critères de priorité** (Paramètres) : grille RG-01 + APA/GIR, PCH, aide de la caisse de retraite (décret n° 2026-590 du 3 juillet 2026).
- Tableau : pas de bouton « Nouvelle fiche » (une fiche naît de la validation d'une inscription) ni « Demander » (Entrée lance la question) ; « Enregistrer la liste » et « Exporter » n'apparaissent qu'avec une recherche ou un filtre actif (ou dans une liste pour l'export).
- Retirés : Mes tâches du jour, import Excel, rubrique Statistiques (explorateur, dashboards), vues enregistrées du tableau, « fiches à revérifier », réglages de relances et textes RGPD (valeurs figées).
- Tableau des bénéficiaires : défilement dans son propre cadre, en-têtes et colonne « Nom » figés, boutons ◀ ▶ quand des colonnes dépassent ; liste simple sur mobile.
Specs fonctionnelles : `docs/SPECS.md`, à lire pour toute fonctionnalité (les identifiants `E8-US3`, `RG-05`… y renvoient).
Direction artistique : `docs/da-mairie.html`. Toute l'interface est en **français**.

## Commandes

```bash
pnpm install
cp .env.example .env          # DATABASE_URL (Postgres local sur le port 5434)
pnpm db:up                    # Postgres via Docker Compose
pnpm db:reset                 # applique le schéma (drizzle-kit push) puis recharge la démo
pnpm dev                      # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
node scripts/capture.mjs /beneficiaires capture.png 390 Julie   # capture d'écran (chemin, fichier, largeur, prénom de l'utilisateur)
```

Utilisateurs de démo (sélecteur en haut d'écran, cookie `poc_utilisateur`) : Sophie Lambert (admin), Julie Moreau et Karim Haddad (agents), Marc Petit, Lucie Bernard et Ahmed Benali (bénévoles).

## Stack

Next.js 16 (App Router, Turbopack, React 19), TypeScript strict, Tailwind CSS 4, shadcn/ui (variante **Base UI** : on compose avec la prop `render`, pas `asChild`), Drizzle ORM + PostgreSQL, Zod 4, TanStack Table 8, TanStack Query 5 (polling temps réel), Leaflet + react-leaflet, SDK Anthropic (`@anthropic-ai/sdk`, assistant), Vitest, Playwright.
**Icônes : uniquement `lucide-react`.**

## Architecture hexagonale

```
src/
  shared/                     noyau partagé
    domain/                   vocabulaire, dates, priorité (RG-01), campagne (RG-02..06), permissions — PUR, testé
    application/contexte.ts   Contexte { utilisateur, commune, maintenant } passé à chaque cas d'usage
    infrastructure/db/        schema.ts (Drizzle, source de vérité du modèle), client.ts
    infrastructure/session.ts obtenirContexte(), contexteAvec(permission)
    infrastructure/seed/      jeu de démo + EXTENSIONS_SEED
    ui/                       coque (menu, sélecteur), elements.tsx (Page, EnTetePage, Surface, Section, Pastille…)
  modules/<module>/
    domain/                   types et règles métier pures (aucun import de Next, React ou Drizzle) + tests *.test.ts
    application/
      ports.ts                interfaces (ex. BeneficiaireRepository)
      <cas-d-usage>.ts        fonctions (deps, ctx, entrée) → résultat ; vérifient les droits avec exiger()
    infrastructure/           adaptateurs : dépôts Drizzle, API externes, et index.ts qui assemble les cas d'usage
    ui/                       composants React du module + actions.ts (Server Actions = adaptateur entrant)
  app/                        routes Next.js : FINES, elles ne font qu'appeler le module
    (ccas)/                   interface agents/admin (menu latéral)
    benevole/                 interface bénévole (sans menu)
    inscription/              formulaire public
  components/ui/              composants shadcn (déjà adaptés à la DA)
```

Règles :
- Le domaine et l'application n'importent jamais `drizzle-orm`, `next/*` ni React. Seule l'infrastructure parle à la base.
- Toute requête filtre par `communeId` du contexte (multi-tenant, E13-US8).
- Les droits sont vérifiés côté serveur dans les cas d'usage (`exiger(ctx.utilisateur.role, "…")`), pas seulement dans l'UI.
- Les entrées sont validées par Zod à la frontière (Server Action ou Route Handler).
- Mutations : Server Actions + `revalidatePath`. Temps réel : Route Handler `GET /api/...` + `useQuery({ refetchInterval: 2500 })`.
- Pages : Server Components par défaut ; `"use client"` seulement pour l'interactivité.
- Next 16 : `params` et `searchParams` sont des Promise ; `cookies()` est async ; types globaux `PageProps<"/route/[id]">` et `LayoutProps`.
- Pas de `any`. Les tests unitaires couvrent les règles du domaine.

Exemple de câblage :

```ts
// modules/x/application/archiver-fiche.ts
export async function archiverFiche(deps: { fiches: FicheRepository }, ctx: Contexte, entree: { id: string; motif: MotifArchivage }) {
  exiger(ctx.utilisateur.role, "fiches.archiver");
  await deps.fiches.archiver(ctx.commune.id, entree.id, entree.motif);
}
// modules/x/infrastructure/index.ts
export const casDUsage = { archiverFiche: (ctx: Contexte, e: Parameters<typeof archiverFiche>[2]) => archiverFiche({ fiches: ficheRepositoryDrizzle }, ctx, e) };
// modules/x/ui/actions.ts  ("use server") → valide avec Zod, obtenirContexte(), casDUsage.archiverFiche(ctx, entree), revalidatePath(...)
```

## Design (impératif)

- **Light mode uniquement.** Couleurs via les tokens Tailwind : `bg-background` (sable), `bg-card` (blanc), `border`, `text-foreground`, `text-muted-foreground`, `text-subtle-foreground`, `bg-primary`/`text-primary` (bleu canard, **seul accent**), `bg-accent` (canard léger). États réservés aux statuts et messages : `ok`, `warn`, `err` (+ `-soft`). Aucune autre couleur, aucun dégradé.
- Police Public Sans, texte courant ≥ 16 px (bénévole ≥ 18 px). Boutons ≥ 44 px (bénévole ≥ 48 px). Rayon unique 8 px (`rounded-lg`) ; seules les pastilles de statut sont en arrondi complet.
- **Aucune animation ni transition**, aucune ombre sur les blocs.
- **Pas de boîtes imbriquées** : sur le fond sable, on pose des `Surface` (blanc, bordure 1 px). Jamais une boîte bordée, colorée ou ombrée à l'intérieur d'une autre. Dans une surface, on hiérarchise avec titres, espace et séparateurs (`divide-y`, `border-t`). Les `Bandeau` (infos prioritaires) se posent sur le fond, pas dans une surface.
- Écrans épurés : une action principale (bouton `default`) par écran, peu d'informations, libellés explicites (« Enregistrer la fiche », pas « OK »). Pas de jargon technique.
- Responsive : mobile (≥ 360 px), tablette (≥ 768 px), desktop (≥ 1024 px). Interface CCAS optimisée desktop et utilisable sur tablette ; bénévole et formulaire public **mobile-first**. Les tableaux larges défilent horizontalement dans leur conteneur ou passent en liste sur mobile.
- Réutiliser `src/shared/ui/elements.tsx` (`Page`, `EnTetePage`, `Surface`, `Section`, `Pastille`, `PastillePriorite`, `Bandeau`, `EtatVide`, `Proprietes`, `Libelle`).
- Accessibilité RGAA AA : labels associés, focus visible, contrastes, `aria-*` sur les contrôles.

## Données de démo

`pnpm db:seed` recrée tout (dates relatives au jour du seed). Fil rouge (§10.4) : Mme Simone … a 90 ans demain, M. André … est sorti d'hôpital hier (rappel du jour), 3 inscriptions en ligne attendent (dont Mme Germaine VASSEUR en P1), 12 personnes ont un passage d'intervenant aujourd'hui et 4 sont en vacances, 9 foyers sont rue du Marais (n° impairs 1 à 41) pour le scénario inondation, et la canicule de juillet 2026 est clôturée avec des appels IA fictifs (dont une escalade « vertiges »).
Un module qui a besoin de données de démo supplémentaires ajoute une fonction dans `EXTENSIONS_SEED` (`src/shared/infrastructure/seed/extensions.ts`).
