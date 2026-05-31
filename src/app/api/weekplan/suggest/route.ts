export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getRecipes, getConstraints, getWeatherCache, getWeekPlan, saveWeekPlan, getSettings } from '@/lib/data';
import { suggestWeek, suggestRecipe } from '@/lib/suggestions';
import { getCurrentSeason, getWeatherTypeFromTemp } from '@/lib/utils';
import type { WeatherType, DayPlan, DietType } from '@/types';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });
    const groupId = session.groupId;

    const { weekId, dayIndex, mealType } = await request.json();

    const [allRecipes, constraints, weatherCache, settings] = await Promise.all([
      getRecipes(groupId),
      getConstraints(groupId),
      getWeatherCache(),
      getSettings(groupId),
    ]);

    // Archivierte Rezepte nie vorschlagen; Diät-Filter anwenden
    const dietPref = settings.dietPreference;

    // dietCategory-basierter Filter (neues Feld ab Phase 1)
    // fleischhaltig: alle Rezepte zeigen (kein Filter)
    // flexitarisch:  alle zeigen, aber beim Wochenplan max. 1 Fleischgericht
    // pescetarisch:  kein meat
    // vegetarisch:   kein meat, kein fish
    // vegan:         nur vegan
    const blockedCategories: string[] = [];
    if (dietPref === 'vegetarisch')  blockedCategories.push('meat', 'fish');
    if (dietPref === 'pescetarisch') blockedCategories.push('meat');
    if (dietPref === 'vegan')        blockedCategories.push('meat', 'fish', 'vegetarian');

    // Legacy dietType-Filter (Rückwärtskompatibilität für Rezepte ohne dietCategory)
    const allowedDiets: DietType[] | null =
      !dietPref || dietPref === 'alle' || dietPref === 'fleischhaltig' || dietPref === 'flexitarisch' ? null :
      dietPref === 'vegan'        ? ['vegan'] :
      dietPref === 'vegetarisch'  ? ['vegan', 'vegetarisch'] :
      dietPref === 'pescetarisch' ? ['vegan', 'vegetarisch', 'pescetarisch'] :
      null;

    const recipes = allRecipes.filter((r) => {
      if (r.archived) return false;
      // Neues dietCategory-Feld hat Vorrang
      if (r.dietCategory && blockedCategories.includes(r.dietCategory)) return false;
      // Legacy dietType-Fallback für Rezepte ohne dietCategory
      if (!r.dietCategory && allowedDiets && r.dietType && !allowedDiets.includes(r.dietType)) return false;
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
      const constraint = constraints.find((c) => c.dayOfWeek === dayIndex);
      const weatherType = weatherTypes[dayIndex] ?? 'neutral';
      const currentPlan = await getWeekPlan(weekId, groupId);
      const usedIds = Object.values(currentPlan?.days ?? {}).flatMap((d) =>
        [d.dinner?.recipeId, d.lunch?.recipeId].filter(Boolean) as string[]
      );

      // Fix #5: Filter recipes by meal slot so Frühstück / Süsses stay out of dinner.
      const mealFiltered =
        mealType === 'breakfast'
          ? recipes.filter((r) => r.category === 'Frühstück' || r.isSuitableForLunch)
          : mealType === 'lunch'
            ? recipes.filter((r) => r.isSuitableForLunch && r.category !== 'Frühstück')
            : recipes.filter((r) => r.category !== 'Frühstück' && r.category !== 'Süsses');

      const suggestion = suggestRecipe(mealFiltered, {
        weatherType,
        season,
        constraint,
        usedThisWeek: usedIds,
        lunchOnly: mealType === 'lunch',
        allergiesAndAversions: settings.allergiesAndAversions,
      });

      return NextResponse.json({ recipeId: suggestion?.id ?? null, recipe: suggestion });
    }

    const suggestions = suggestWeek(recipes, constraints, weatherTypes, season, {
      showBreakfast:         settings.showBreakfast        ?? false,
      showLunch:             settings.showLunch             ?? false,
      showDinner:            settings.showDinner            ?? true,
      allergiesAndAversions: settings.allergiesAndAversions,
      flexitarisch:          dietPref === 'flexitarisch',
    });

    let plan = await getWeekPlan(weekId, groupId);
    // Fix #12: derive startDate from weekId (format "YYYY-Www") to avoid empty string.
    if (!plan) {
      const [year, week] = weekId.split('-W').map(Number);
      const jan4 = new Date(year, 0, 4); // ISO week 1 always contains Jan 4
      const startMs = jan4.getTime() - (((jan4.getDay() + 6) % 7) - (week - 1) * 7) * 86400000;
      const startDate = new Date(startMs).toISOString().slice(0, 10);
      plan = { weekId, startDate, days: {} };
    }

    for (const [dayStr, meals] of Object.entries(suggestions)) {
      const day = parseInt(dayStr);
      if (!plan.days[day]) {
        plan.days[day] = { dinner: { recipeId: null }, showLunch: false };
      }
      if (meals.dinner)    plan.days[day].dinner    = { recipeId: meals.dinner };
      if (meals.lunch)     plan.days[day].lunch     = { recipeId: meals.lunch };
      if (meals.breakfast) plan.days[day].breakfast = { recipeId: meals.breakfast };
    }

    await saveWeekPlan(plan, groupId);
    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Fehler bei Vorschlag' }, { status: 500 });
  }
}
