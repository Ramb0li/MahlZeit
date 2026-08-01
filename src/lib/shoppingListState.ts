/**
 * Delta-Logik für den geteilten Einkaufslisten-State.
 *
 * Die Einkaufsliste wird von mehreren Haushaltsmitgliedern gleichzeitig benutzt —
 * typischerweise zu zweit im Laden. Würde der Client den kompletten State senden
 * und der Server ihn ersetzen, ginge bei zeitgleichem Abhaken die Änderung des
 * jeweils anderen verloren. Stattdessen schickt der Client nur die tatsächlichen
 * Änderungen, und der Server wendet sie auf den aktuellen Serverstand an.
 *
 * Bewusst frei von Server- und React-Abhängigkeiten, damit Client, Route und
 * Tests exakt dieselbe Semantik nutzen.
 */

import type { ShoppingListState, CustomShoppingItem } from '@/types';

export interface ShoppingListDelta {
  checkedAdd?:      string[];
  checkedRemove?:   string[];
  pantryAdd?:       string[];
  pantryRemove?:    string[];
  overridesSet?:    Record<string, number>;
  overridesRemove?: string[];
  customAdd?:       CustomShoppingItem[];
  customRemove?:    string[];
}

/** true, wenn das Delta keinerlei Änderung enthält (dann muss nichts gesendet werden). */
export function isEmptyDelta(d: ShoppingListDelta): boolean {
  return !d.checkedAdd?.length      && !d.checkedRemove?.length
      && !d.pantryAdd?.length       && !d.pantryRemove?.length
      && !d.overridesRemove?.length && !d.customAdd?.length
      && !d.customRemove?.length
      && Object.keys(d.overridesSet ?? {}).length === 0;
}

function applySetDelta(base: string[], add?: string[], remove?: string[]): string[] {
  const removeSet = new Set(remove ?? []);
  const result: string[] = [];
  const seen = new Set<string>();
  // Reihenfolge des Serverstands beibehalten, entfernte Einträge auslassen
  base.forEach((k) => {
    if (removeSet.has(k) || seen.has(k)) return;
    seen.add(k);
    result.push(k);
  });
  (add ?? []).forEach((k) => {
    if (removeSet.has(k) || seen.has(k)) return;
    seen.add(k);
    result.push(k);
  });
  return result;
}

/** Wendet ein Delta auf den aktuellen Serverstand an. */
export function applyShoppingListDelta(
  existing: ShoppingListState,
  delta: ShoppingListDelta,
): ShoppingListState {
  const overrides = { ...existing.overrides, ...(delta.overridesSet ?? {}) };
  (delta.overridesRemove ?? []).forEach((k) => { delete overrides[k]; });

  const removedCustom = new Set(delta.customRemove ?? []);
  const customItems   = existing.customItems.filter((c) => !removedCustom.has(c.id));
  const knownIds      = new Set(customItems.map((c) => c.id));
  (delta.customAdd ?? []).forEach((item) => {
    if (removedCustom.has(item.id)) return;
    if (knownIds.has(item.id)) {
      // gleiche ID erneut geschickt: als Aktualisierung behandeln
      const idx = customItems.findIndex((c) => c.id === item.id);
      customItems[idx] = item;
      return;
    }
    knownIds.add(item.id);
    customItems.push(item);
  });

  return {
    checked:     applySetDelta(existing.checked,    delta.checkedAdd, delta.checkedRemove),
    userPantry:  applySetDelta(existing.userPantry, delta.pantryAdd,  delta.pantryRemove),
    overrides,
    customItems,
    updatedAt:   new Date().toISOString(),
  };
}

// ─── Client-Seite: Delta aus zwei States ableiten und Deltas zusammenfassen ───

function diffSet(prev: string[], next: string[]): { add: string[]; remove: string[] } {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  return {
    add:    next.filter((k) => !prevSet.has(k)),
    remove: prev.filter((k) => !nextSet.has(k)),
  };
}

/** Berechnet das Delta zwischen zwei aufeinanderfolgenden Client-States. */
export function diffShoppingListState(
  prev: ShoppingListState,
  next: ShoppingListState,
): ShoppingListDelta {
  const checked = diffSet(prev.checked, next.checked);
  const pantry  = diffSet(prev.userPantry, next.userPantry);

  const overridesSet: Record<string, number> = {};
  Object.entries(next.overrides).forEach(([k, v]) => {
    if (prev.overrides[k] !== v) overridesSet[k] = v;
  });
  const overridesRemove = Object.keys(prev.overrides).filter((k) => !(k in next.overrides));

  const prevCustom = new Map(prev.customItems.map((c) => [c.id, JSON.stringify(c)]));
  const nextIds    = new Set(next.customItems.map((c) => c.id));
  const customAdd  = next.customItems.filter((c) => prevCustom.get(c.id) !== JSON.stringify(c));
  const customRemove = prev.customItems.filter((c) => !nextIds.has(c.id)).map((c) => c.id);

  return {
    checkedAdd:    checked.add,
    checkedRemove: checked.remove,
    pantryAdd:     pantry.add,
    pantryRemove:  pantry.remove,
    overridesSet,
    overridesRemove,
    customAdd,
    customRemove,
  };
}

/**
 * Führt zwei Deltas zusammen (älteres zuerst). Nötig, weil die Übertragung
 * entprellt wird und in der Wartezeit mehrere Änderungen anfallen können.
 * Bei Widerspruch gewinnt immer das neuere Delta.
 */
export function mergeDeltas(older: ShoppingListDelta, newer: ShoppingListDelta): ShoppingListDelta {
  const combineSets = (
    oldAdd: string[] = [], oldRem: string[] = [],
    newAdd: string[] = [], newRem: string[] = [],
  ) => {
    const newAddSet = new Set(newAdd);
    const newRemSet = new Set(newRem);
    const add = [...oldAdd.filter((k) => !newRemSet.has(k) && !newAddSet.has(k)), ...newAdd];
    const rem = [...oldRem.filter((k) => !newAddSet.has(k) && !newRemSet.has(k)), ...newRem];
    return { add, rem };
  };

  const checked = combineSets(
    older.checkedAdd, older.checkedRemove, newer.checkedAdd, newer.checkedRemove,
  );
  const pantry = combineSets(
    older.pantryAdd, older.pantryRemove, newer.pantryAdd, newer.pantryRemove,
  );

  const newerRemoved = new Set(newer.overridesRemove ?? []);
  const overridesSet: Record<string, number> = {};
  Object.entries(older.overridesSet ?? {}).forEach(([k, v]) => {
    if (!newerRemoved.has(k)) overridesSet[k] = v;
  });
  Object.assign(overridesSet, newer.overridesSet ?? {});

  const newerSetKeys = new Set(Object.keys(newer.overridesSet ?? {}));
  const overridesRemove = [
    ...(older.overridesRemove ?? []).filter((k) => !newerSetKeys.has(k)),
    ...(newer.overridesRemove ?? []),
  ];

  const newerCustomRemoved = new Set(newer.customRemove ?? []);
  const newerCustomIds     = new Set((newer.customAdd ?? []).map((c) => c.id));
  const customAdd = [
    ...(older.customAdd ?? []).filter((c) => !newerCustomRemoved.has(c.id) && !newerCustomIds.has(c.id)),
    ...(newer.customAdd ?? []),
  ];
  const customRemove = [
    ...(older.customRemove ?? []).filter((id) => !newerCustomIds.has(id)),
    ...(newer.customRemove ?? []),
  ];

  return {
    checkedAdd:    checked.add,
    checkedRemove: checked.rem,
    pantryAdd:     pantry.add,
    pantryRemove:  pantry.rem,
    overridesSet,
    overridesRemove,
    customAdd,
    customRemove,
  };
}
