export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getWeekPlan, getRecipes, getSettings, getPromotions, getShoppingGroups } from '@/lib/data';
import { calculatePortions, scaleIngredientAmount, categorizeIngredient } from '@/lib/utils';
import type { ShoppingItem, ShoppingList, Promotion } from '@/types';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    // Optionaler dayIndices-Filter für Mehrfach-Listen (Phase 4)
    const dayIndicesParam = searchParams.get('dayIndices');
    const dayIndicesFilter: number[] | null = dayIndicesParam
      ? dayIndicesParam.split(',').map(Number).filter(n => n >= 1 && n <= 7)
      : null;

    // Optionaler groups-Modus: gibt Gruppen-Metadaten zurück statt Liste
    const groupsMeta = searchParams.get('meta') === '1';

    const [plan, recipes, settings, promoData, shoppingGroups] = await Promise.all([
      getWeekPlan(weekId, session.groupId),
      getRecipes(session.groupId),
      getSettings(session.groupId),
      getPromotions(),
      getShoppingGroups(weekId, session.groupId),
    ]);

    if (groupsMeta) {
      return NextResponse.json({ groups: shoppingGroups, weekId });
    }

    if (!plan) return NextResponse.json({});

    const portionInfo = calculatePortions(settings.household);
    const allPromotions: Promotion[] = [
      ...promoData.migros,
      ...promoData.coop,
      ...promoData.lidl,
    ];

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const aggregated: Record<string, ShoppingItem> = {};

    const showBreakfast = settings.showBreakfast ?? false;
    const showLunch     = settings.showLunch     ?? false;
    const showDinner    = settings.showDinner    ?? true;

    // Zutaten eines Rezept-Slots aggregieren
    const addSlotIngredients = (slotArg: typeof plan.days[number]['dinner'] | undefined, recipeIdArg: string | null | undefined) => {
      if (!recipeIdArg) return;
      const recipe = recipeMap.get(recipeIdArg);
      if (!recipe) return;
      const targetPortions = slotArg?.portionOverride ?? portionInfo.totalPortions;
      for (const ing of recipe.ingredients) {
        const scaled = scaleIngredientAmount(ing.amount, recipe.basePortions, targetPortions);
        const key = `${ing.name.toLowerCase()}_${ing.unit}`;
        const category = categorizeIngredient(ing.name);
        const relatedPromos = allPromotions.filter((p) =>
          p.product.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0])
        );
        if (aggregated[key]) {
          aggregated[key].totalAmount += scaled;
          if (!aggregated[key].recipeNames.includes(recipe.name)) aggregated[key].recipeNames.push(recipe.name);
          relatedPromos.forEach((p) => {
            if (!aggregated[key].promotions.find((ep) => ep.product === p.product)) aggregated[key].promotions.push(p);
          });
        } else {
          aggregated[key] = { name: ing.name, totalAmount: scaled, unit: ing.unit, category, recipeNames: [recipe.name], promotions: relatedPromos, checked: false };
        }
      }
    };

    for (const [dayStr, dayPlan] of Object.entries(plan.days)) {
      const dayIndex = parseInt(dayStr);
      // Tages-Filter für Mehrfach-Listen
      if (dayIndicesFilter && !dayIndicesFilter.includes(dayIndex)) continue;

      if (showDinner && dayPlan.dinner) {
        addSlotIngredients(dayPlan.dinner, dayPlan.dinner.recipeId);
        addSlotIngredients(dayPlan.dinner, dayPlan.dinner.sideRecipeId);
      }
      if (showLunch && dayPlan.lunch) {
        addSlotIngredients(dayPlan.lunch, dayPlan.lunch.recipeId);
        addSlotIngredients(dayPlan.lunch, dayPlan.lunch.sideRecipeId);
      }
      if (showBreakfast && dayPlan.breakfast) {
        addSlotIngredients(dayPlan.breakfast, dayPlan.breakfast.recipeId);
        addSlotIngredients(dayPlan.breakfast, dayPlan.breakfast.sideRecipeId);
      }
    }

    const grouped: ShoppingList = {};
    for (const item of Object.values(aggregated)) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json(grouped);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
