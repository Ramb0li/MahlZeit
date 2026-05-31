# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (also rebuilds recipe seed data)
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Rebuild recipe seed data only
npm run recipes:build
```

The app runs at http://localhost:3000. There are no automated tests.

## Architecture

**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Upstash Redis (prod) / JSON files (dev).

### Data Layer — Dual-Mode (`src/lib/data.ts`)

The data layer auto-detects the environment:
- **Local dev** (no `UPSTASH_REDIS_REST_URL`): reads/writes `data/*.json` files on disk.
- **Production** (Vercel): reads/writes Upstash Redis using namespaced keys (`mz:group:<id>:...`).

All data is **group-scoped** — recipes, settings, weekplans, constraints, and shopping lists belong to a group. The 74+ template recipes in `data/recipes.json` are global; each group can add custom recipes on top.

### Auth & Groups (`src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/groups.ts`)

- JWT sessions stored in an HTTP-only cookie (`mz_token`). Secret via `JWT_SECRET` env var.
- Users have a `plan` (`free` | `lifetime` | `monthly`) and `status` (`active` | `pending`). Middleware at `src/middleware.ts` guards `/app/**` and `/admin/**`.
- Admin-only access is locked to the `ADMIN_EMAIL` constant in `src/lib/auth.ts`.
- Email confirmation and group invites are sent via Resend (`src/lib/email.ts`). Without a `RESEND_API_KEY`, links are logged to the server console instead.

### Key API Routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `auth/*` | Login, register, confirm, invite acceptance |
| `recipes/` | CRUD for group recipes (GET merges global + custom) |
| `recipes/import` | Claude Haiku extracts recipe data from a URL or screenshot |
| `weekplan/` | Get/save the week plan for a group |
| `weekplan/suggest` | AI-suggested meal plan based on constraints, season, weather |
| `shopping-list/` | Aggregated shopping list from the week plan |
| `settings/` | Group settings (household, diet, theme, etc.) |
| `weather/` | Meteoblue weather cache (50 req/day free tier) |
| `promotions/` | Swiss supermarket promotions cache (Migros/Coop/Lidl) |

### Frontend Structure

- **`src/app/app/page.tsx`** — Main SPA shell; all views are rendered here via tab state.
- **`src/components/AppShell.tsx`** — Navigation, theme, group context.
- **`src/components/planner/WeekPlanner.tsx`** — Core week planning UI; uses `DayColumn` and `RecipePickerModal`.
- **`src/components/recipes/`** — Recipe list, form, and import modal.
- **`src/components/shopping/ShoppingListView.tsx`** — Shopping list with PDF export (jsPDF).

### Types (`src/types/index.ts`)

Central TypeScript types. Key ones: `Recipe`, `WeekPlan`, `DayPlan`, `MealSlot`, `AppSettings`, `DayConstraint`.

### Environment Variables

See `.env.example`. Required for full functionality:
- `ANTHROPIC_API_KEY` — Recipe import via Claude Haiku
- `RESEND_API_KEY` + `FROM_EMAIL` + `APP_URL` — Email sending
- `JWT_SECRET` — Session signing (dev uses insecure fallback)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Production persistence

## Current Status (Stand 2026-05-31 – Update nach Phases 1–6)

**Live:** https://mahlzeit.o-v-k.ch (Vercel, Upstash Redis, Resend).

**Content:**
- 95 Template-Rezepte in `data/recipes.json` (+21 Kindersnacks aus LittleFant-PDF, IDs `kds-01`–`kds-21`)
- 16 Rezepte mit Bildern in `public/images/recipes/` verlinkt (13 MahlZeit + 3 ältere)
- 26 MahlZeit-Bilder + 20 Cuiselin-Bilder verfügbar — viele Cuiselin-Bilder noch nicht als Rezept angelegt
- Kategorien erweitert: `Frühstück`, `Süsses`, `Brot & Aufstrich` (siehe `src/types/index.ts`, `RecipeList.tsx`, `RecipeForm.tsx`, `RecipePickerModal.tsx`)
- Alle Kindersnacks: `dietCategory: 'vegan'`, `source: 'LittleFant – Kindersnacks für jeden Tag'`, `isMealprep: true`

**Asset-Struktur** (außerhalb des Repos):
```
../Menüs/
├── Quellen/{Cuiselin,MahlZeit}/   # Original-Bilder (Backup)
├── PDFs/_Importiert/              # bereits verarbeitete PDFs (inkl. Kindersnacks)
└── Neu/                            # Inbox für neuen Content
```

**Letzter Code-Review (12 Fixes, Commit `641787a`):**
Stale-Redis-Cache für Templates beseitigt, SSRF-Guard im URL-Import, Redis-Rate-Limit, Member-Plan erbt Owner, Kategorie-basierte Meal-Pools, Datenleck `confirmationTokenExpiresAt`, Template-Delete-Guard, O(1) Confirmation-Token-Index, `weekplan/suggest` startDate aus weekId.

**Implementiert (Phases 1–6, Build grün):**
- Phase 1: `DietCategory = 'meat'|'fish'|'vegetarian'|'vegan'` in allen 74 Rezepten; neue DietTypes `fleischhaltig` + `flexitarisch`; Settings-Kacheln; Flexitarisch-Logik (max 1 Fleisch/Woche) in `lib/suggestions.ts`
- Phase 2: RecipeList dietCategory-Filter-Tabs (Alle | Fleischhaltig | Pescetarisch | Vegetarisch | Vegan)
- Phase 3: `ShoppingGroupsBar` im WeekPlanner; API `/api/weekplan/shopping-groups`; Redis-Key `mz:group:<id>:week:<kw>:shopping_groups`
- Phase 4: ShoppingListView Mehrfach-Listen-Übersicht; `?dayIndices=` Filter in `/api/shopping-list`; `buildListLabel` (KW23.Mo-So)
- Phase 5: `OnboardingWizard` (6 Schritte: Familienname, Ort, Portionen, Diät, Allergien, Einkaufsrhythmus); ersetzt alten `GroupNameOnboarding`; Flag `settings.onboardingDone`
- Phase 6: Abmelde-Button in Desktop-Nav + Mobile-Nav (`handleLogout` → `/api/auth/logout`)

**Offene Tasks (Priorität ↓):**
1. Weitere Rezepte aus Kochbüchern und vorbereiteten Links importieren (Grundlagenphase)
2. App-Review (UX, Funktionalität durchklicken)
3. Marketing-Setup (SEO-Meta, Vercel Analytics, OG-Images, Newsletter)
