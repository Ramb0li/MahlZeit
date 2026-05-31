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

import type { Recipe, WeekPlan, AppSettings, PromotionsCache, WeatherCache, DayConstraint, ShoppingGroups } from '@/types';

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
  // Group-scoped
  groupRecipes:        (g: string) => `mz:group:${g}:recipes`,     // custom recipes
  groupSettings:       (g: string) => `mz:group:${g}:settings`,
  groupConstraints:    (g: string) => `mz:group:${g}:constraints`,
  groupWeekPlan:       (g: string, w: string) => `mz:group:${g}:weekplan:${w}`,
  groupShoppingGroups: (g: string, w: string) => `mz:group:${g}:week:${w}:shopping_groups`,
};

const EMPTY_PROMOTIONS: PromotionsCache = { lastUpdated: null, migros: [], coop: [], lidl: [] };
const EMPTY_WEATHER:    WeatherCache    = { lastUpdated: null, location: '', days: [] };

// ─── Templates (global Recipes — 74) ──────────────────────────────────────────

export async function getTemplateRecipes(): Promise<Recipe[]> {
  if (!USE_REDIS) return readJson<Recipe[]>('recipes.json', seedRecipes as Recipe[]);
  // Fix #1: In production always use the bundled seed — embedded at build time,
  // guaranteed up-to-date after every deploy. Caching in Redis caused stale data
  // whenever new template recipes were added (the old Redis value was returned).
  return seedRecipes as Recipe[];
}

export async function saveTemplateRecipes(recipes: Recipe[]): Promise<void> {
  if (!USE_REDIS) { writeJson('recipes.json', recipes); return; }
  await getRedis().set(K.recipesGlobal, recipes);
}

// ─── Group-scoped Recipes (custom recipes per group) ──────────────────────────

async function getGroupCustomRecipes(groupId: string): Promise<Recipe[]> {
  if (!USE_REDIS) {
    const all = readJson<Record<string, Recipe[]>>('group-recipes.json', {});
    return all[groupId] ?? [];
  }
  return (await getRedis().get<Recipe[]>(K.groupRecipes(groupId))) ?? [];
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

export async function getSettings(groupId?: string): Promise<AppSettings> {
  if (!groupId) {
    // Legacy fallback (z.B. Admin ohne Group)
    return readJson<AppSettings>('settings.json', seedSettings as AppSettings);
  }
  if (!USE_REDIS) {
    const all = readJson<Record<string, AppSettings>>('group-settings.json', {});
    return all[groupId] ?? (seedSettings as AppSettings);
  }
  const redis = getRedis();
  const data  = await redis.get<AppSettings>(K.groupSettings(groupId));
  if (!data) {
    // Erste Settings für diese Gruppe — Seed kopieren
    await redis.set(K.groupSettings(groupId), seedSettings);
    return seedSettings as AppSettings;
  }
  return data;
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
