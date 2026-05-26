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
    const allowedDiets: DietType[] | null =
      !dietPref || dietPref === 'alle' ? null :
      dietPref === 'vegan'        ? ['vegan'] :
      dietPref === 'vegetarisch'  ? ['vegan', 'vegetarisch'] :
      dietPref === 'pescetarisch' ? ['vegan', 'vegetarisch', 'pescetarisch'] :
      null;

    const recipes = allRecipes.filter((r) => {
      if (r.archived) return false;
      if (allowedDiets && r.dietType && !allowedDiets.includes(r.dietType)) return false;
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

      const suggestion = suggestRecipe(recipes, {
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
    });

    let plan = await getWeekPlan(weekId, groupId);
    if (!plan) plan = { weekId, startDate: '', days: {} };

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
