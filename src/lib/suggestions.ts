import type {
  Recipe,
  DayConstraint,
  WeatherType,
  Promotion,
  Category,
} from '@/types';
import { getCurrentSeason } from './utils';
import { isRecipeExcluded } from './allergens';

const SEASON_TAGS = new Set(['Frühling', 'Sommer', 'Herbst', 'Winter']);

export interface SuggestionOptions {
  weatherType?: WeatherType;
  season?: string;
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
  const recipeSeasoned = recipe.tags.some(t => SEASON_TAGS.has(t));
  // No season tags = ganzjährig (always in season); tagged → only current season
  if (!recipeSeasoned || recipe.tags.includes(season)) score += 10;

  if (options.weatherType && recipe.weatherType === options.weatherType) score += 15;
  else if (options.weatherType && recipe.weatherType === 'neutral') score += 5;

  if (options.constraint?.constraint === 'maxTime' && options.constraint.maxTimeMinutes) {
    if (recipe.timeMinutes <= options.constraint.maxTimeMinutes) score += 8;
    else score -= 20;
  }

  if (options.constraint?.constraint === 'mealprep' && recipe.tags.includes('Mealprep-geeignet')) score += 12;

  if (options.lunchOnly && !recipe.tags.includes('Mittagsgericht')) score -= 50;

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
    if (options.lunchOnly && !r.tags.includes('Mittagsgericht')) return false;
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
  flexitarisch?: boolean;  // max 1 Fleischgericht pro Wochenplan
  favorites?: string[];    // recipe IDs — wenn ≥3, mind. 1 Dinner/Woche aus Favoriten
}

const BREAKFAST_CATS  = new Set<Category>(['Frühstück']);
const EXCLUDED_CATS   = new Set<Category>(['Snacks & Vorspeisen', 'Desserts & Süsses']);

function isMeatRecipe(r: Recipe): boolean {
  return r.category === 'Fleisch & Geflügel' ||
    (!r.tags.includes('Vegetarisch') && !r.tags.includes('Vegan') && r.category !== 'Fisch & Meeresfrüchte');
}

export function suggestWeek(
  recipes: Recipe[],
  constraints: DayConstraint[],
  weatherTypes: Record<number, WeatherType>,
  season: string,
  opts: SuggestWeekOptions = {}
): Record<number, { breakfast?: string; lunch?: string; dinner?: string }> {
  const { showBreakfast = false, showLunch = false, showDinner = true, allergiesAndAversions, flexitarisch = false, favorites = [] } = opts;
  const result: Record<number, { breakfast?: string; lunch?: string; dinner?: string }> = {};
  const usedIds: string[] = [];
  let meatMealsThisWeek = 0;

  // Breakfast: only Frühstück category
  const breakfastRecipes = recipes.filter(r => BREAKFAST_CATS.has(r.category));
  // Lunch: tagged 'Mittagsgericht', not breakfast
  const lunchRecipes = recipes.filter(
    r => r.tags.includes('Mittagsgericht') && !BREAKFAST_CATS.has(r.category)
  );
  // Dinner: not breakfast, not snacks/desserts; exclude lunch-only (Mittagsgericht without Abendgericht)
  const dinnerRecipes = recipes.filter(
    r => !BREAKFAST_CATS.has(r.category) &&
         !EXCLUDED_CATS.has(r.category) &&
         (!r.tags.includes('Mittagsgericht') || r.tags.includes('Abendgericht'))
  );

  // Favoriten-Tag: wenn ≥3 definiert, einen zufälligen Dinner-Tag reservieren
  // Leftovers-Tage ausschliessen, damit die Garantie immer erfüllt werden kann
  const favSet = new Set(favorites);
  const favDinnerPool = dinnerRecipes.filter(r => favSet.has(r.id));
  const eligibleDays  = [1, 2, 3, 4, 5, 6, 7].filter(
    d => !constraints.some(c => c.dayOfWeek === d && c.constraint === 'leftovers')
  );
  const favoriteDayIndex = favDinnerPool.length >= 3 && eligibleDays.length > 0
    ? eligibleDays[Math.floor(Math.random() * eligibleDays.length)]
    : null;

  for (let day = 1; day <= 7; day++) {
    const constraint = constraints.find((c) => c.dayOfWeek === day);
    const weatherType = weatherTypes[day] ?? 'neutral';

    if (constraint?.constraint === 'leftovers') {
      result[day] = {};
      continue;
    }

    result[day] = {};

    if (showDinner) {
      const basePool = flexitarisch && meatMealsThisWeek >= 1
        ? dinnerRecipes.filter(r => !isMeatRecipe(r))
        : dinnerRecipes;
      const isFavDay = favoriteDayIndex === day && favDinnerPool.length > 0;
      const favFiltered = isFavDay ? favDinnerPool.filter(r => basePool.some(b => b.id === r.id)) : [];
      const dinnerPool = favFiltered.length > 0 ? favFiltered : basePool;
      const dinner = suggestRecipe(dinnerPool, {
        weatherType, season, constraint, usedThisWeek: usedIds, allergiesAndAversions,
      });
      if (dinner) {
        result[day].dinner = dinner.id;
        usedIds.push(dinner.id);
        if (isMeatRecipe(dinner)) meatMealsThisWeek++;
      }
    }

    if (showLunch) {
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
