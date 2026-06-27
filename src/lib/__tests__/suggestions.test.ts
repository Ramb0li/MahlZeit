import { describe, it, expect } from 'vitest';
import { suggestWeek, suggestRecipe, colToIso, isoToCol, classifyMealPools, recipeScore } from '../suggestions';
import type { Recipe, DayConstraint, Category } from '@/types';

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

  it('platziert Reste korrekt wenn Quell-Spalte nach Ziel-Spalten im Loop kommt (forward-reference)', () => {
    // Mealprep am Freitag (ISO 5), Reste-Tage Sa (ISO 6 = Spalte 1) und So (ISO 7 = Spalte 2)
    // Freitag = Spalte 7 wird im Loop NACH Sa/So verarbeitet → forward-reference-Bug ohne Post-Loop-Pass
    const mealprep: DayConstraint = {
      id: 'mp2', dayOfWeek: 5, mealType: 'dinner', constraint: 'mealprep',
      label: 'Mealprep', color: '#000', mealprepLunchDays: [6, 7],
    };
    const result = suggestWeek(BASE_RECIPES, [mealprep], {}, 'Sommer', {
      showDinner: true,
      weekStartDay: 6,
    });
    // Spalte 7 = Freitag = Mealprep-Quelle → muss Dinner haben
    expect(result[7].dinner?.recipeId).toBeTruthy();
    // Spalte 1 = Samstag = Reste (Quelle col 7 erst spaeter im Loop)
    expect(result[1].dinner?.isLeftovers).toBe(true);
    // Spalte 2 = Sonntag = Reste
    expect(result[2].dinner?.isLeftovers).toBe(true);
    // Andere Tage haben normale Vorschlaege
    expect(result[3].dinner?.recipeId).toBeTruthy();
    expect(result[5].dinner?.recipeId).toBeTruthy();
  });
});

describe('classifyMealPools', () => {
  it('ordnet Frühstücksgerichte nicht dem Abendessen oder Mittagessen zu', () => {
    const muesli = makeRecipe({ id: 'bf', name: 'Müesli', tags: ['Frühstück'] });
    const { breakfast, lunch, dinner } = classifyMealPools([muesli]);
    expect(breakfast.map(r => r.id)).toContain('bf');
    expect(lunch.map(r => r.id)).not.toContain('bf');
    expect(dinner.map(r => r.id)).not.toContain('bf');
  });

  it('reine Mittagessen-Gerichte sind nicht im Abendessen-Pool', () => {
    const lunchOnly = makeRecipe({ id: 'l1', name: 'Lunch', tags: ['Mittagessen'] });
    const { lunch, dinner } = classifyMealPools([lunchOnly]);
    expect(lunch.map(r => r.id)).toContain('l1');
    expect(dinner.map(r => r.id)).not.toContain('l1');
  });

  it('Mittagessen+Abendessen-Gerichte sind in beiden Pools', () => {
    const both = makeRecipe({ id: 'b1', name: 'Both', tags: ['Mittagessen', 'Abendessen'] });
    const { lunch, dinner } = classifyMealPools([both]);
    expect(lunch.map(r => r.id)).toContain('b1');
    expect(dinner.map(r => r.id)).toContain('b1');
  });

  it('untaggte Gerichte sind Abendessen, nicht Mittagessen/Frühstück', () => {
    const plain = makeRecipe({ id: 'p1', name: 'Plain' });
    const { breakfast, lunch, dinner } = classifyMealPools([plain]);
    expect(dinner.map(r => r.id)).toContain('p1');
    expect(lunch.map(r => r.id)).not.toContain('p1');
    expect(breakfast.map(r => r.id)).not.toContain('p1');
  });

  it('schliesst Snacks/Desserts vom Abendessen aus', () => {
    const dessert = makeRecipe({ id: 'd1', name: 'Kuchen', category: 'Desserts & Süsses' });
    const snack   = makeRecipe({ id: 's1', name: 'Chips', category: 'Snacks & Vorspeisen' });
    const { dinner } = classifyMealPools([dessert, snack]);
    expect(dinner).toHaveLength(0);
  });
});

describe('suggestWeek — Mahlzeit-Zuordnung (Regression Müesli-zum-Abendessen)', () => {
  it('schlägt nie ein Frühstücksgericht als Abendessen vor', () => {
    const muesli = makeRecipe({ id: 'bf', name: 'Müesli', tags: ['Frühstück'] });
    const normal = makeRecipe({ id: 'n1', name: 'Pasta' });
    const result = suggestWeek([muesli, normal], [], {}, 'Sommer', { showDinner: true });
    const dinnerIds = Object.values(result).map(d => d.dinner?.recipeId).filter(Boolean);
    expect(dinnerIds).not.toContain('bf');
  });
});

describe('recipeScore — Wochen-Abwechslung', () => {
  // Maluse (>=12) sind grösser als der Zufallsanteil (max +5) → Vergleiche sind deterministisch.
  const salad = makeRecipe({ id: 'sal', name: 'Tomatensalat mit Burrata', category: 'Salate & Bowls' });
  const pasta = makeRecipe({ id: 'pa', name: 'Spaghetti Napoli', category: 'Pasta & Teigwaren' });

  it('bestraft bereits den 2. gleichen KH-Typ', () => {
    const fresh  = recipeScore(pasta, {}, []);
    const repeat = recipeScore(pasta, { carbCounts: { pasta: 1 } }, []);
    expect(repeat).toBeLessThan(fresh);
  });

  it('eskaliert den KH-Malus mit der Anzahl', () => {
    const second = recipeScore(pasta, { carbCounts: { pasta: 1 } }, []);
    const third  = recipeScore(pasta, { carbCounts: { pasta: 2 } }, []);
    expect(third).toBeLessThan(second);
  });

  it('bestraft die 2. gleiche Kategorie', () => {
    const fresh  = recipeScore(salad, {}, []);
    const repeat = recipeScore(salad, { categoryCounts: { 'Salate & Bowls': 1 } }, []);
    expect(repeat).toBeLessThan(fresh);
  });

  it('bestraft eine wiederholte Hauptzutat (auch als Kompositum)', () => {
    const fresh  = recipeScore(salad, {}, []);
    // "tomaten" ist Substring von "tomatensalat" → Überlappung erkannt
    const repeat = recipeScore(salad, { usedIngredientTokens: ['tomaten'] }, []);
    expect(repeat).toBeLessThan(fresh);
  });
});

describe('suggestWeek — abwechslungsreiche Woche', () => {
  it('vergibt 7 unterschiedliche Kategorien und max. 1 Pasta bei genügend Pool', () => {
    const cats: Category[] = [
      'Salate & Bowls', 'Suppen, Eintöpfe & Currys', 'Fleisch & Geflügel',
      'Fisch & Meeresfrüchte', 'Gemüsegerichte', 'Aufläufe & Gratins',
      'Wraps, Sandwiches & Burger', 'Eiergerichte',
    ];
    const pool: Recipe[] = [
      ...cats.map((c, i) => makeRecipe({ id: `c${i}`, name: `Gericht ${i}`, category: c, tags: ['Abendessen'] })),
      makeRecipe({ id: 'pa1', name: 'Spaghetti Napoli', category: 'Pasta & Teigwaren', tags: ['Abendessen'] }),
      makeRecipe({ id: 'pa2', name: 'Penne Arrabiata', category: 'Pasta & Teigwaren', tags: ['Abendessen'] }),
    ];
    const result = suggestWeek(pool, [], {}, 'Sommer', { showDinner: true });
    const picked = Object.values(result).map(d => d.dinner?.recipeId).filter(Boolean) as string[];
    const pickedCats = picked.map(id => pool.find(r => r.id === id)!.category);
    expect(picked.length).toBe(7);
    expect(new Set(pickedCats).size).toBe(7);                         // alle Tage andere Kategorie
    expect(picked.filter(id => id.startsWith('pa')).length).toBeLessThanOrEqual(1); // höchstens 1 Pasta
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
