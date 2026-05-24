export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRecipes, getConstraints, getWeatherCache, getWeekPlan, saveWeekPlan, getSettings } from '@/lib/data';
import { suggestWeek, suggestRecipe } from '@/lib/suggestions';
import { getCurrentSeason, getWeatherTypeFromTemp } from '@/lib/utils';
import type { WeatherType, DayPlan, DietType } from '@/types';

export async function POST(request: Request) {
  try {
    const { weekId, dayIndex, mealType } = await request.json();

    const [allRecipes, constraints, weatherCache, settings] = await Promise.all([
      getRecipes(),
      getConstraints(),
      getWeatherCache(),
      getSettings(),
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
      const currentPlan = await getWeekPlan(weekId);
      const usedIds = Object.values(currentPlan?.days ?? {}).flatMap((d) =>
        [d.dinner?.recipeId, d.lunch?.recipeId].filter(Boolean) as string[]
      );

      const suggestion = suggestRecipe(recipes, {
        weatherType,
        season,
        constraint,
        usedThisWeek: usedIds,
        lunchOnly: mealType === 'lunch',
      });

      return NextResponse.json({ recipeId: suggestion?.id ?? null, recipe: suggestion });
    }

    const suggestions = suggestWeek(recipes, constraints, weatherTypes, season);

    let plan = await getWeekPlan(weekId);
    if (!plan) plan = { weekId, startDate: '', days: {} };

    for (const [dayStr, meals] of Object.entries(suggestions)) {
      const day = parseInt(dayStr);
      if (!plan.days[day]) {
        plan.days[day] = { dinner: { recipeId: null }, showLunch: false };
      }
      if (meals.dinner) plan.days[day].dinner = { recipeId: meals.dinner };
      if (meals.lunch)  plan.days[day].lunch  = { recipeId: meals.lunch };
    }

    await saveWeekPlan(plan);
    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Fehler bei Vorschlag' }, { status: 500 });
  }
}
