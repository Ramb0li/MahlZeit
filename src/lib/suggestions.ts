import type {
  Recipe,
  DayConstraint,
  WeatherType,
  Season,
  Promotion,
} from '@/types';
import { getCurrentSeason } from './utils';

export interface SuggestionOptions {
  weatherType?: WeatherType;
  season?: Season;
  constraint?: DayConstraint;
  promotions?: Promotion[];
  excludeIds?: string[];
  lunchOnly?: boolean;
  usedThisWeek?: string[];
}

function recipeScore(
  recipe: Recipe,
  options: SuggestionOptions,
  promotionKeywords: string[]
): number {
  let score = 0;

  const season = options.season ?? getCurrentSeason();
  if (recipe.season.includes('ganzjährig') || recipe.season.includes(season)) score += 10;

  if (options.weatherType && recipe.weatherType === options.weatherType) score += 15;
  else if (options.weatherType && recipe.weatherType === 'neutral') score += 5;

  if (options.constraint?.constraint === 'maxTime' && options.constraint.maxTimeMinutes) {
    if (recipe.timeMinutes <= options.constraint.maxTimeMinutes) score += 8;
    else score -= 20;
  }

  if (options.constraint?.constraint === 'mealprep' && recipe.isMealprep) score += 12;

  if (options.lunchOnly && !recipe.isSuitableForLunch) score -= 50;

  if (promotionKeywords.some((kw) => recipe.name.toLowerCase().includes(kw) ||
    recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(kw)))) {
    score += 20;
  }

  if (options.usedThisWeek?.includes(recipe.id)) score -= 30;

  score += Math.random() * 5;

  return score;
}

export function suggestRecipe(
  recipes: Recipe[],
  options: SuggestionOptions
): Recipe | null {
  if (!recipes.length) return null;

  const promoKeywords = (options.promotions ?? []).map((p) =>
    p.product.toLowerCase().split(' ')[0]
  );

  const available = recipes.filter(
    (r) =>
      !options.excludeIds?.includes(r.id) &&
      !(options.constraint?.constraint === 'leftovers') &&
      (options.lunchOnly ? r.isSuitableForLunch : true)
  );

  if (!available.length) return null;

  const scored = available.map((r) => ({
    recipe: r,
    score: recipeScore(r, options, promoKeywords),
  }));

  scored.sort((a, b) => b.score - a.score);

  const topN = Math.min(3, scored.length);
  const pick = scored[Math.floor(Math.random() * topN)];
  return pick?.recipe ?? null;
}

export function suggestWeek(
  recipes: Recipe[],
  constraints: DayConstraint[],
  weatherTypes: Record<number, WeatherType>,
  season: Season
): Record<number, { lunch?: string; dinner?: string }> {
  const result: Record<number, { lunch?: string; dinner?: string }> = {};
  const usedIds: string[] = [];

  for (let day = 1; day <= 7; day++) {
    const constraint = constraints.find((c) => c.dayOfWeek === day);
    const weatherType = weatherTypes[day] ?? 'neutral';

    if (constraint?.constraint === 'leftovers') {
      result[day] = {};
      continue;
    }

    const dinner = suggestRecipe(recipes, {
      weatherType,
      season,
      constraint,
      usedThisWeek: usedIds,
    });

    if (dinner) {
      result[day] = { dinner: dinner.id };
      usedIds.push(dinner.id);
    }

    const mealPrepConstraint = constraints.find((c) => c.mealprepLunchDays?.includes(day));
    if (mealPrepConstraint) {
      const sourceDay = mealPrepConstraint.dayOfWeek;
      if (result[sourceDay]?.dinner) {
        result[day] = { ...result[day], lunch: result[sourceDay].dinner };
      }
    }
  }

  return result;
}
