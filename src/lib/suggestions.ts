import type {
  Recipe,
  DayConstraint,
  WeatherType,
  Season,
  Promotion,
} from '@/types';
import { getCurrentSeason } from './utils';
import { isRecipeExcluded } from './allergens';

export interface SuggestionOptions {
  weatherType?: WeatherType;
  season?: Season;
  constraint?: DayConstraint;
  promotions?: Promotion[];
  excludeIds?: string[];
  lunchOnly?: boolean;
  usedThisWeek?: string[];
  allergiesAndAversions?: string[];
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

  const excluded = options.allergiesAndAversions ?? [];
  const available = recipes.filter((r) => {
    if (options.excludeIds?.includes(r.id)) return false;
    if (options.constraint?.constraint === 'leftovers') return false;
    if (options.lunchOnly && !r.isSuitableForLunch) return false;
    if (isRecipeExcluded(r, excluded)) return false;
    return true;
  });

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
  allergiesAndAversions?: string[];
}

// Fix #5: Categories that should never appear as dinner or lunch suggestions.
const BREAKFAST_CATEGORIES = new Set(['Frühstück']);
const SWEET_CATEGORIES     = new Set(['Süsses']);

export function suggestWeek(
  recipes: Recipe[],
  constraints: DayConstraint[],
  weatherTypes: Record<number, WeatherType>,
  season: Season,
  opts: SuggestWeekOptions = {}
): Record<number, { breakfast?: string; lunch?: string; dinner?: string }> {
  const { showBreakfast = false, showLunch = false, showDinner = true, allergiesAndAversions } = opts;
  const result: Record<number, { breakfast?: string; lunch?: string; dinner?: string }> = {};
  const usedIds: string[] = [];

  // Breakfast: prefer Frühstück category; also allow quick lunch-suitable recipes
  const breakfastRecipes = recipes.filter(
    (r) => BREAKFAST_CATEGORIES.has(r.category) || r.isSuitableForLunch
  );
  // Lunch: quick recipes, but NOT breakfast-only ones
  const lunchRecipes = recipes.filter(
    (r) => r.isSuitableForLunch && !BREAKFAST_CATEGORIES.has(r.category)
  );
  // Dinner: exclude breakfast and sweets
  const dinnerRecipes = recipes.filter(
    (r) => !BREAKFAST_CATEGORIES.has(r.category) && !SWEET_CATEGORIES.has(r.category)
  );

  for (let day = 1; day <= 7; day++) {
    const constraint = constraints.find((c) => c.dayOfWeek === day);
    const weatherType = weatherTypes[day] ?? 'neutral';

    if (constraint?.constraint === 'leftovers') {
      result[day] = {};
      continue;
    }

    result[day] = {};

    if (showDinner) {
      const dinner = suggestRecipe(dinnerRecipes, {
        weatherType, season, constraint, usedThisWeek: usedIds, allergiesAndAversions,
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
          weatherType, season, usedThisWeek: usedIds, lunchOnly: true, allergiesAndAversions,
        });
        if (lunch) {
          result[day].lunch = lunch.id;
          usedIds.push(lunch.id);
        }
      }
    }

    if (showBreakfast) {
      const breakfast = suggestRecipe(breakfastRecipes, {
        season, usedThisWeek: usedIds, allergiesAndAversions,
      });
      if (breakfast) {
        result[day].breakfast = breakfast.id;
      }
    }
  }

  return result;
}
