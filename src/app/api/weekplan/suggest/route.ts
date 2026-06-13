export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getRecipes, getConstraints, getWeatherCache, getWeekPlan, saveWeekPlan, getSettings, getFavorites, getPromotions } from '@/lib/data';
import { suggestWeek, suggestRecipe, getEffectiveDietCategory } from '@/lib/suggestions';
import { getCurrentSeason, getWeatherTypeFromTemp } from '@/lib/utils';
import type { WeatherType, Promotion } from '@/types';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });
    const groupId = session.groupId;

    const { getAccessState } = await import('@/lib/users');
    const access = await getAccessState(session.email);
    if (access.locked) {
      return NextResponse.json({ error: 'Diese Funktion erfordert ein aktives Abo.' }, { status: 403 });
    }

    const { weekId, dayIndex, mealType, favoritesOnly } = await request.json();

    const { getPantry } = await import('@/lib/data');
    const [allRecipes, constraints, weatherCache, settings, favorites, pantry, promoData] = await Promise.all([
      getRecipes(groupId),
      getConstraints(groupId),
      getWeatherCache(),
      getSettings(groupId),
      getFavorites(groupId),
      getPantry(groupId),
      getPromotions(),
    ]);

    const wantToUse = pantry.filter(p => p.wantToUse).map(p => p.name);

    // Promotions: flatten only enabled stores
    const enabledStores = settings.promotions?.enabledStores ?? ['migros', 'coop', 'lidl'];
    const activePromotions = enabledStores.flatMap(
      (s) => (promoData[s as keyof typeof promoData] as Promotion[] | undefined) ?? [],
    );

    // Archivierte Rezepte nie vorschlagen; Diät-Filter anwenden
    const dietPref = settings.dietPreference;

    // dietCategory-basierter Diät-Filter (korrekt auch für Fleisch in Pasta-Kategorie etc.)
    // fleischhaltig/flexitarisch: kein Filter (flexitarisch-Logik in suggestWeek)
    // pescetarisch: kein Fleisch
    // vegetarisch:  kein Fleisch, kein Fisch
    // vegan:        nur Vegan
    const recipes = allRecipes.filter((r) => {
      if (r.archived) return false;
      const diet = getEffectiveDietCategory(r);
      if (dietPref === 'pescetarisch' && diet === 'meat') return false;
      if (dietPref === 'vegetarisch'  && (diet === 'meat' || diet === 'fish')) return false;
      if (dietPref === 'vegan'        && diet !== 'vegan') return false;
      return true;
    });

    const season = getCurrentSeason();
    const weatherTypes: Record<number, WeatherType> = {};
    weatherCache.days.forEach((d) => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
      weatherTypes[dayOfWeek] = d.weatherType;
    });

    if (dayIndex !== undefined && mealType) {
      const currentPlan = await getWeekPlan(weekId, groupId);
      const disabledIds = currentPlan?.disabledConstraintIds ?? [];
      const constraint = constraints.find(
        (c) => c.dayOfWeek === dayIndex && c.mealType === mealType && !disabledIds.includes(c.id)
      );
      const weatherType = weatherTypes[dayIndex] ?? 'neutral';
      const usedIds = Object.values(currentPlan?.days ?? {}).flatMap((d) =>
        [d.dinner?.recipeId, d.lunch?.recipeId].filter(Boolean) as string[]
      );

      // Filter recipes by meal slot
      const mealFiltered =
        mealType === 'breakfast'
          ? recipes.filter((r) => r.tags.includes('Frühstücksgericht'))
          : mealType === 'lunch'
            ? recipes.filter((r) => r.tags.includes('Mittagsgericht'))
            : recipes.filter((r) =>
                !r.tags.includes('Frühstücksgericht') &&
                r.category !== 'Desserts & Süsses' &&
                r.category !== 'Snacks & Vorspeisen'
              );

      // Favoriten-Filter: wenn favoritesOnly aktiv, nur Favoriten vorschlagen
      // Fallback auf ungefilterten Pool wenn keine Favoriten in dieser Kategorie vorhanden
      const pool = favoritesOnly && favorites.length > 0
        ? mealFiltered.filter((r) => favorites.includes(r.id))
        : mealFiltered;

      const suggestion = suggestRecipe(pool.length > 0 ? pool : mealFiltered, {
        weatherType,
        season,
        constraint,
        usedThisWeek: usedIds,
        lunchOnly: mealType === 'lunch',
        allergiesAndAversions: settings.allergiesAndAversions,
        pantryIngredients: wantToUse,
        promotions: activePromotions,
      });

      return NextResponse.json({ recipeId: suggestion?.id ?? null, recipe: suggestion });
    }

    let plan = await getWeekPlan(weekId, groupId);
    // Fix #12: derive startDate from weekId (format "YYYY-Www") to avoid empty string.
    if (!plan) {
      const [year, week] = weekId.split('-W').map(Number);
      const jan4 = new Date(year, 0, 4); // ISO week 1 always contains Jan 4
      const startMs = jan4.getTime() - (((jan4.getDay() + 6) % 7) - (week - 1) * 7) * 86400000;
      const startDate = new Date(startMs).toISOString().slice(0, 10);
      plan = { weekId, startDate, days: {} };
    }

    // Für diese Woche deaktivierte (durchgestrichene) Constraints ignorieren
    const disabledIds = plan.disabledConstraintIds ?? [];
    const activeConstraints = constraints.filter((c) => !disabledIds.includes(c.id));

    const suggestions = suggestWeek(recipes, activeConstraints, weatherTypes, season, {
      showBreakfast:         settings.showBreakfast        ?? false,
      showLunch:             settings.showLunch             ?? false,
      showDinner:            settings.showDinner            ?? true,
      allergiesAndAversions: settings.allergiesAndAversions,
      flexitarisch:          dietPref === 'flexitarisch',
      favorites,
      favoritesOnly:         !!favoritesOnly,
      pantryIngredients:     wantToUse,
      promotions:            activePromotions,
    });

    for (const [dayStr, meals] of Object.entries(suggestions)) {
      const day = parseInt(dayStr);
      if (!plan.days[day]) {
        plan.days[day] = { dinner: { recipeId: null }, showLunch: false };
      }
      if (meals.dinner)    plan.days[day].dinner    = { recipeId: meals.dinner.recipeId, isLeftovers: meals.dinner.isLeftovers ?? false };
      if (meals.lunch)     plan.days[day].lunch     = { recipeId: meals.lunch.recipeId, isLeftovers: meals.lunch.isLeftovers ?? false };
      if (meals.breakfast) plan.days[day].breakfast = { recipeId: meals.breakfast.recipeId };
    }

    await saveWeekPlan(plan, groupId);
    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Fehler bei Vorschlag' }, { status: 500 });
  }
}
