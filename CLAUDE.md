# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Response Style
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, or package names. Verify by reading code or docs before asserting.

## Commands

```bash
# Development (also rebuilds recipe seed data)
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Tests (Vitest, nur src/lib/__tests__/**)
npm run test

# Rezept-Seed neu bauen
npm run recipes:build

# Rezeptbestand auf strukturelle Fehler pruefen
npm run recipes:check

# Naehrwerte holen (nur fehlende; -- --all rechnet alle neu)
npm run recipes:enrich
```

Der Volltext aller Skripte steht in `package.json`. Weitere: `recipes:sync`,
`recipes:import-v2`, `recipes:import-hbu`, `content:pull`, `test:watch`.

The app runs at http://localhost:3000.

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

## Current Status (Stand 2026-08-16)

**Live:** https://mahlzeit.o-v-k.ch (Vercel, Upstash Redis, Resend).

### Zahlen
- **419 Template-Rezepte** in `data/recipes.json`, davon 329 mit `approved: true`
- **267 Tests** in 17 Dateien (`src/lib/__tests__/`), `npm run test`
- 18 Rezeptkategorien im Typ `Category` (`src/types/index.ts`), 16 davon in Benutzung
- 13 Zutatenkategorien fuer die Einkaufsliste (`src/lib/shoppingCategories.ts`)

### Freigabe-Gate — wichtig fuer die Sichtbarkeit
`getVisibleRecipes()` (`src/lib/data.ts`) filtert in Produktion auf
`approved === true`. **In Dev greift der Filter nicht**, lokal sind also alle
Rezepte sichtbar. Wer sich wundert, warum die App live weniger Rezepte zeigt als
`data/recipes.json` enthaelt: Redis ist fuer `approved` die massgebliche Quelle,
nicht das Repo. Der Seed hebt eine Freigabe nie an.

`approvalWarnings()` (`src/lib/approvalWarnings.ts`) meldet offene Punkte vor
einer Freigabe (Lizenzstatus, Bild auf fremder Domain, Import ohne
`rewrittenAt`). Es ist ein Hinweis, keine Sperre — die Route verweigert nichts.

### Rezept-Import
`npm run recipes:import-v2` liest `data/import-queue.json` und erzeugt
ausschliesslich Entwuerfe (`approved: false`, `imageUrl: null`,
`licenseStatus: 'adapted'`). Deterministische Teile (Einheiten, Allergene,
Duplikate, Schema) liegen in `scripts/import-utils.ts` und sind unit-getestet;
die Textarbeit macht das Modell aus einem Faktenauszug, ohne den Originaltext zu
sehen. Referenzbilder landen ausserhalb des Repos unter `../Menues/Referenz/`.

Vor einem Lauf `robots.txt` der Quelle pruefen. Mehrere Verlage (ndr.de,
foodboom.de, jamieoliver.com) sperren ClaudeBot ausdruecklich aus.

### Admin
`/admin` ist auf `ADMIN_EMAIL` beschraenkt. Tabs: Nutzer, Rezepte, **Zutaten**,
Nutzer-Rezepte, Landing, How-To. Der Zutaten-Tab leitet seine Liste aus den
Rezepten ab und erlaubt Umbenennen und Zusammenfuehren ueber
`/api/admin/ingredients`, mit Vorschau.

**Speicherweg nach Admin-Aenderungen:** Redis -> «Export JSON» -> Datei nach
`data/recipes.json` -> `npm run recipes:sync`. Ohne diesen Schritt ueberschreibt
der naechste «Seed Redis» die Aenderungen.

### Invarianten, die geprueft werden
- `ingredients` ist die Konkatenation der `ingredientGroups` (nur fuer frisch
  importierte Rezepte, `assertValidRecipe`)
- jede Zutat kommt in mindestens einer Gruppe vor (ganzer Bestand,
  `npm run recipes:check`)
- jede Kategorie aus `INGREDIENT_CATEGORIES` hat Symbol und Sortierplatz in
  `src/lib/shoppingCategories.ts`

### Daten, die nie ins Repository gehoeren
`data/users.json` und `data/pwd-reset-tokens.json` sind in `.gitignore` und aus
der Versionierung genommen. Sie enthalten Passwort-Hashes und gueltige Tokens.

### Offene Punkte
1. Admin-Passwort rotieren, der Hash liegt in der Git-Historie
2. `CRON_SECRET` in Vercel setzen, sonst laeuft der 30-Tage-Cleanup nicht
3. 25 Alt-Entwuerfe ohne `licenseStatus` und `rewrittenAt` entscheiden
4. Live sind nur 76 Rezepte freigegeben — eine gefilterte Massen-Freigabe fehlt
5. Marketing-Setup (SEO-Meta, OG-Images, Newsletter)
