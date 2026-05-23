import { NextResponse } from 'next/server';
import { getWeekPlan, getRecipes, getSettings, getPromotions } from '@/lib/data';
import { calculatePortions, scaleIngredientAmount, categorizeIngredient } from '@/lib/utils';
import type { ShoppingItem, ShoppingList, Promotion } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    const [plan, recipes, settings, promoData] = await Promise.all([
      getWeekPlan(weekId),
      getRecipes(),
      getSettings(),
      getPromotions(),
    ]);

    if (!plan) return NextResponse.json({});

    const portionInfo = calculatePortions(settings.household);
    const allPromotions: Promotion[] = [
      ...promoData.migros,
      ...promoData.coop,
      ...promoData.lidl,
    ];

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const aggregated: Record<string, ShoppingItem> = {};

    for (const [, dayPlan] of Object.entries(plan.days)) {
      const slots = [dayPlan.dinner];
      if (dayPlan.showLunch && dayPlan.lunch) slots.push(dayPlan.lunch);

      for (const slot of slots) {
        if (!slot?.recipeId) continue;
        const recipe = recipeMap.get(slot.recipeId);
        if (!recipe) continue;

        const targetPortions = slot.portionOverride ?? portionInfo.totalPortions;

        for (const ing of recipe.ingredients) {
          const scaled = scaleIngredientAmount(ing.amount, recipe.basePortions, targetPortions);
          const key = `${ing.name.toLowerCase()}_${ing.unit}`;
          const category = categorizeIngredient(ing.name);
          const relatedPromos = allPromotions.filter((p) =>
            p.product.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0])
          );

          if (aggregated[key]) {
            aggregated[key].totalAmount += scaled;
            if (!aggregated[key].recipeNames.includes(recipe.name)) {
              aggregated[key].recipeNames.push(recipe.name);
            }
            relatedPromos.forEach((p) => {
              if (!aggregated[key].promotions.find((ep) => ep.product === p.product)) {
                aggregated[key].promotions.push(p);
              }
            });
          } else {
            aggregated[key] = {
              name: ing.name, totalAmount: scaled, unit: ing.unit,
              category, recipeNames: [recipe.name], promotions: relatedPromos, checked: false,
            };
          }
        }
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
