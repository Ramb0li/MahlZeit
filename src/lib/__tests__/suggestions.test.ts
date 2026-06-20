import { describe, it, expect } from 'vitest';
import { suggestWeek, suggestRecipe, colToIso, isoToCol } from '../suggestions';
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

describe('colToIso / isoToCol', () => {
  it('ist Identitaet bei weekStart=Montag', () => {
    for (let i = 1; i <= 7; i++) {
      expect(colToIso(i, 1)).toBe(i);
      expect(isoToCol(i, 1)).toBe(i);
    }
  });

  it('mappt korrekt bei Samstag-Wochenstart', () => {
    expect(colToIso(1, 6)).toBe(6); // Spalte 1 = Sa = ISO 6
    expect(colToIso(2, 6)).toBe(7); // Spalte 2 = So = ISO 7
    expect(colToIso(3, 6)).toBe(1); // Spalte 3 = Mo = ISO 1
    expect(colToIso(5, 6)).toBe(3); // Spalte 5 = Mi = ISO 3
    expect(colToIso(7, 6)).toBe(5); // Spalte 7 = Fr = ISO 5
    expect(isoToCol(3, 6)).toBe(5); // Mi (ISO 3) ist Spalte 5
    expect(isoToCol(4, 6)).toBe(6); // Do (ISO 4) ist Spalte 6
    expect(isoToCol(5, 6)).toBe(7); // Fr (ISO 5) ist Spalte 7
  });

  it('Roundtrip colToIso(isoToCol(x)) === x', () => {
    for (const wsd of [0, 1, 3, 6]) {
      for (let iso = 1; iso <= 7; iso++) {
        expect(colToIso(isoToCol(iso, wsd), wsd)).toBe(iso);
      }
    }
  });
});

describe('suggestWeek — weekStartDay', () => {
  it('platziert Mealprep-Reste auf korrekten Spalten bei Samstag-Start', () => {
    const mealprep: DayConstraint = {
      id: 'mp', dayOfWeek: 3, mealType: 'dinner', constraint: 'mealprep', label: 'Mealprep', color: '#000',
    };
    const result = suggestWeek(BASE_RECIPES, [mealprep], {}, 'Sommer', {
      showDinner: true,
      weekStartDay: 6,
    });
    // Spalte 5 = Mittwoch (ISO 3) = Mealprep-Dinner, muss befuellt sein
    expect(result[5].dinner?.recipeId).toBeTruthy();
    // Spalte 6 = Donnerstag (ISO 4) = Reste
    expect(result[6].dinner?.isLeftovers).toBe(true);
    // Spalte 7 = Freitag (ISO 5) = Reste
    expect(result[7].dinner?.isLeftovers).toBe(true);
    // Spalte 4 = Dienstag (ISO 2) = kein Reste (wuerde mit Monday-Start falsch sein)
    expect(result[4].dinner?.isLeftovers).toBeFalsy();
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
