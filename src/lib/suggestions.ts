import type {
  Recipe,
  DayConstraint,
  WeatherType,
  Promotion,
  Category,
} from '@/types';
import { getCurrentSeason } from './utils';
import { isRecipeExcluded } from './allergens';

const SEASON_TAGS = new Set(['Frühling', 'Sommer', 'Herbst', 'Winter', 'Ganzjährig']);

// ── Kohlenhydrat-Typ-Erkennung ────────────────────────────────────────────────

const PASTA_WORDS   = ['nudel', 'pasta', 'spaghetti', 'tagliatelle', 'penne', 'linguine', 'gnocchi', 'farfalle', 'rigatoni', 'fusilli', 'spätzle', 'lasagne'];
const RICE_WORDS    = ['risotto', 'orzotto', 'kernotto', ' reis', 'reis '];
const POTATO_WORDS  = ['kartoffel', 'rösti', 'bratkartoffel'];

export function getCarbType(r: Recipe): string | null {
  const n = r.name.toLowerCase();
  if (r.category === 'Pasta & Teigwaren' || PASTA_WORDS.some(w => n.includes(w))) return 'pasta';
  if (r.category === 'Reis, Getreide & Hülsenfrüchte' || RICE_WORDS.some(w => n.includes(w))) return 'rice';
  if (r.category === 'Kartoffelgerichte' || POTATO_WORDS.some(w => n.includes(w))) return 'potato';
  if (n.includes('couscous')) return 'couscous';
  if (n.includes('polenta')) return 'polenta';
  if (n.includes('quinoa')) return 'quinoa';
  if (n.includes('ebly')) return 'ebly';
  return null;
}

// ── Effektive Diät-Kategorie (bevorzugt dietCategory, Fallback über Kategorie/Tags) ──

/**
 * Bestimmt die effektive Diät-Kategorie eines Rezepts.
 * Nutzt das explizite `dietCategory`-Feld wenn gesetzt, sonst Fallback über
 * Kategorie (Fleisch & Geflügel → meat, Fisch & Meeresfrüchte → fish) und Tags.
 * Fallback bei unbekannten Rezepten: 'vegetarian' (konservativ, nie Fleisch anzeigen).
 */
export function getEffectiveDietCategory(r: Recipe): 'meat' | 'fish' | 'vegetarian' | 'vegan' {
  if (r.dietCategory) return r.dietCategory;
  if (r.category === 'Fleisch & Geflügel') return 'meat';
  if (r.category === 'Fisch & Meeresfrüchte') return 'fish';
  if (r.tags.includes('Vegan')) return 'vegan';
  if (r.tags.includes('Vegetarisch')) return 'vegetarian';
  return 'vegetarian';
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface SuggestionOptions {
  weatherType?: WeatherType;
  season?: string;
  constraint?: DayConstraint;
  promotions?: Promotion[];
  excludeIds?: string[];
  lunchOnly?: boolean;
  usedThisWeek?: string[];
  allergiesAndAversions?: string[];
  carbCounts?: Record<string, number>;   // NEU: verhindert KH-Monotonie
  pantryIngredients?: string[];          // NEU: Vorrat-Bonus
}

function recipeScore(
  recipe: Recipe,
  options: SuggestionOptions,
  promotionKeywords: string[]
): number {
  let score = 0;

  const season = options.season ?? getCurrentSeason();
  const recipeSeasoned = recipe.tags.some(t => SEASON_TAGS.has(t) && t !== 'Ganzjährig');
  // No season tags or 'Ganzjährig' = always in season; specific season tags → only current season
  if (!recipeSeasoned || recipe.tags.includes('Ganzjährig') || recipe.tags.includes(season)) score += 10;

  if (options.weatherType && recipe.weatherType === options.weatherType) score += 15;
  else if (options.weatherType && recipe.weatherType === 'neutral') score += 5;

  if (options.constraint?.constraint === 'maxTime' && options.constraint.maxTimeMinutes) {
    if (recipe.timeMinutes <= options.constraint.maxTimeMinutes) score += 8;
    else score -= 20;
  }

  if (options.constraint?.constraint === 'mealprep' && recipe.tags.includes('Mealprep-geeignet')) score += 12;

  if (options.lunchOnly && !recipe.tags.includes('Mittagessen')) score -= 50;

  if (promotionKeywords.some((kw) => recipe.name.toLowerCase().includes(kw) ||
    recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(kw)))) {
    score += 20;
  }

  if (options.usedThisWeek?.includes(recipe.id)) score -= 30;

  // Kohlenhydrat-Abwechslung: -40 wenn derselbe KH-Typ bereits 2x in der Woche
  const ct = getCarbType(recipe);
  if (ct && (options.carbCounts?.[ct] ?? 0) >= 2) score -= 40;

  // Vorrat-Bonus: +15 wenn Rezept eine "Reste verwerten"-Zutat enthält
  if (options.pantryIngredients?.length) {
    const ingNames = recipe.ingredients.map(i => i.name.toLowerCase());
    const hit = options.pantryIngredients.some(pi =>
      ingNames.some(n => n.includes(pi.toLowerCase()) || pi.toLowerCase().includes(n))
    );
    if (hit) score += 15;
  }

  score += Math.random() * 5;

  return score;
}

// weekStartDay: 0=So, 1=Mo, ..., 6=Sa (AppSettings.weekSwitchDay)
// col: 1=first displayed column ... 7=last; isoDay: 1=Mo ... 7=So
export function colToIso(col: number, weekStartDay: number): number {
  const isoStart = weekStartDay === 0 ? 7 : weekStartDay;
  return ((isoStart + col - 2) % 7) + 1;
}

export function isoToCol(isoDay: number, weekStartDay: number): number {
  const isoStart = weekStartDay === 0 ? 7 : weekStartDay;
  return ((isoDay - isoStart + 7) % 7) + 1;
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
  const c = options.constraint;
  const available = recipes.filter((r) => {
    if (r.suggestionEnabled === false) return false;
    if (options.excludeIds?.includes(r.id)) return false;
    if (c?.constraint === 'leftovers') return false;
    // Hard-Filter: maxTime → nur Gerichte innerhalb des Zeitlimits
    if (c?.constraint === 'maxTime' && c.maxTimeMinutes && r.timeMinutes > c.maxTimeMinutes) return false;
    // Hard-Filter: mealprep → nur mealprep-geeignete Gerichte
    if (c?.constraint === 'mealprep' && !r.tags.includes('Mealprep-geeignet')) return false;
    if (options.lunchOnly && !r.tags.includes('Mittagessen')) return false;
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

// ── Wochen-Vorschlag ──────────────────────────────────────────────────────────

export interface SuggestWeekOptions {
  showBreakfast?: boolean;
  showLunch?: boolean;
  showDinner?: boolean;
  allergiesAndAversions?: string[];
  flexitarisch?: boolean;       // max 1 Fleischgericht pro Wochenplan
  favorites?: string[];         // recipe IDs — wenn ≥3, mind. 1 Dinner/Woche aus Favoriten
  favoritesOnly?: boolean;      // NEU: gesamter Pool auf Favoriten einschränken
  pantryIngredients?: string[]; // NEU: für Vorrat-Bonus in der Wochen-Suggestion
  promotions?: Promotion[];     // Aktions-Promotionen → +20 Bonus im Scoring
  weekStartDay?: number;        // 0=So, 1=Mo (default), ..., 6=Sa
}

const BREAKFAST_CATS  = new Set<Category>();
const EXCLUDED_CATS   = new Set<Category>(['Snacks & Vorspeisen', 'Desserts & Süsses']);

function isMeatRecipe(r: Recipe): boolean {
  return getEffectiveDietCategory(r) === 'meat';
}

/** Ein vorgeschlagener Slot: Rezept-ID oder Reste-Markierung (recipeId null + isLeftovers). */
export interface SuggestedSlot {
  recipeId: string | null;
  isLeftovers?: boolean;
}

export function suggestWeek(
  recipes: Recipe[],
  constraints: DayConstraint[],
  weatherTypes: Record<number, WeatherType>,
  season: string,
  opts: SuggestWeekOptions = {}
): Record<number, { breakfast?: SuggestedSlot; lunch?: SuggestedSlot; dinner?: SuggestedSlot }> {
  const { showBreakfast = false, showLunch = false, showDinner = true, allergiesAndAversions, flexitarisch = false, favorites = [], favoritesOnly = false, pantryIngredients, promotions } = opts;
  const wsd = opts.weekStartDay ?? 1;
  const result: Record<number, { breakfast?: SuggestedSlot; lunch?: SuggestedSlot; dinner?: SuggestedSlot }> = {};
  const usedIds: string[] = [];
  let meatMealsThisWeek = 0;
  const carbCounts: Record<string, number> = {};

  // Breakfast: tagged 'Frühstück' (Mahlzeit-Tag)
  let breakfastRecipes = recipes.filter(
    r => BREAKFAST_CATS.has(r.category) || r.tags.includes('Frühstück')
  );
  // Lunch: tagged 'Mittagessen', not breakfast
  let lunchRecipes = recipes.filter(
    r => r.tags.includes('Mittagessen') &&
         !BREAKFAST_CATS.has(r.category) &&
         !r.tags.includes('Frühstück')
  );
  // Dinner: not breakfast, not snacks/desserts; exclude lunch-only
  let dinnerRecipes = recipes.filter(
    r => !BREAKFAST_CATS.has(r.category) &&
         !r.tags.includes('Frühstück') &&
         !EXCLUDED_CATS.has(r.category) &&
         (!r.tags.includes('Mittagessen') || r.tags.includes('Abendessen'))
  );

  // favoritesOnly: gesamten Pool auf Favoriten einschränken
  const favSet = new Set(favorites);
  if (favoritesOnly && favSet.size > 0) {
    breakfastRecipes = breakfastRecipes.filter(r => favSet.has(r.id));
    lunchRecipes     = lunchRecipes.filter(r => favSet.has(r.id));
    dinnerRecipes    = dinnerRecipes.filter(r => favSet.has(r.id));
  }

  // Mealprep → "Reste essen" auf den Folgetagen reservieren.
  // Bevorzugtes Reste-Meal: Mittag (wenn angezeigt), sonst Abendessen.
  const leftoversMeal: 'lunch' | 'dinner' = showLunch ? 'lunch' : 'dinner';
  const reservedLeftovers = new Map<number, number>(); // Zielspalte → Quellspalte
  for (const c of constraints) {
    if (c.constraint !== 'mealprep') continue;
    const sourceCol = isoToCol(c.dayOfWeek, wsd);
    const rawTargets = (c.mealprepLunchDays && c.mealprepLunchDays.length > 0)
      ? c.mealprepLunchDays
      : [c.dayOfWeek + 1, c.dayOfWeek + 2];
    for (const isoTd of rawTargets) {
      const col = isoToCol(isoTd, wsd);
      if (col !== sourceCol && !reservedLeftovers.has(col)) {
        reservedLeftovers.set(col, sourceCol);
      }
    }
  }

  // Favoriten-Tag: wenn ≥3 definiert, einen zufälligen Dinner-Tag reservieren.
  // Leftovers-/Reste-Dinner-Tage ausschliessen, damit die Garantie erfüllbar bleibt.
  const favDinnerPool = dinnerRecipes.filter(r => favSet.has(r.id));
  const eligibleDays  = [1, 2, 3, 4, 5, 6, 7].filter(d =>
    !constraints.some(c => c.dayOfWeek === colToIso(d, wsd) && c.mealType === 'dinner' && c.constraint === 'leftovers') &&
    !(leftoversMeal === 'dinner' && reservedLeftovers.has(d))
  );
  const favoriteDayIndex = favDinnerPool.length >= 3 && eligibleDays.length > 0
    ? eligibleDays[Math.floor(Math.random() * eligibleDays.length)]
    : null;

  for (let day = 1; day <= 7; day++) {
    const isoDay = colToIso(day, wsd);
    const dayConstraints  = constraints.filter((c) => c.dayOfWeek === isoDay);
    const dinnerConstraint = dayConstraints.find((c) => c.mealType === 'dinner');
    const lunchConstraint  = dayConstraints.find((c) => c.mealType === 'lunch');
    const weatherType = weatherTypes[isoDay] ?? 'neutral';

    result[day] = {};

    // ── Abendessen ──
    if (showDinner) {
      if (dinnerConstraint?.constraint === 'leftovers') {
        result[day].dinner = { recipeId: null, isLeftovers: true };
      } else if (leftoversMeal === 'dinner' && reservedLeftovers.has(day)) {
        const src = reservedLeftovers.get(day)!;
        if (result[src]?.dinner?.recipeId) result[day].dinner = { recipeId: null, isLeftovers: true };
      } else {
        const basePool = flexitarisch && meatMealsThisWeek >= 1
          ? dinnerRecipes.filter(r => !isMeatRecipe(r))
          : dinnerRecipes;
        const isFavDay = favoriteDayIndex === day && favDinnerPool.length > 0;
        const favFiltered = isFavDay ? favDinnerPool.filter(r => basePool.some(b => b.id === r.id)) : [];
        const dinnerPool = favFiltered.length > 0 ? favFiltered : basePool;
        const sharedOpts = { weatherType, season, usedThisWeek: usedIds, allergiesAndAversions, carbCounts, pantryIngredients, promotions };
        let dinner = suggestRecipe(dinnerPool, { ...sharedOpts, constraint: dinnerConstraint });
        // Fallback 1: ignore maxTime/mealprep constraint
        if (!dinner) dinner = suggestRecipe(dinnerPool, sharedOpts);
        // Fallback 2: also ignore flexitarisch restriction
        if (!dinner) dinner = suggestRecipe(dinnerRecipes, sharedOpts);
        if (dinner) {
          result[day].dinner = { recipeId: dinner.id };
          usedIds.push(dinner.id);
          if (isMeatRecipe(dinner)) meatMealsThisWeek++;
          // KH-Tracking für Abwechslungs-Scoring
          const ct = getCarbType(dinner);
          if (ct) carbCounts[ct] = (carbCounts[ct] ?? 0) + 1;
        }
      }
    }

    // ── Mittagessen ──
    if (showLunch) {
      if (lunchConstraint?.constraint === 'leftovers') {
        result[day].lunch = { recipeId: null, isLeftovers: true };
      } else if (leftoversMeal === 'lunch' && reservedLeftovers.has(day)) {
        const src = reservedLeftovers.get(day)!;
        if (result[src]?.dinner?.recipeId) result[day].lunch = { recipeId: null, isLeftovers: true };
      } else {
        const lunchOpts = { weatherType, season, usedThisWeek: usedIds, lunchOnly: true as const, allergiesAndAversions, carbCounts, pantryIngredients, promotions };
        let lunch = suggestRecipe(lunchRecipes, { ...lunchOpts, constraint: lunchConstraint });
        // Fallback: ignore constraint
        if (!lunch) lunch = suggestRecipe(lunchRecipes, lunchOpts);
        if (lunch) {
          result[day].lunch = { recipeId: lunch.id };
          usedIds.push(lunch.id);
          const ct = getCarbType(lunch);
          if (ct) carbCounts[ct] = (carbCounts[ct] ?? 0) + 1;
        }
      }
    }

    // ── Frühstück ──
    if (showBreakfast) {
      const breakfast = suggestRecipe(breakfastRecipes, {
        season, usedThisWeek: usedIds, allergiesAndAversions, promotions,
      });
      if (breakfast) {
        result[day].breakfast = { recipeId: breakfast.id };
      }
    }
  }

  return result;
}
