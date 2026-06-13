/**
 * Dual-mode data layer:
 * - Local dev (no UPSTASH_REDIS_REST_URL):  reads/writes JSON files in /data/
 * - Production (Vercel):                    reads/writes Upstash Redis
 *
 * Group-Scoping:
 *   - Recipes:  74 Template-Rezepte sind global. Jede Gruppe darf zusätzlich
 *               eigene custom-Rezepte anlegen. getRecipes(groupId) gibt beides
 *               kombiniert zurück.
 *   - Settings, Constraints, WeekPlans, ShoppingList: pro Gruppe.
 *
 * Backwards-compat: Wenn kein groupId übergeben wird, fällt der Code auf den
 * Legacy-globalen Pfad zurück (für Migrationsphase / Admin-Tools).
 */

import type { Recipe, WeekPlan, AppSettings, PromotionsCache, WeatherCache, DayConstraint, ShoppingGroups, RecipeRating, Category, PantryItem, ShoppingListState, SourceType } from '@/types';

import seedRecipes     from '../../data/recipes.json';
import seedSettings    from '../../data/settings.json';
import seedConstraints from '../../data/constraints.json';

const USE_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;

// ─── Filesystem helpers (local dev) ───────────────────────────────────────────

function readJson<T>(filename: string, fallback: T): T {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), 'data', filename);
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T; }
  catch { return fallback; }
}

function writeJson(filename: string, data: unknown): void {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), 'data', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

// ─── Storage Keys (Redis) / Filenames (Local) ─────────────────────────────────

const K = {
  // Global (Templates / Caches)
  recipesGlobal: 'mz:recipes',                                  // 74 Template-Rezepte
  promotions:    'mz:promotions',
  weather:       'mz:weather',
  // Global Ratings (per recipe, sichtbar fuer alle User)
  recipeRatings:    (id: string) => `mz:recipe:${id}:ratings`,
  recipesSeedManifest: 'mz:recipes:seed_manifest', // IDs der letzten Seed-Operation
  // Group-scoped
  groupRecipes:        (g: string) => `mz:group:${g}:recipes`,     // custom recipes
  groupSettings:       (g: string) => `mz:group:${g}:settings`,
  groupConstraints:    (g: string) => `mz:group:${g}:constraints`,
  groupWeekPlan:       (g: string, w: string) => `mz:group:${g}:weekplan:${w}`,
  groupShoppingGroups: (g: string, w: string) => `mz:group:${g}:week:${w}:shopping_groups`,
  groupShoppingState:  (g: string, w: string) => `mz:group:${g}:week:${w}:shopping_state`,
  groupFavorites:      (g: string)             => `mz:group:${g}:favorites`,
  groupPantry:         (g: string)             => `mz:group:${g}:pantry`,
};

const EMPTY_PROMOTIONS: PromotionsCache = { lastUpdated: null, migros: [], coop: [], denner: [], aldi: [], lidl: [], volg: [] };
const EMPTY_WEATHER:    WeatherCache    = { lastUpdated: null, location: '', days: [] };

// ─── Gruppen-Daten vollständig löschen (Konto-Löschung / 30-Tage-Cleanup) ──────

/** Löscht ALLE gruppen-bezogenen Daten (Rezepte, Settings, Wochenpläne, Listen, Pantry, Favoriten). */
export async function purgeGroupData(groupId: string): Promise<void> {
  if (!USE_REDIS) {
    const files = [
      'group-recipes.json', 'group-settings.json', 'group-constraints.json',
      'group-weekplans.json', 'group-shopping-groups.json', 'group-shopping-state.json',
      'group-pantry.json', 'favorites.json',
    ];
    for (const f of files) {
      const all = readJson<Record<string, unknown>>(f, {});
      if (groupId in all) {
        delete all[groupId];
        writeJson(f, all);
      }
    }
    return;
  }
  const redis = getRedis();
  // Alle Keys mit Prefix mz:group:<id>: per SCAN finden und löschen
  let cursor = '0';
  const toDelete: string[] = [];
  do {
    const [next, keys] = await redis.scan(cursor, { match: `mz:group:${groupId}:*`, count: 100 });
    toDelete.push(...keys);
    cursor = String(next);
  } while (cursor !== '0');
  if (toDelete.length) await redis.del(...toDelete);
}

// ─── Templates (global Recipes — 74) ──────────────────────────────────────────

export async function getTemplateRecipes(): Promise<Recipe[]> {
  if (!USE_REDIS) return readJson<Recipe[]>('recipes.json', seedRecipes as Recipe[]);
  // Redis-first: admin edits write to Redis (mz:recipes).
  // Fall back to bundled seed only when Redis is empty (first deploy or after manual clear).
  const stored = await getRedis().get<Recipe[]>(K.recipesGlobal);
  return stored ?? (seedRecipes as Recipe[]);
}

export async function saveTemplateRecipes(recipes: Recipe[]): Promise<void> {
  if (!USE_REDIS) { writeJson('recipes.json', recipes); return; }
  await getRedis().set(K.recipesGlobal, recipes);
}

// ─── Legacy recipe normalizer (Redis group recipes may use old schema) ────────

const OLD_CAT_MAP: Record<string, Category> = {
  // Legacy folder-based names (very old schema)
  'Eier':             'Eiergerichte',
  'Reis':             'Reis, Getreide & Hülsenfrüchte',
  'Eintopf/Gratin':   'Suppen, Eintöpfe & Currys',
  'Fisch':            'Fisch & Meeresfrüchte',
  'Sonstige':         'Gemüsegerichte',
  'Asiatisch':        'Gemüsegerichte',
  'Ofen':             'Aufläufe & Gratins',
  'Suppen':           'Suppen, Eintöpfe & Currys',
  'Salat/Bowl':       'Salate & Bowls',
  'Frühstück':        'Eiergerichte',
  'Süsses':           'Desserts & Süsses',
  'Brot & Aufstrich': 'Snacks & Vorspeisen',
  'Snacks':           'Snacks & Vorspeisen',
  // v2 category renames
  'Pasta':                      'Pasta & Teigwaren',
  'Reis & Getreide':            'Reis, Getreide & Hülsenfrüchte',
  'Wraps & Sandwiches':         'Wraps, Sandwiches & Burger',
  'Vegetarische Hauptgerichte': 'Gemüsegerichte',
  'Eigene Rezepte':             'Gemüsegerichte',
};
const SEASON_VALS = new Set(['Frühling', 'Sommer', 'Herbst', 'Winter']);

const TAG_RENAMES: Record<string, string> = {
  'Schweizer':        'Schweizerisch',
  'Orientalisch':     'Nahöstlich',
  'Frühstücksgericht': 'Frühstück',
  'Mittagsgericht':   'Mittagessen',
  'Abendgericht':     'Abendessen',
  'Abendsgericht':    'Abendessen',
  'Winterzeit':       'Winter',
  'Sommergericht':    'Sommer',
};
const REMOVE_TAGS = new Set(['Schnell und einfach', 'Schnell zubereitet', 'Schnell', 'Einfach', 'Fisch', 'Fleischhaltig', 'Pescetarisch', 'Vegetarisch', 'Vegan']);

function normalizeRecipe(r: Recipe): Recipe {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = r as any;
  // Sanitize literal \uXXXX sequences in category (data quality issue in some recipes)
  const catStr = (r.category as string).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // Category migration
  const wasFreuehstueck = catStr === 'Frühstück';
  const wasEigeneRezepte = catStr === 'Eigene Rezepte';
  if (OLD_CAT_MAP[catStr]) {
    r = { ...r, category: OLD_CAT_MAP[catStr] };
    if (catStr === 'Ofen') raw._addOfengericht = true;
  }

  // sourceType for migrated user-created recipes
  if (wasEigeneRezepte && !r.sourceType) {
    r = { ...r, sourceType: 'user_created' };
  }

  // Frühstück: ensure Mahlzeit-Tag 'Frühstück' is present
  if (wasFreuehstueck && Array.isArray(r.tags) && !r.tags.includes('Frühstück') && !r.tags.includes('Frühstücksgericht')) {
    r = { ...r, tags: [...r.tags, 'Frühstück'] };
  }

  // Tags migration
  if (!Array.isArray(raw.tags)) {
    // Very old schema: no tags array — reconstruct from legacy fields
    const tags: string[] = [];
    if (Array.isArray(raw.season)) {
      raw.season.forEach((s: string) => { if (SEASON_VALS.has(s)) tags.push(s); });
    }
    if (raw.isMealprep)         tags.push('Mealprep-geeignet');
    if (raw.isSuitableForLunch) tags.push('Mittagessen');
    if (raw._addOfengericht)    tags.push('Ofengericht');
    if (catStr === 'Asiatisch') tags.push('Asiatisch');
    r = { ...r, tags };
  } else {
    // Current schema: rename/remove stale tag values
    const mapped = r.tags.filter(t => !REMOVE_TAGS.has(t)).map(t => TAG_RENAMES[t] ?? t);
    const newTags = mapped.filter((t, i) => mapped.indexOf(t) === i);
    if (raw._addOfengericht && !newTags.includes('Ofengericht')) {
      newTags.push('Ofengericht');
    }
    if (newTags.length !== r.tags.length || newTags.some((t, i) => t !== r.tags[i])) {
      r = { ...r, tags: newTags };
    }
  }

  return r;
}

// ─── Group-scoped Recipes (custom recipes per group) ──────────────────────────

export async function getGroupCustomRecipes(groupId: string): Promise<Recipe[]> {
  let recipes: Recipe[];
  if (!USE_REDIS) {
    const all = readJson<Record<string, Recipe[]>>('group-recipes.json', {});
    recipes = all[groupId] ?? [];
  } else {
    recipes = (await getRedis().get<Recipe[]>(K.groupRecipes(groupId))) ?? [];
  }
  return recipes.map(normalizeRecipe);
}

async function saveGroupCustomRecipes(groupId: string, recipes: Recipe[]): Promise<void> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, Recipe[]>>('group-recipes.json', {});
    all[groupId] = recipes;
    writeJson('group-recipes.json', all);
    return;
  }
  await getRedis().set(K.groupRecipes(groupId), recipes);
}

export async function getFavorites(groupId: string): Promise<string[]> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, string[]>>('favorites.json', {});
    return all[groupId] ?? [];
  }
  return (await getRedis().get<string[]>(K.groupFavorites(groupId))) ?? [];
}

export async function saveFavorites(groupId: string, recipeIds: string[]): Promise<void> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, string[]>>('favorites.json', {});
    all[groupId] = recipeIds;
    writeJson('favorites.json', all);
    return;
  }
  await getRedis().set(K.groupFavorites(groupId), recipeIds);
}

export async function getPantry(groupId: string): Promise<PantryItem[]> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, PantryItem[]>>('group-pantry.json', {});
    return all[groupId] ?? [];
  }
  return (await getRedis().get<PantryItem[]>(K.groupPantry(groupId))) ?? [];
}

export async function savePantry(groupId: string, items: PantryItem[]): Promise<void> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, PantryItem[]>>('group-pantry.json', {});
    all[groupId] = items;
    writeJson('group-pantry.json', all);
    return;
  }
  await getRedis().set(K.groupPantry(groupId), items);
}

/**
 * Liefert alle für eine Gruppe sichtbaren Rezepte: Templates + Gruppen-Overrides + neue Rezepte.
 * Gruppen-Overrides (gleiche ID wie ein Template, aber geändert) ersetzen das Original.
 */
export async function getRecipes(groupId?: string): Promise<Recipe[]> {
  const templates = await getTemplateRecipes();
  if (!groupId) return templates;
  const custom = await getGroupCustomRecipes(groupId);
  // Gruppen-Rezepte mit Template-ID überschreiben das jeweilige Template
  const overriddenIds = new Set(custom.map(r => r.id));
  return [...templates.filter(t => !overriddenIds.has(t.id)), ...custom];
}

export async function saveRecipes(recipes: Recipe[], groupId?: string): Promise<void> {
  // Legacy: ohne groupId überschreiben wir die Templates (Admin-Tooling).
  if (!groupId) {
    await saveTemplateRecipes(recipes);
    return;
  }
  // Speichere: neue Rezepte (keine Template-ID) + geänderte Templates (Override).
  // Unveränderte Templates werden weggelassen — sie kommen immer aus dem Seed.
  const templates   = await getTemplateRecipes();
  const templateMap = new Map(templates.map(t => [t.id, JSON.stringify(t)]));
  const toSave = recipes.filter(r => {
    const orig = templateMap.get(r.id);
    if (!orig) return true;                    // neues eigenes Rezept
    return JSON.stringify(r) !== orig;          // Template wurde geändert → Override
  });
  await saveGroupCustomRecipes(groupId, toSave);
}

// ─── Group-scoped Settings ───────────────────────────────────────────────────

/** Stellt sicher dass neuere Settings-Felder vorhanden sind (Migration alter Datensätze) */
function normalizeSettings(s: AppSettings): AppSettings {
  if (!s.promotions) {
    return { ...s, promotions: { enabledStores: ['migros', 'coop', 'lidl'] } };
  }
  if (!s.promotions.enabledStores) {
    // Alte Struktur (nur manualX) → enabledStores migrieren
    return { ...s, promotions: { ...s.promotions, enabledStores: ['migros', 'coop', 'lidl'] } };
  }
  return s;
}

export async function getSettings(groupId?: string): Promise<AppSettings> {
  if (!groupId) {
    // Legacy fallback (z.B. Admin ohne Group)
    return normalizeSettings(readJson<AppSettings>('settings.json', seedSettings as AppSettings));
  }
  if (!USE_REDIS) {
    const all = readJson<Record<string, AppSettings>>('group-settings.json', {});
    return normalizeSettings(all[groupId] ?? (seedSettings as AppSettings));
  }
  const redis = getRedis();
  const data  = await redis.get<AppSettings>(K.groupSettings(groupId));
  if (!data) {
    // Erste Settings für diese Gruppe — Seed kopieren
    await redis.set(K.groupSettings(groupId), seedSettings);
    return normalizeSettings(seedSettings as AppSettings);
  }
  return normalizeSettings(data);
}

export async function saveSettings(settings: AppSettings, groupId?: string): Promise<void> {
  if (!groupId) {
    // Fix #8: Only write local file in dev — Vercel has no writable filesystem.
    if (!USE_REDIS) writeJson('settings.json', settings);
    return;
  }
  if (!USE_REDIS) {
    const all = readJson<Record<string, AppSettings>>('group-settings.json', {});
    all[groupId] = settings;
    writeJson('group-settings.json', all);
    return;
  }
  await getRedis().set(K.groupSettings(groupId), settings);
}

// ─── Group-scoped Constraints ────────────────────────────────────────────────

export async function getConstraints(groupId?: string): Promise<DayConstraint[]> {
  if (!groupId) return readJson<DayConstraint[]>('constraints.json', seedConstraints as DayConstraint[]);
  if (!USE_REDIS) {
    const all = readJson<Record<string, DayConstraint[]>>('group-constraints.json', {});
    return all[groupId] ?? [];
  }
  return (await getRedis().get<DayConstraint[]>(K.groupConstraints(groupId))) ?? [];
}

export async function saveConstraints(constraints: DayConstraint[], groupId?: string): Promise<void> {
  if (!groupId) { writeJson('constraints.json', constraints); return; }
  if (!USE_REDIS) {
    const all = readJson<Record<string, DayConstraint[]>>('group-constraints.json', {});
    all[groupId] = constraints;
    writeJson('group-constraints.json', all);
    return;
  }
  await getRedis().set(K.groupConstraints(groupId), constraints);
}

// ─── Group-scoped WeekPlans ──────────────────────────────────────────────────

export async function getWeekPlan(weekId: string, groupId?: string): Promise<WeekPlan | null> {
  if (!groupId) {
    const plans = readJson<Record<string, WeekPlan>>('weekplans.json', {});
    return plans[weekId] ?? null;
  }
  if (!USE_REDIS) {
    const all = readJson<Record<string, Record<string, WeekPlan>>>('group-weekplans.json', {});
    return all[groupId]?.[weekId] ?? null;
  }
  return getRedis().get<WeekPlan>(K.groupWeekPlan(groupId, weekId));
}

export async function saveWeekPlan(plan: WeekPlan, groupId?: string): Promise<void> {
  if (!groupId) {
    const plans = readJson<Record<string, WeekPlan>>('weekplans.json', {});
    plans[plan.weekId] = plan;
    writeJson('weekplans.json', plans);
    return;
  }
  if (!USE_REDIS) {
    const all = readJson<Record<string, Record<string, WeekPlan>>>('group-weekplans.json', {});
    if (!all[groupId]) all[groupId] = {};
    all[groupId][plan.weekId] = plan;
    writeJson('group-weekplans.json', all);
    return;
  }
  await getRedis().set(K.groupWeekPlan(groupId, plan.weekId), plan);
}

// ─── Shopping Groups (pro Gruppe + Woche) ────────────────────────────────────

/** Standard: alle 7 Tage in einer Einkaufsliste */
function defaultShoppingGroups(): ShoppingGroups {
  return [{ id: 'sg-1', dayIndices: [1, 2, 3, 4, 5, 6, 7] }];
}

export async function getShoppingGroups(weekId: string, groupId: string): Promise<ShoppingGroups> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, Record<string, ShoppingGroups>>>('group-shopping-groups.json', {});
    return all[groupId]?.[weekId] ?? defaultShoppingGroups();
  }
  return (await getRedis().get<ShoppingGroups>(K.groupShoppingGroups(groupId, weekId))) ?? defaultShoppingGroups();
}

export async function saveShoppingGroups(weekId: string, groupId: string, groups: ShoppingGroups): Promise<void> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, Record<string, ShoppingGroups>>>('group-shopping-groups.json', {});
    if (!all[groupId]) all[groupId] = {};
    all[groupId][weekId] = groups;
    writeJson('group-shopping-groups.json', all);
    return;
  }
  await getRedis().set(K.groupShoppingGroups(groupId, weekId), groups);
}

// ─── Shopping List State (pro Gruppe + Woche, shared unter Haushaltsmitgliedern) ────

function emptyShoppingListState(): ShoppingListState {
  return { checked: [], userPantry: [], overrides: {}, customItems: [], updatedAt: new Date(0).toISOString() };
}

export async function getShoppingListState(groupId: string, weekId: string): Promise<ShoppingListState> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, Record<string, ShoppingListState>>>('group-shopping-state.json', {});
    return all[groupId]?.[weekId] ?? emptyShoppingListState();
  }
  return (await getRedis().get<ShoppingListState>(K.groupShoppingState(groupId, weekId))) ?? emptyShoppingListState();
}

export async function saveShoppingListState(groupId: string, weekId: string, state: ShoppingListState): Promise<void> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, Record<string, ShoppingListState>>>('group-shopping-state.json', {});
    if (!all[groupId]) all[groupId] = {};
    all[groupId][weekId] = state;
    writeJson('group-shopping-state.json', all);
    return;
  }
  // 60 Tage TTL — wird pro Woche gespeichert und ist zeitlich begrenzt relevant
  await getRedis().set(K.groupShoppingState(groupId, weekId), state, { ex: 60 * 24 * 60 * 60 });
}

// ─── Promotions & Weather (global — nicht gruppen-spezifisch) ────────────────

export async function getPromotions(): Promise<PromotionsCache> {
  if (!USE_REDIS) return readJson<PromotionsCache>('promotions.json', EMPTY_PROMOTIONS);
  return (await getRedis().get<PromotionsCache>(K.promotions)) ?? EMPTY_PROMOTIONS;
}

export async function savePromotions(promotions: PromotionsCache): Promise<void> {
  if (!USE_REDIS) { writeJson('promotions.json', promotions); return; }
  await getRedis().set(K.promotions, promotions);
}

export async function getWeatherCache(): Promise<WeatherCache> {
  if (!USE_REDIS) return readJson<WeatherCache>('weather.json', EMPTY_WEATHER);
  return (await getRedis().get<WeatherCache>(K.weather)) ?? EMPTY_WEATHER;
}

export async function saveWeatherCache(weather: WeatherCache): Promise<void> {
  if (!USE_REDIS) { writeJson('weather.json', weather); return; }
  await getRedis().set(K.weather, weather, { ex: 6 * 60 * 60 });
}

// ─── Recipe Ratings (global — fuer alle User sichtbar) ───────────────────────

export async function getRecipeRatings(recipeId: string): Promise<RecipeRating[]> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, RecipeRating[]>>('recipe-ratings.json', {});
    return all[recipeId] ?? [];
  }
  return (await getRedis().get<RecipeRating[]>(K.recipeRatings(recipeId))) ?? [];
}

export async function saveRecipeRating(recipeId: string, rating: RecipeRating): Promise<void> {
  // Upsert: eine Bewertung pro userId, neueste ersetzt die alte
  if (!USE_REDIS) {
    const all = readJson<Record<string, RecipeRating[]>>('recipe-ratings.json', {});
    const existing = all[recipeId] ?? [];
    const updated  = [...existing.filter((r) => r.userId !== rating.userId), rating];
    all[recipeId]  = updated;
    writeJson('recipe-ratings.json', all);
    return;
  }
  const existing = (await getRedis().get<RecipeRating[]>(K.recipeRatings(recipeId))) ?? [];
  const updated  = [...existing.filter((r) => r.userId !== rating.userId), rating];
  await getRedis().set(K.recipeRatings(recipeId), updated);
}
