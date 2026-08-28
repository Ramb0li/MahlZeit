import { describe, it, expect } from 'vitest';
import { INGREDIENT_CATEGORIES, categorizeIngredient } from '../utils';
import { CATEGORY_ICONS, RECIPE_CATEGORY_ORDER, EXTRA_CATEGORIES, ALL_CATEGORIES } from '../shoppingCategories';

/**
 * Diese Tests halten fest, woran die Einkaufsliste tatsaechlich gelitten hat:
 * die Kategorietabelle lag dreimal im Code und die Kopien sind auseinandergelaufen.
 * Fleisch & Geflügel, Spirituosen und Süsses & Backen fehlten in der Einkaufsliste
 * ganz und landeten deshalb hinter dem Tierbedarf am Ende, ohne Symbol.
 */
describe('Kategorien sind vollstaendig abgedeckt', () => {
  const ausRezepten = Object.keys(INGREDIENT_CATEGORIES);

  it('jede Kategorie aus INGREDIENT_CATEGORIES hat ein Symbol', () => {
    const ohne = ausRezepten.filter(k => !CATEGORY_ICONS[k]);
    expect(ohne).toEqual([]);
  });

  it('jede Kategorie aus INGREDIENT_CATEGORIES hat einen Platz in der Reihenfolge', () => {
    const ohne = ausRezepten.filter(k => !RECIPE_CATEGORY_ORDER.includes(k));
    expect(ohne).toEqual([]);
  });

  it('deckt namentlich Fleisch, Spirituosen und Suesses ab', () => {
    // Genau die drei, die gefehlt haben. Fleisch war mit 109 Vorkommen im
    // Bestand die groesste betroffene Rubrik.
    for (const k of ['Fleisch & Geflügel', 'Spirituosen', 'Süsses & Backen']) {
      expect(RECIPE_CATEGORY_ORDER).toContain(k);
      expect(CATEGORY_ICONS[k]).toBeTruthy();
    }
  });

  it('auch die reinen Haushalts-Rubriken haben ein Symbol', () => {
    const ohne = EXTRA_CATEGORIES.filter(k => !CATEGORY_ICONS[k]);
    expect(ohne).toEqual([]);
  });

  it('vergibt kein Symbol zweimal', () => {
    // Zwei Rubriken mit demselben Symbol sind in der Liste nicht unterscheidbar.
    const werte = Object.values(CATEGORY_ICONS);
    expect(werte).toHaveLength(new Set(werte).size);
  });

  it('ALL_CATEGORIES ist die Vereinigung ohne Dubletten', () => {
    expect(ALL_CATEGORIES).toEqual([...RECIPE_CATEGORY_ORDER, ...EXTRA_CATEGORIES]);
    expect(ALL_CATEGORIES).toHaveLength(new Set(ALL_CATEGORIES).size);
  });

  it('was categorizeIngredient liefert, ist immer einsortierbar', () => {
    for (const beispiel of ['Pouletbrust', 'Rotwein', 'Schokolade', 'Zucchetti', 'Linsen', 'Irgendwas']) {
      expect(ALL_CATEGORIES).toContain(categorizeIngredient(beispiel));
    }
  });
});

describe('Nachschlagetabellen ohne Dubletten', () => {
  it('kein Stichwort steht zweimal in derselben Kategorie', () => {
    const doppelt: string[] = [];
    for (const [kat, keywords] of Object.entries(INGREDIENT_CATEGORIES)) {
      const d = keywords.filter((k, i) => keywords.indexOf(k) !== i);
      d.forEach(k => doppelt.push(`${kat}: ${k}`));
    }
    expect(doppelt).toEqual([]);
  });

  it('kein Stichwort steht in mehreren Kategorien', () => {
    // Der erste Treffer gewinnt, ein Stichwort in zwei Listen ist also
    // stiller Reihenfolgen-Zufall.
    const alle = Object.values(INGREDIENT_CATEGORIES).flat();
    // Kein Spread ueber ein Set — das tsconfig-Target laesst das nicht zu.
    const doppelt = alle.filter((k, i) => alle.indexOf(k) !== i)
                        .filter((k, i, arr) => arr.indexOf(k) === i);
    expect(doppelt).toEqual([]);
  });

  it('kein Stichwort mit ß — die Daten sind auf Schweizer Schreibweise umgestellt', () => {
    const mitEszett = Object.values(INGREDIENT_CATEGORIES).flat().filter(k => k.includes('ß'));
    expect(mitEszett).toEqual([]);
  });
});
