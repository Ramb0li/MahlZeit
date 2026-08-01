import { describe, it, expect } from 'vitest';
import {
  applyShoppingListDelta, diffShoppingListState, mergeDeltas, isEmptyDelta,
} from '../shoppingListState';
import type { ShoppingListState, CustomShoppingItem } from '@/types';

function makeState(over: Partial<ShoppingListState> = {}): ShoppingListState {
  return {
    checked:     [],
    userPantry:  [],
    overrides:   {},
    customItems: [],
    updatedAt:   '2026-07-26T10:00:00.000Z',
    ...over,
  };
}

function customItem(id: string): CustomShoppingItem {
  return { id, name: `Zutat ${id}`, amount: '1', unit: 'Stk', category: 'Sonstiges', checked: false };
}

describe('diffShoppingListState', () => {
  it('erkennt neu abgehakte Positionen', () => {
    const d = diffShoppingListState(makeState(), makeState({ checked: ['milch_l'] }));
    expect(d.checkedAdd).toEqual(['milch_l']);
    expect(d.checkedRemove).toEqual([]);
  });

  it('erkennt wieder abgewählte Positionen', () => {
    const d = diffShoppingListState(makeState({ checked: ['milch_l'] }), makeState());
    expect(d.checkedRemove).toEqual(['milch_l']);
  });

  it('erkennt geänderte und entfernte Mengen-Overrides', () => {
    const prev = makeState({ overrides: { a: 1, b: 2 } });
    const next = makeState({ overrides: { a: 5 } });
    const d = diffShoppingListState(prev, next);
    expect(d.overridesSet).toEqual({ a: 5 });
    expect(d.overridesRemove).toEqual(['b']);
  });

  it('liefert ein leeres Delta wenn sich nichts geaendert hat', () => {
    const s = makeState({ checked: ['x'], overrides: { a: 1 } });
    expect(isEmptyDelta(diffShoppingListState(s, { ...s }))).toBe(true);
  });
});

describe('applyShoppingListDelta', () => {
  it('fuegt zum aktuellen Serverstand hinzu statt ihn zu ersetzen', () => {
    // Serverstand enthaelt bereits die Aenderung eines anderen Mitglieds.
    const server = makeState({ checked: ['brot_stk'] });
    const result = applyShoppingListDelta(server, { checkedAdd: ['milch_l'] });
    expect(result.checked.sort()).toEqual(['brot_stk', 'milch_l']);
  });

  it('legt keine Duplikate an', () => {
    const server = makeState({ checked: ['milch_l'] });
    const result = applyShoppingListDelta(server, { checkedAdd: ['milch_l'] });
    expect(result.checked).toEqual(['milch_l']);
  });

  it('entfernt gezielt und laesst den Rest stehen', () => {
    const server = makeState({ checked: ['a', 'b', 'c'] });
    const result = applyShoppingListDelta(server, { checkedRemove: ['b'] });
    expect(result.checked).toEqual(['a', 'c']);
  });

  it('merged Overrides key-granular', () => {
    const server = makeState({ overrides: { a: 1, b: 2 } });
    const result = applyShoppingListDelta(server, { overridesSet: { b: 9 }, overridesRemove: ['a'] });
    expect(result.overrides).toEqual({ b: 9 });
  });

  it('merged eigene Positionen ueber die id', () => {
    const server = makeState({ customItems: [customItem('c1')] });
    const result = applyShoppingListDelta(server, { customAdd: [customItem('c2')] });
    expect(result.customItems.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('Regression: gleichzeitiges Abhaken verliert keine Haken', () => {
  /**
   * Der gemeldete Alltagsfall: zwei Personen stehen im Laden. Beide sehen
   * denselben Ausgangsstand, haken verschiedene Positionen ab und speichern.
   * Vorher schickte der Client den kompletten State und der Server ersetzte —
   * der zweite Schreibvorgang loeschte damit den Haken des ersten.
   */
  it('behaelt beide Haken, egal in welcher Reihenfolge gespeichert wird', () => {
    const start = makeState({ checked: [] });

    // Person A hakt "Milch" ab, Person B "Brot" — beide ausgehend von `start`.
    const deltaA = diffShoppingListState(start, makeState({ checked: ['milch_l'] }));
    const deltaB = diffShoppingListState(start, makeState({ checked: ['brot_stk'] }));

    const afterA = applyShoppingListDelta(start,  deltaA);
    const afterB = applyShoppingListDelta(afterA, deltaB);
    expect(afterB.checked.sort()).toEqual(['brot_stk', 'milch_l']);

    // Umgekehrte Reihenfolge muss dasselbe Ergebnis liefern.
    const afterB2 = applyShoppingListDelta(start,   deltaB);
    const afterA2 = applyShoppingListDelta(afterB2, deltaA);
    expect(afterA2.checked.sort()).toEqual(['brot_stk', 'milch_l']);
  });

  it('ein spaeteres Abwaehlen setzt sich gegen ein frueheres Abhaken durch', () => {
    const server = makeState({ checked: ['milch_l'] });
    const result = applyShoppingListDelta(server, { checkedAdd: ['milch_l'], checkedRemove: ['milch_l'] });
    expect(result.checked).toEqual([]);
  });
});

describe('mergeDeltas', () => {
  it('fasst zwei Aenderungen innerhalb des Debounce-Fensters zusammen', () => {
    const merged = mergeDeltas({ checkedAdd: ['a'] }, { checkedAdd: ['b'] });
    expect(merged.checkedAdd?.sort()).toEqual(['a', 'b']);
  });

  it('das neuere Delta gewinnt bei Widerspruch', () => {
    // erst abhaken, dann wieder abwaehlen → darf am Ende nicht abgehakt sein
    const merged = mergeDeltas({ checkedAdd: ['a'] }, { checkedRemove: ['a'] });
    expect(merged.checkedAdd).toEqual([]);
    expect(merged.checkedRemove).toEqual(['a']);

    const applied = applyShoppingListDelta(makeState(), merged);
    expect(applied.checked).toEqual([]);
  });

  it('kombiniert Override-Aenderungen ohne aeltere Keys zu verlieren', () => {
    const merged = mergeDeltas({ overridesSet: { a: 1 } }, { overridesSet: { b: 2 } });
    expect(merged.overridesSet).toEqual({ a: 1, b: 2 });
  });
});
