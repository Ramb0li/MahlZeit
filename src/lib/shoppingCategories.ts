/**
 * Kategorien für Einkaufsliste und Vorrat.
 *
 * Bis hierher gab es die Symboltabelle dreimal: in ShoppingListView, in PantryView
 * und implizit über INGREDIENT_CATEGORIES in utils.ts. Die Kopien sind
 * auseinandergelaufen — der Einkaufsliste fehlten Fleisch & Geflügel, Spirituosen
 * und Süsses & Backen komplett, und die Symbole für Hülsenfrüchte und Getreide
 * waren dort vertauscht, während der Vorrat sie richtig führte.
 *
 * Deshalb liegen die Symbole jetzt an einer Stelle. Die Reihenfolge bleibt bewusst
 * bei den Ansichten: im Laden geht man anders durch die Rubriken als durch den
 * eigenen Vorratsschrank.
 *
 * Ein Test hält fest, dass jede Kategorie aus INGREDIENT_CATEGORIES hier ein
 * Symbol und einen Platz in der Einkaufsreihenfolge hat.
 */

/** Ein Symbol je Kategorie. Keines doppelt, sonst sind Rubriken nicht unterscheidbar. */
export const CATEGORY_ICONS: Record<string, string> = {
  'Obst & Gemüse':         '🍎',
  'Hülsenfrüchte':         '🫘',
  'Getreide & Stärke':     '🌾',
  'Milchprodukte & Eier':  '🥛',
  'Fleisch & Geflügel':    '🥩',
  'Fisch & Meeresfrüchte': '🐟',
  'Tofu & Veganes':        '🌱',
  'Haltbare Produkte':     '🫙',
  'Nüsse & Samen':         '🥜',
  'Gewürze & Kräuter':     '🌿',
  'Süsses & Backen':       '🍫',
  'Spirituosen':           '🍷',
  'Sonstiges':             '🫧',
  // Rubriken, die nur von Hand erfasst werden und aus keinem Rezept stammen.
  'Haushalt':              '🧹',
  'Hygiene':               '🧴',
  'Persönliches':          '🪞',
  'Getränke':              '🥤',
  'Tierbedarf':            '🐾',
};

/** Reihenfolge in der Einkaufsliste: Frischwaren zuerst, Haltbares danach. */
export const RECIPE_CATEGORY_ORDER = [
  'Obst & Gemüse', 'Hülsenfrüchte', 'Getreide & Stärke', 'Milchprodukte & Eier',
  'Fleisch & Geflügel', 'Fisch & Meeresfrüchte', 'Tofu & Veganes',
  'Haltbare Produkte', 'Nüsse & Samen', 'Gewürze & Kräuter',
  'Süsses & Backen', 'Spirituosen', 'Sonstiges',
];

/** Rubriken ohne Rezeptbezug, stehen in der Einkaufsliste hinten. */
export const EXTRA_CATEGORIES = ['Haushalt', 'Hygiene', 'Persönliches', 'Getränke', 'Tierbedarf'];

export const ALL_CATEGORIES = [...RECIPE_CATEGORY_ORDER, ...EXTRA_CATEGORIES];
