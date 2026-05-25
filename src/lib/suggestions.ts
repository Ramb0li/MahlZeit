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

export interface SuggestWeekOptions {
  showBreakfast?: boolean;
  showLunch?: boolean;
  showDinner?: boolean;
}

export function suggestWeek(
  recipes: Recipe[],
  constraints: DayConstraint[],
  weatherTypes: Record<number, WeatherType>,
  season: Season,
  opts: SuggestWeekOptions = {}
): Record<number, { breakfast?: string; lunch?: string; dinner?: string }> {
  const { showBreakfast = false, showLunch = false, showDinner = true } = opts;
  const result: Record<number, { breakfast?: string; lunch?: string; dinner?: string }> = {};
  const usedIds: string[] = [];

  // Recipes suitable for lunch/breakfast (quick, lunch-suitable)
  const lunchRecipes = recipes.filter((r) => r.isSuitableForLunch);

  for (let day = 1; day <= 7; day++) {
    const constraint = constraints.find((c) => c.dayOfWeek === day);
    const weatherType = weatherTypes[day] ?? 'neutral';

    if (constraint?.constraint === 'leftovers') {
      result[day] = {};
      continue;
    }

    result[day] = {};

    if (showDinner) {
      const dinner = suggestRecipe(recipes, {
        weatherType, season, constraint, usedThisWeek: usedIds,
      });
      if (dinner) {
        result[day].dinner = dinner.id;
        usedIds.push(dinner.id);
      }
    }

    if (showLunch) {
      // Check if this day gets mealprep lunch from another day
      const mealPrepConstraint = constraints.find((c) => c.mealprepLunchDays?.includes(day));
      if (mealPrepConstraint) {
        const sourceDay = mealPrepConstraint.dayOfWeek;
        if (result[sourceDay]?.dinner) {
          result[day].lunch = result[sourceDay].dinner;
        }
      } else {
        const lunch = suggestRecipe(lunchRecipes, {
          weatherType, season, usedThisWeek: usedIds, lunchOnly: true,
        });
        if (lunch) {
          result[day].lunch = lunch.id;
          usedIds.push(lunch.id);
        }
      }
    }

    if (showBreakfast) {
      const breakfast = suggestRecipe(lunchRecipes, {
        season, usedThisWeek: usedIds, lunchOnly: true,
      });
      if (breakfast) {
        result[day].breakfast = breakfast.id;
      }
    }
  }

  return result;
}
