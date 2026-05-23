/**
 * Dual-mode data layer:
 * - Local dev (no UPSTASH_REDIS_REST_URL):  reads/writes JSON files in /data/
 * - Production (Vercel):                    reads/writes Upstash Redis
 */

import type { Recipe, WeekPlan, AppSettings, PromotionsCache, WeatherCache, DayConstraint } from '@/types';

// Bundled seed data — included in the build, used to auto-populate Redis on first run
import seedRecipes from '../../data/recipes.json';
import seedSettings from '../../data/settings.json';
import seedConstraints from '../../data/constraints.json';

const USE_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;

// ─── Filesystem implementation (local dev) ────────────────────────────────────

function readJson<T>(filename: string): T {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filename: string, data: unknown): void {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), 'data', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Redis implementation (production) ───────────────────────────────────────

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

const K = {
  recipes:     'mz:recipes',
  settings:    'mz:settings',
  constraints: 'mz:constraints',
  promotions:  'mz:promotions',
  weather:     'mz:weather',
  weekplan:    (id: string) => `mz:weekplan:${id}`,
};

const EMPTY_PROMOTIONS: PromotionsCache = { lastUpdated: null, migros: [], coop: [], lidl: [] };
const EMPTY_WEATHER:    WeatherCache    = { lastUpdated: null, location: '', days: [] };

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  if (!USE_REDIS) return readJson<Recipe[]>('recipes.json');
  const redis = getRedis();
  const data = await redis.get<Recipe[]>(K.recipes);
  if (!data) { await redis.set(K.recipes, seedRecipes); return seedRecipes as Recipe[]; }
  return data;
}

export async function saveRecipes(recipes: Recipe[]): Promise<void> {
  if (!USE_REDIS) { writeJson('recipes.json', recipes); return; }
  await getRedis().set(K.recipes, recipes);
}

export async function getWeekPlan(weekId: string): Promise<WeekPlan | null> {
  if (!USE_REDIS) {
    const plans = readJson<Record<string, WeekPlan>>('weekplans.json');
    return plans[weekId] ?? null;
  }
  return getRedis().get<WeekPlan>(K.weekplan(weekId));
}

export async function saveWeekPlan(plan: WeekPlan): Promise<void> {
  if (!USE_REDIS) {
    const plans = readJson<Record<string, WeekPlan>>('weekplans.json');
    plans[plan.weekId] = plan;
    writeJson('weekplans.json', plans);
    return;
  }
  await getRedis().set(K.weekplan(plan.weekId), plan);
}

export async function getSettings(): Promise<AppSettings> {
  if (!USE_REDIS) return readJson<AppSettings>('settings.json');
  const redis = getRedis();
  const data = await redis.get<AppSettings>(K.settings);
  if (!data) { await redis.set(K.settings, seedSettings); return seedSettings as AppSettings; }
  return data;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!USE_REDIS) { writeJson('settings.json', settings); return; }
  await getRedis().set(K.settings, settings);
}

export async function getConstraints(): Promise<DayConstraint[]> {
  if (!USE_REDIS) return readJson<DayConstraint[]>('constraints.json');
  const redis = getRedis();
  const data = await redis.get<DayConstraint[]>(K.constraints);
  if (!data) { await redis.set(K.constraints, seedConstraints); return seedConstraints as DayConstraint[]; }
  return data;
}

export async function saveConstraints(constraints: DayConstraint[]): Promise<void> {
  if (!USE_REDIS) { writeJson('constraints.json', constraints); return; }
  await getRedis().set(K.constraints, constraints);
}

export async function getPromotions(): Promise<PromotionsCache> {
  if (!USE_REDIS) return readJson<PromotionsCache>('promotions.json');
  return (await getRedis().get<PromotionsCache>(K.promotions)) ?? EMPTY_PROMOTIONS;
}

export async function savePromotions(promotions: PromotionsCache): Promise<void> {
  if (!USE_REDIS) { writeJson('promotions.json', promotions); return; }
  await getRedis().set(K.promotions, promotions);
}

export async function getWeatherCache(): Promise<WeatherCache> {
  if (!USE_REDIS) return readJson<WeatherCache>('weather.json');
  return (await getRedis().get<WeatherCache>(K.weather)) ?? EMPTY_WEATHER;
}

export async function saveWeatherCache(weather: WeatherCache): Promise<void> {
  if (!USE_REDIS) { writeJson('weather.json', weather); return; }
  await getRedis().set(K.weather, weather, { ex: 6 * 60 * 60 });
}
