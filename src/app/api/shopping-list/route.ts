export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getWeekPlan, getRecipes, getSettings, getPromotions, getShoppingGroups, getPantry } from '@/lib/data';
import { calculatePortions, scaleIngredientAmount, categorizeIngredient } from '@/lib/utils';
import { normalizeUnit } from '@/lib/unitConversion';
import { ingredientMatchesPromotion } from '@/lib/promotionUtils';
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

    const [plan, recipes, settings, promoData, shoppingGroups, pantry] = await Promise.all([
      getWeekPlan(weekId, session.groupId),
      getRecipes(session.groupId),
      getSettings(session.groupId),
      getPromotions(),
      getShoppingGroups(weekId, session.groupId),
      getPantry(session.groupId),
    ]);

    if (groupsMeta) {
      return NextResponse.json({ groups: shoppingGroups, weekId });
    }

    if (!plan) return NextResponse.json({});

    const portionInfo = calculatePortions(settings.household);
    // Include only promotions from the group's enabled stores
    const enabledStores = settings.promotions?.enabledStores ?? ['migros', 'coop', 'lidl'];
    const allPromotions: Promotion[] = enabledStores.flatMap(
      (s) => (promoData[s as keyof typeof promoData] as Promotion[] | undefined) ?? [],
    );

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const aggregated: Record<string, ShoppingItem> = {};

    const showBreakfast = settings.showBreakfast ?? false;
    const showLunch     = settings.showLunch     ?? false;
    const showDinner    = settings.showDinner    ?? true;

    // Zutaten eines Rezept-Slots aggregieren
    // portionOverrideArg: expliziter Override (z.B. sidePortionOverride für Beilagen-Gästeanzahl)
    const addSlotIngredients = (slotArg: typeof plan.days[number]['dinner'] | undefined, recipeIdArg: string | null | undefined, portionOverrideArg?: number) => {
      if (!recipeIdArg) return;
      const recipe = recipeMap.get(recipeIdArg);
      if (!recipe) return;
      const targetPortions = portionOverrideArg ?? slotArg?.portionOverride ?? portionInfo.totalPortions;
      for (const ing of recipe.ingredients) {
        const scaled = scaleIngredientAmount(ing.amount, recipe.basePortions, targetPortions);
        // Einheiten-Normalisierung: EL/TL → g oder ml (für Cross-Unit-Aggregation)
        const { amount: normAmt, unit: normUnit, approx } = normalizeUnit(ing.name, scaled, ing.unit);
        const key = `${ing.name.toLowerCase()}_${normUnit}`;
        const category = categorizeIngredient(ing.name);
        const relatedPromos = allPromotions.filter((p) =>
          ingredientMatchesPromotion(ing.name, p.product)
        );
        if (aggregated[key]) {
          aggregated[key].totalAmount += normAmt;
          if (approx || aggregated[key].approx) aggregated[key].approx = true;
          if (!aggregated[key].recipeNames.includes(recipe.name)) aggregated[key].recipeNames.push(recipe.name);
          relatedPromos.forEach((p) => {
            if (!aggregated[key].promotions.find((ep) => ep.product === p.product)) aggregated[key].promotions.push(p);
          });
        } else {
          aggregated[key] = { name: ing.name, totalAmount: normAmt, unit: normUnit, category, recipeNames: [recipe.name], promotions: relatedPromos, checked: false, ...(approx && { approx: true }) };
        }
      }
    };

    // Manuelle Beilage-Zutaten (sideIngredients) aggregieren — Menge 1:1, kein Skalieren
    const addSideIngredients = (slot: typeof plan.days[number]['dinner'] | undefined) => {
      if (!slot?.sideIngredients?.length) return;
      for (const ing of slot.sideIngredients) {
        const key = `${ing.name.toLowerCase()}_${ing.unit}`;
        const category = categorizeIngredient(ing.name);
        if (aggregated[key]) {
          aggregated[key].totalAmount += ing.amount;
          if (!aggregated[key].recipeNames.includes('Beilage')) aggregated[key].recipeNames.push('Beilage');
        } else {
          aggregated[key] = { name: ing.name, totalAmount: ing.amount, unit: ing.unit, category, recipeNames: ['Beilage'], promotions: [], checked: false };
        }
      }
    };

    for (const [dayStr, dayPlan] of Object.entries(plan.days)) {
      const dayIndex = parseInt(dayStr);
      // Tages-Filter für Mehrfach-Listen
      if (dayIndicesFilter && !dayIndicesFilter.includes(dayIndex)) continue;

      if (showDinner && dayPlan.dinner) {
        addSlotIngredients(dayPlan.dinner, dayPlan.dinner.recipeId);
        addSlotIngredients(dayPlan.dinner, dayPlan.dinner.sideRecipeId, dayPlan.dinner.sidePortionOverride);
        addSideIngredients(dayPlan.dinner);
      }
      if (showLunch && dayPlan.lunch) {
        addSlotIngredients(dayPlan.lunch, dayPlan.lunch.recipeId);
        addSlotIngredients(dayPlan.lunch, dayPlan.lunch.sideRecipeId, dayPlan.lunch.sidePortionOverride);
        addSideIngredients(dayPlan.lunch);
      }
      if (showBreakfast && dayPlan.breakfast) {
        addSlotIngredients(dayPlan.breakfast, dayPlan.breakfast.recipeId);
        addSlotIngredients(dayPlan.breakfast, dayPlan.breakfast.sideRecipeId, dayPlan.breakfast.sidePortionOverride);
        addSideIngredients(dayPlan.breakfast);
      }
    }

    // Pantry-Abgleich: Zutaten die im Vorrat vorhanden sind markieren
    const pantryNames = new Set(pantry.map((p) => p.name.toLowerCase().trim()));
    for (const item of Object.values(aggregated)) {
      if (pantryNames.has(item.name.toLowerCase().trim())) item.inPantry = true;
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
