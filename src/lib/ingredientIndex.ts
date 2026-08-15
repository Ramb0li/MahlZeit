/**
 * Zutaten-Index für den Admin-Bereich.
 *
 * Der Bestand ist über viele Importe aus fremden Quellen gewachsen, dabei sind die
 * Zutatennamen auseinandergelaufen: 1376 verschiedene Schreibweisen bei 419
 * Rezepten, darunter deutsche statt Schweizer Bezeichnungen und dieselbe Zutat in
 * Einzahl und Mehrzahl.
 *
 * Der Index wird bei jedem Aufruf aus den Rezepten neu berechnet und nicht
 * gespeichert. Das ist der ganze Trick an der Selbstaktualisierung: es gibt keine
 * zweite Datenhaltung, die veralten könnte.
 */

import type { Recipe, Ingredient } from '@/types';
import { categorizeIngredient } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Schweizer Schreibweise
// ---------------------------------------------------------------------------

export interface SpellingRule {
  muster:    RegExp;
  ersatz:    string;
  /** true = eindeutig, darf automatisch angewendet werden. */
  sicher:    boolean;
  /** Greift die Regel NICHT, wenn dieses Muster passt. */
  ausnahme?: RegExp;
  grund:     string;
}

/**
 * Reihenfolge ist bedeutsam: spezielle Regeln vor allgemeinen.
 *
 * Die Trennung in sicher und unsicher ist nicht kosmetisch. «Zucchini» heisst in
 * der Schweiz durchgehend «Zucchetti», da gibt es nichts abzuwägen. «Karotte» und
 * «Rüebli» sind dagegen beide gebräuchlich, und «Paprika» bleibt im Wort
 * «Paprikapulver» auch in der Schweiz Paprika — deshalb die Ausnahmen.
 */
export const SPELLING_RULES: SpellingRule[] = [
  { muster: /ß/g,                    ersatz: 'ss',        sicher: true,  grund: 'In der Schweiz gibt es kein ß.' },
  { muster: /\bZucchini\b/gi,        ersatz: 'Zucchetti', sicher: true,  grund: 'Schweizer Bezeichnung.' },
  { muster: /\bHähnchen/gi,          ersatz: 'Poulet',    sicher: true,  grund: 'Schweizer Bezeichnung.' },
  { muster: /\bHühnchen/gi,          ersatz: 'Poulet',    sicher: true,  grund: 'Schweizer Bezeichnung.' },
  { muster: /\bGarnelen\b/gi,        ersatz: 'Crevetten', sicher: true,  grund: 'Schweizer Bezeichnung.' },
  { muster: /\bGarnele\b/gi,         ersatz: 'Crevette',  sicher: true,  grund: 'Schweizer Bezeichnung.' },
  { muster: /\bSpeisestärke\b/gi,    ersatz: 'Maizena',   sicher: true,  grund: 'Schweizer Bezeichnung.' },
  { muster: /\bGrünkohl\b/gi,        ersatz: 'Federkohl', sicher: true,  grund: 'Schweizer Bezeichnung.' },

  // Ab hier nur Vorschläge — beide Formen sind in der Schweiz gebräuchlich.
  {
    muster: /\bPaprika\b/gi, ersatz: 'Peperoni', sicher: false,
    // "Paprikapulver" und "Paprika, edelsüss" bleiben Paprika: gemeint ist das
    // Gewürz, nicht das Gemüse.
    ausnahme: /paprika(pulver|gewürz)|edelsüss|rosenscharf|geräuchert/i,
    grund: 'Gemüse heisst in der Schweiz Peperoni. Das Gewürz bleibt Paprika.',
  },
  { muster: /\bKarotten\b/gi,      ersatz: 'Rüebli',      sicher: false, grund: 'Beide Formen gebräuchlich.' },
  { muster: /\bKarotte\b/gi,       ersatz: 'Rüebli',      sicher: false, grund: 'Beide Formen gebräuchlich.' },
  { muster: /\bMöhren?\b/gi,       ersatz: 'Rüebli',      sicher: false, grund: 'Deutsche Bezeichnung.' },
  { muster: /\bRotkohl\b/gi,       ersatz: 'Rotkabis',    sicher: false, grund: 'Schweizer Bezeichnung.' },
  { muster: /\bBrötchen\b/gi,      ersatz: 'Weggli',      sicher: false, grund: 'Schweizer Bezeichnung, passt nicht bei Burger-Brötchen.' },
  { muster: /\bTomatenpüree\b/gi,  ersatz: 'Tomatenmark', sicher: false, grund: 'Uneinheitlich im Bestand.' },
];

export interface SpellingSuggestion {
  vorschlag: string;
  sicher:    boolean;
  grund:     string;
}

/**
 * Schlägt für einen Zutatennamen die Schweizer Schreibweise vor.
 * Gibt null zurück, wenn nichts zu ändern ist.
 */
export function swissSpellingSuggestion(name: string): SpellingSuggestion | null {
  let out = name;
  let sicher = true;
  const gruende: string[] = [];

  for (const regel of SPELLING_RULES) {
    if (regel.ausnahme?.test(out)) continue;
    regel.muster.lastIndex = 0;
    if (!regel.muster.test(out)) continue;
    regel.muster.lastIndex = 0;
    out = out.replace(regel.muster, regel.ersatz);
    if (!regel.sicher) sicher = false;
    gruende.push(regel.grund);
  }

  if (out === name) return null;
  return { vorschlag: out, sicher, grund: gruende.join(' ') };
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

export interface IngredientUsage {
  recipeId:    string;
  recipeName:  string;
  displayName: string;      // exakt so, wie es im Rezept steht
  amount:      number;
  unit:        string;
}

export type IngredientHint =
  | { art: 'schreibweise';      vorschlag: string; sicher: boolean; grund: string }
  | { art: 'gemischte-einheit'; einheiten: string[] }
  | { art: 'doppelt-im-rezept'; rezepte: string[] }
  | { art: 'aehnlich';          namen: string[] };

export interface IngredientEntry {
  key:          string;             // Gruppierungsschlüssel
  canonical:    string;             // häufigste Schreibweise
  displayNames: string[];
  units:        string[];
  category:     string;
  usages:       IngredientUsage[];
  recipeCount:  number;
  hints:        IngredientHint[];
}

/**
 * Gruppierungsschlüssel: Kleinschreibung, ohne Klammerzusätze, ohne Mehrfach-
 * Leerzeichen. «Zucchini (fein gerieben)» und «Zucchini» landen damit in einer
 * Zeile, «Karotte» und «Karotten» bewusst nicht — die will der Admin nebeneinander
 * sehen, um sie zusammenzuführen.
 */
export function ingredientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Grober Stamm für den Ähnlichkeits-Hinweis: Mehrzahl- und Beugungsendungen weg. */
function similarityKey(key: string): string {
  let w = key;
  if (w.length > 4 && w.endsWith('n')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('s')) w = w.slice(0, -1);
  return w;
}

function häufigste(namen: string[]): string {
  const zaehler = new Map<string, number>();
  namen.forEach(n => zaehler.set(n, (zaehler.get(n) ?? 0) + 1));
  let best = namen[0] ?? '';
  let max  = 0;
  zaehler.forEach((n, name) => { if (n > max) { max = n; best = name; } });
  return best;
}

/**
 * Baut den alphabetisch sortierten Zutaten-Index über alle übergebenen Rezepte.
 *
 * Gelesen wird `ingredients`, nicht `ingredientGroups` — die beiden müssen
 * ohnehin dieselben Einträge enthalten (Invariante aus dem Import), und
 * `ingredients` ist die Liste, die App und Einkaufsliste verwenden.
 */
export function buildIngredientIndex(recipes: Recipe[]): IngredientEntry[] {
  const roh = new Map<string, IngredientUsage[]>();

  for (const r of recipes) {
    // Doppelte Namen innerhalb EINES Rezepts zählen, für den Hinweis unten.
    const proRezept = new Map<string, number>();
    for (const ing of r.ingredients ?? []) {
      if (!ing?.name) continue;
      const key = ingredientKey(ing.name);
      if (!key) continue;
      proRezept.set(key, (proRezept.get(key) ?? 0) + 1);
      const liste = roh.get(key) ?? [];
      liste.push({
        recipeId:    r.id,
        recipeName:  r.name,
        displayName: ing.name,
        amount:      ing.amount,
        unit:        ing.unit,
      });
      roh.set(key, liste);
    }
  }

  const entries: IngredientEntry[] = [];
  roh.forEach((usages, key) => {
    const displayNames = Array.from(new Set(usages.map(u => u.displayName))).sort();
    const units        = Array.from(new Set(usages.map(u => u.unit).filter(Boolean))).sort();
    const canonical    = häufigste(usages.map(u => u.displayName));

    const hints: IngredientHint[] = [];

    const schreibweise = swissSpellingSuggestion(canonical);
    if (schreibweise) {
      hints.push({ art: 'schreibweise', ...schreibweise });
    }

    if (units.length > 1) {
      hints.push({ art: 'gemischte-einheit', einheiten: units });
    }

    // Rezepte, in denen dieselbe Zutat mehrfach steht (etwa Butter zum Andämpfen
    // und zum Verfeinern). Nicht zwingend falsch, aber prüfenswert.
    const proRezept = new Map<string, number>();
    usages.forEach(u => proRezept.set(u.recipeId, (proRezept.get(u.recipeId) ?? 0) + 1));
    const mehrfach: string[] = [];
    proRezept.forEach((n, id) => { if (n > 1) mehrfach.push(id); });
    if (mehrfach.length) hints.push({ art: 'doppelt-im-rezept', rezepte: mehrfach.sort() });

    entries.push({
      key,
      canonical,
      displayNames,
      units,
      category:    categorizeIngredient(canonical),
      usages,
      recipeCount: new Set(usages.map(u => u.recipeId)).size,
      hints,
    });
  });

  // Ähnlichkeits-Hinweis erst jetzt, wenn alle Schlüssel bekannt sind.
  const nachStamm = new Map<string, string[]>();
  entries.forEach(e => {
    const s = similarityKey(e.key);
    const liste = nachStamm.get(s) ?? [];
    liste.push(e.key);
    nachStamm.set(s, liste);
  });
  entries.forEach(e => {
    const geschwister = (nachStamm.get(similarityKey(e.key)) ?? []).filter(k => k !== e.key);
    if (geschwister.length) e.hints.push({ art: 'aehnlich', namen: geschwister.sort() });
  });

  return entries.sort((a, b) => a.canonical.localeCompare(b.canonical, 'de'));
}

// ---------------------------------------------------------------------------
// Umbenennen
// ---------------------------------------------------------------------------

export interface RenameChange {
  recipeId:   string;
  recipeName: string;
  zutaten:    { von: string; nach: string }[];
  schritte:   { index: number; von: string; nach: string }[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ersetzt einen Namen im Fliesstext, aber nur als eigenständiges Wort.
 *
 * Komposita bleiben bewusst unangetastet: aus «Zucchinistreifen» würde sonst
 * «Zucchettistreifen», was zwar konsequent, aber nicht mehr das ist, was in der
 * Zutatenliste steht. Solche Fälle gehören von Hand geprüft.
 */
export function replaceWordInText(text: string, von: string, nach: string): string {
  const re = new RegExp(`(^|[^a-zäöüß])${escapeRe(von)}(?![a-zäöüß])`, 'gi');
  return text.replace(re, (_treffer, vorher: string) => `${vorher}${nach}`);
}

/**
 * Berechnet, was ein Umbenennen bewirken würde — ohne etwas zu speichern.
 * Dieselbe Funktion erzeugt die Vorschau im Admin und führt die Änderung aus,
 * damit Vorschau und Ergebnis nicht auseinanderfallen können.
 */
export function planRename(
  recipes: Recipe[],
  von: string[],
  nach: string,
  auchInSchritten: boolean,
): RenameChange[] {
  const vonKeys = new Set(von.map(ingredientKey));
  const changes: RenameChange[] = [];

  for (const r of recipes) {
    const zutaten: RenameChange['zutaten'] = [];
    for (const ing of r.ingredients ?? []) {
      if (vonKeys.has(ingredientKey(ing.name)) && ing.name !== nach) {
        zutaten.push({ von: ing.name, nach });
      }
    }

    const schritte: RenameChange['schritte'] = [];
    if (auchInSchritten && zutaten.length) {
      (r.steps ?? []).forEach((s, index) => {
        let neu = s;
        for (const alt of von) neu = replaceWordInText(neu, alt, nach);
        if (neu !== s) schritte.push({ index, von: s, nach: neu });
      });
    }

    if (zutaten.length || schritte.length) {
      changes.push({ recipeId: r.id, recipeName: r.name, zutaten, schritte });
    }
  }

  return changes;
}

/**
 * Wendet ein Umbenennen auf ein Rezept an.
 *
 * `ingredients` UND `ingredientGroups` werden gleich behandelt. Das ist keine
 * Fleissarbeit, sondern Pflicht: die Invariante «ingredients ist die
 * Konkatenation der ingredientGroups» wird beim Import geprüft, und ein Rezept,
 * das sie verletzt, fliegt beim nächsten Lauf mit einem Schema-Fehler heraus.
 */
export function applyRename(
  recipe: Recipe,
  von: string[],
  nach: string,
  auchInSchritten: boolean,
): Recipe {
  const vonKeys = new Set(von.map(ingredientKey));
  const rename  = (i: Ingredient): Ingredient =>
    vonKeys.has(ingredientKey(i.name)) ? { ...i, name: nach } : i;

  const out: Recipe = {
    ...recipe,
    ingredients: (recipe.ingredients ?? []).map(rename),
  };

  if (recipe.ingredientGroups?.length) {
    out.ingredientGroups = recipe.ingredientGroups.map(g => ({
      ...g,
      ingredients: g.ingredients.map(rename),
    }));
  }

  if (auchInSchritten && recipe.steps?.length) {
    out.steps = recipe.steps.map(s => {
      let neu = s;
      for (const alt of von) neu = replaceWordInText(neu, alt, nach);
      return neu;
    });
  }

  return out;
}
