import { describe, it, expect } from 'vitest';
import {
  buildIngredientIndex, ingredientKey, swissSpellingSuggestion,
  replaceWordInText, planRename, applyRename,
} from '../ingredientIndex';
import type { Recipe, Ingredient } from '@/types';

function ing(name: string, amount = 1, unit = 'Stk'): Ingredient {
  return { name, amount, unit, perPortions: 4 };
}

function rezept(id: string, name: string, zutaten: Ingredient[], steps: string[] = []): Recipe {
  return {
    id, name,
    category: 'Pasta & Teigwaren',
    timeMinutes: 30,
    tags: ['Abendessen'],
    ingredients: zutaten,
    ingredientGroups: [{ name: 'Zutaten', ingredients: zutaten }],
    steps,
    weatherType: 'neutral',
    source: 'MahlZyt',
    basePortions: 4,
    description: 'Test.',
  } as Recipe;
}

describe('ingredientKey', () => {
  it('vereinheitlicht Gross- und Kleinschreibung und Klammerzusaetze', () => {
    expect(ingredientKey('Zucchetti (fein gerieben)')).toBe('zucchetti');
    expect(ingredientKey('ZUCCHETTI')).toBe('zucchetti');
    expect(ingredientKey('  Zucchetti  ')).toBe('zucchetti');
  });

  it('haelt Einzahl und Mehrzahl bewusst auseinander', () => {
    // Der Admin soll die Varianten nebeneinander sehen und selbst zusammenfuehren.
    expect(ingredientKey('Karotte')).not.toBe(ingredientKey('Karotten'));
  });
});

describe('swissSpellingSuggestion', () => {
  it('schlaegt die eindeutigen Faelle als sicher vor', () => {
    expect(swissSpellingSuggestion('Zucchini')).toMatchObject({ vorschlag: 'Zucchetti', sicher: true });
    expect(swissSpellingSuggestion('Hähnchenbrustfilet')).toMatchObject({ vorschlag: 'Pouletbrustfilet', sicher: true });
    expect(swissSpellingSuggestion('Garnelen')).toMatchObject({ vorschlag: 'Crevetten', sicher: true });
    expect(swissSpellingSuggestion('Speisestärke')).toMatchObject({ vorschlag: 'Maizena', sicher: true });
    expect(swissSpellingSuggestion('Grünkohl')).toMatchObject({ vorschlag: 'Federkohl', sicher: true });
  });

  it('ersetzt ß durch ss', () => {
    expect(swissSpellingSuggestion('Hartweizengrieß')).toMatchObject({ vorschlag: 'Hartweizengriess', sicher: true });
  });

  it('markiert regional zweideutige Faelle als unsicher', () => {
    expect(swissSpellingSuggestion('Karotten')).toMatchObject({ vorschlag: 'Rüebli', sicher: false });
    expect(swissSpellingSuggestion('Paprika')).toMatchObject({ vorschlag: 'Peperoni', sicher: false });
    expect(swissSpellingSuggestion('Rotkohl')).toMatchObject({ vorschlag: 'Rotkabis', sicher: false });
  });

  it('laesst Paprika als Gewuerz in Ruhe', () => {
    // "Paprikapulver" heisst auch in der Schweiz so — aus dem Gewuerz darf kein
    // Gemuese werden.
    expect(swissSpellingSuggestion('Paprikapulver')).toBeNull();
    expect(swissSpellingSuggestion('Paprika, edelsüss')).toBeNull();
    expect(swissSpellingSuggestion('geräuchertes Paprikapulver')).toBeNull();
  });

  it('gibt null zurueck, wenn nichts zu aendern ist', () => {
    expect(swissSpellingSuggestion('Zucchetti')).toBeNull();
    expect(swissSpellingSuggestion('Rüebli')).toBeNull();
    expect(swissSpellingSuggestion('Butter')).toBeNull();
  });
});

describe('buildIngredientIndex', () => {
  const rezepte = [
    rezept('r1', 'Erstes', [ing('Zucchini'), ing('Butter', 1, 'EL'), ing('Butter', 20, 'g')]),
    rezept('r2', 'Zweites', [ing('Zucchini (fein gerieben)'), ing('Karotte')]),
    rezept('r3', 'Drittes', [ing('Karotten')]),
  ];

  it('gruppiert gleiche Namen ueber Rezepte hinweg', () => {
    const idx = buildIngredientIndex(rezepte);
    const z = idx.find(e => e.key === 'zucchini')!;
    expect(z.recipeCount).toBe(2);
    expect(z.displayNames).toEqual(['Zucchini', 'Zucchini (fein gerieben)']);
  });

  it('sortiert alphabetisch', () => {
    const namen = buildIngredientIndex(rezepte).map(e => e.canonical);
    expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'de')));
  });

  it('meldet die Schweizer Schreibweise als Hinweis', () => {
    const z = buildIngredientIndex(rezepte).find(e => e.key === 'zucchini')!;
    expect(z.hints).toContainEqual(expect.objectContaining({ art: 'schreibweise', vorschlag: 'Zucchetti', sicher: true }));
  });

  it('meldet gemischte Einheiten', () => {
    const b = buildIngredientIndex(rezepte).find(e => e.key === 'butter')!;
    expect(b.hints).toContainEqual(expect.objectContaining({ art: 'gemischte-einheit', einheiten: ['EL', 'g'] }));
  });

  it('meldet eine Zutat, die im selben Rezept zweimal steht', () => {
    const b = buildIngredientIndex(rezepte).find(e => e.key === 'butter')!;
    expect(b.hints).toContainEqual(expect.objectContaining({ art: 'doppelt-im-rezept', rezepte: ['r1'] }));
  });

  it('meldet aehnliche Schreibweisen', () => {
    const k = buildIngredientIndex(rezepte).find(e => e.key === 'karotte')!;
    expect(k.hints).toContainEqual(expect.objectContaining({ art: 'aehnlich', namen: ['karotten'] }));
  });

  it('setzt die Kategorie aus categorizeIngredient', () => {
    const z = buildIngredientIndex(rezepte).find(e => e.key === 'zucchini')!;
    expect(z.category).toBe('Obst & Gemüse');
  });

  it('kommt mit leerem Bestand zurecht', () => {
    expect(buildIngredientIndex([])).toEqual([]);
  });
});

describe('replaceWordInText', () => {
  it('ersetzt das eigenstaendige Wort', () => {
    expect(replaceWordInText('Die Zucchini waschen.', 'Zucchini', 'Zucchetti'))
      .toBe('Die Zucchetti waschen.');
  });

  it('trifft auch am Satzanfang', () => {
    expect(replaceWordInText('Zucchini waschen.', 'Zucchini', 'Zucchetti'))
      .toBe('Zucchetti waschen.');
  });

  it('laesst Komposita unangetastet', () => {
    // "Zucchettistreifen" waere zwar konsequent, steht aber so nicht in der
    // Zutatenliste — solche Faelle gehoeren von Hand geprueft.
    expect(replaceWordInText('Die Zucchinistreifen anbraten.', 'Zucchini', 'Zucchetti'))
      .toBe('Die Zucchinistreifen anbraten.');
  });

  it('ignoriert Gross- und Kleinschreibung beim Suchen', () => {
    expect(replaceWordInText('Die zucchini waschen.', 'Zucchini', 'Zucchetti'))
      .toBe('Die Zucchetti waschen.');
  });
});

describe('planRename / applyRename', () => {
  const r = rezept('r1', 'Test',
    [ing('Zucchini'), ing('Butter', 1, 'EL')],
    ['Die Zucchini waschen.', 'Die Butter erhitzen.'],
  );

  it('meldet betroffene Zutaten und Schritte in der Vorschau', () => {
    const [change] = planRename([r], ['Zucchini'], 'Zucchetti', true);
    expect(change.zutaten).toEqual([{ von: 'Zucchini', nach: 'Zucchetti' }]);
    expect(change.schritte).toEqual([{ index: 0, von: 'Die Zucchini waschen.', nach: 'Die Zucchetti waschen.' }]);
  });

  it('laesst die Schritte in Ruhe, wenn das nicht gewuenscht ist', () => {
    const [change] = planRename([r], ['Zucchini'], 'Zucchetti', false);
    expect(change.schritte).toEqual([]);
  });

  it('meldet nichts, wenn die Zutat nicht vorkommt', () => {
    expect(planRename([r], ['Auberginen'], 'Melanzani', true)).toEqual([]);
  });

  it('haelt die Invariante ingredients = Konkatenation der ingredientGroups', () => {
    // Bricht die, schlaegt beim naechsten Import assertValidRecipe an.
    const out = applyRename(r, ['Zucchini'], 'Zucchetti', true);
    const flach = out.ingredientGroups!.flatMap(g => g.ingredients);
    expect(flach).toHaveLength(out.ingredients.length);
    expect(flach.map(i => i.name)).toEqual(out.ingredients.map(i => i.name));
    expect(out.ingredients[0].name).toBe('Zucchetti');
  });

  it('behaelt Menge und Einheit beim Umbenennen', () => {
    const out = applyRename(r, ['Butter'], 'Bratbutter', false);
    expect(out.ingredients[1]).toMatchObject({ name: 'Bratbutter', amount: 1, unit: 'EL' });
  });

  it('fuehrt mehrere Schreibweisen auf einen Namen zusammen', () => {
    const mix = rezept('r2', 'Mix', [ing('Karotte'), ing('Karotten'), ing('Rüebli (Karotte)')]);
    const out = applyRename(mix, ['Karotte', 'Karotten', 'Rüebli (Karotte)'], 'Rüebli', false);
    expect(out.ingredients.map(i => i.name)).toEqual(['Rüebli', 'Rüebli', 'Rüebli']);
  });

  it('kommt ohne ingredientGroups zurecht', () => {
    const ohne = { ...r, ingredientGroups: undefined } as Recipe;
    const out = applyRename(ohne, ['Zucchini'], 'Zucchetti', true);
    expect(out.ingredientGroups).toBeUndefined();
    expect(out.ingredients[0].name).toBe('Zucchetti');
  });
});
