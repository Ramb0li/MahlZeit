import { describe, it, expect } from 'vitest';
import { suggestWeek, suggestRecipe } from '../suggestions';
import type { Recipe, DayConstraint } from '@/types';

function makeRecipe(overrides: Partial<Recipe> & { id: string; name: string }): Recipe {
  return {
    category: 'Gemüsegerichte',
    timeMinutes: 30,
    tags: [],
    ingredients: [],
    weatherType: 'neutral',
    source: 'Test',
    basePortions: 4,
    description: '',
    dietCategory: 'vegetarian',
    ...overrides,
  };
}

const BASE_RECIPES: Recipe[] = Array.from({ length: 14 }, (_, i) =>
  makeRecipe({ id: `r${i}`, name: `Rezept ${i}` })
);

describe('suggestWeek — fallback tiers', () => {
  it('fills all 7 dinner slots when recipes are available', () => {
    const result = suggestWeek(BASE_RECIPES, [], {}, 'Sommer', { showDinner: true });
    const filled = Object.values(result).filter(d => d.dinner?.recipeId).length;
    expect(filled).toBe(7);
  });

  it('fills slot via fallback when mealprep constraint leaves empty pool', () => {
    const mealprep: DayConstraint = {
      id: 'c1', dayOfWeek: 1, mealType: 'dinner', constraint: 'mealprep', label: 'Mealprep', color: '#000',
    };
    // None of the recipes have Mealprep-geeignet tag — Tier 1 returns null, Tier 2 should fill
    const result = suggestWeek(BASE_RECIPES, [mealprep], {}, 'Sommer', { showDinner: true });
    expect(result[1].dinner?.recipeId).toBeTruthy();
  });

  it('fills slot via fallback when maxTime constraint is too strict', () => {
    const maxTime: DayConstraint = {
      id: 'c2', dayOfWeek: 2, mealType: 'dinner', constraint: 'maxTime', maxTimeMinutes: 5, label: 'Schnell', color: '#000',
    };
    // All recipes have timeMinutes=30 — Tier 1 hard-filters them all out, Tier 2 fills
    const result = suggestWeek(BASE_RECIPES, [maxTime], {}, 'Sommer', { showDinner: true });
    expect(result[2].dinner?.recipeId).toBeTruthy();
  });

  it('never fills a slot with an allergen-conflicting recipe', () => {
    const recipesWithMilk: Recipe[] = Array.from({ length: 7 }, (_, i) =>
      makeRecipe({ id: `m${i}`, name: `Käsegericht ${i}`, ingredients: [{ name: 'Käse', amount: 100, unit: 'g', perPortions: 4 }] })
    );
    const result = suggestWeek(recipesWithMilk, [], {}, 'Sommer', {
      showDinner: true,
      allergiesAndAversions: ['laktose'],
    });
    const anyFilled = Object.values(result).some(d => d.dinner?.recipeId);
    // Allergen filter is never relaxed — no slots should be filled
    expect(anyFilled).toBe(false);
  });
});

describe('suggestRecipe — suggestionEnabled', () => {
  it('excludes recipe with suggestionEnabled=false', () => {
    const disabled = makeRecipe({ id: 'disabled', name: 'Disabled Rezept', suggestionEnabled: false });
    const result = suggestRecipe([disabled], {});
    expect(result).toBeNull();
  });

  it('includes recipe with suggestionEnabled=true', () => {
    const enabled = makeRecipe({ id: 'enabled', name: 'Enabled Rezept', suggestionEnabled: true });
    const result = suggestRecipe([enabled], {});
    expect(result?.id).toBe('enabled');
  });

  it('includes recipe with suggestionEnabled=undefined (default)', () => {
    const recipe = makeRecipe({ id: 'r1', name: 'Normales Rezept' });
    const result = suggestRecipe([recipe], {});
    expect(result?.id).toBe('r1');
  });
});
