/**
 * import-utils.ts
 *
 * Deterministische Bausteine der Import-Pipeline — bewusst ohne Anthropic-Client
 * und ohne Dateisystem-Zugriff, damit sie als reine Funktionen testbar sind.
 * Hier passiert alles, was NICHT dem Sprachmodell überlassen wird:
 * Faktenextraktion, Einheiten, Diätform, Tags, Duplikat-Hash, Slug.
 *
 * Siehe scripts/import-recipes-v2.ts für die Orchestrierung.
 */

import { createHash } from 'crypto';
import { TAG_GROUPS } from '../src/types/index';
import type { Category, DietCategory, Ingredient } from '../src/types/index';
import { EU_ALLERGEN_MAP } from './allergen-utils';

/**
 * Deduplizieren unter Beibehaltung der Reihenfolge.
 * Bewusst über indexOf statt [...new Set(...)] — das tsconfig-Target erlaubt
 * keine Set-Iteration, und der Build soll ohne downlevelIteration durchlaufen.
 */
function dedupe(values: string[]): string[] {
  return values.filter((v, i) => values.indexOf(v) === i);
}

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

/** Die einzigen Einheiten, die in die Datenbank gelangen dürfen. */
export const ALLOWED_UNITS = [
  'g', 'kg', 'ml', 'dl', 'EL', 'TL', 'Stk', 'Zehe', 'Prise', 'Bund', 'Zweig',
] as const;

export type AllowedUnit = typeof ALLOWED_UNITS[number];

/**
 * Synonyme und Plurale auf die erlaubte Form. Nur verlustfreie Abbildungen —
 * Mengenumrechnungen (z.B. "1 Dose" -> "400 g") gehören nicht hierher, die muss
 * das Modell bereits im Tool-Schema auflösen.
 */
const UNIT_SYNONYMS: Record<string, AllowedUnit> = {
  gramm: 'g', gr: 'g', g: 'g',
  kilogramm: 'kg', kilo: 'kg', kg: 'kg',
  milliliter: 'ml', ml: 'ml',
  deziliter: 'dl', dl: 'dl',
  esslöffel: 'EL', esslöffeln: 'EL', el: 'EL',
  teelöffel: 'TL', teelöffeln: 'TL', tl: 'TL',
  stück: 'Stk', stk: 'Stk', stück_: 'Stk', st: 'Stk',
  zehe: 'Zehe', zehen: 'Zehe',
  prise: 'Prise', prisen: 'Prise',
  bund: 'Bund', bündel: 'Bund',
  zweig: 'Zweig', zweige: 'Zweig', zweiglein: 'Zweig',
};

/**
 * Einheiten, die eine Mengenumrechnung brauchen. Reine Umbenennung reicht hier
 * nicht: 1 Liter sind 10 dl, sonst stünde nachher "1 dl" in der Einkaufsliste.
 *
 * Alle Einträge stammen aus echten Fehlschlägen des ersten Produktivlaufs
 * ("Liter" beim Spargelrisotto, "Stängel" bei Zitronengras in zwei Thai-Currys).
 */
const UNIT_CONVERSIONS: Record<string, { unit: AllowedUnit; factor: number }> = {
  l:       { unit: 'dl', factor: 10 },
  liter:   { unit: 'dl', factor: 10 },
  cl:      { unit: 'ml', factor: 10 },
  // Stück-artige Mengen: gleiche Zahl, andere Bezeichnung
  'stängel': { unit: 'Stk', factor: 1 },
  stange:    { unit: 'Stk', factor: 1 },
  stangen:   { unit: 'Stk', factor: 1 },
  stiel:     { unit: 'Stk', factor: 1 },
  stiele:    { unit: 'Stk', factor: 1 },
  scheibe:   { unit: 'Stk', factor: 1 },
  scheiben:  { unit: 'Stk', factor: 1 },
  blatt:     { unit: 'Stk', factor: 1 },
  'blätter': { unit: 'Stk', factor: 1 },
  kopf:      { unit: 'Stk', factor: 1 },
  knolle:    { unit: 'Stk', factor: 1 },
  msp:       { unit: 'Prise', factor: 1 },
  messerspitze: { unit: 'Prise', factor: 1 },
};

/**
 * Normalisiert eine Einheit auf die erlaubte Schreibweise.
 * Wirft bei nicht abbildbaren Einheiten — lieber ein harter Fehler als ein
 * stillschweigend falscher Datensatz in der Einkaufsliste.
 */
export function normalizeImportUnit(unit: string): AllowedUnit {
  return normalizeImportAmount(1, unit).unit;
}

/**
 * Normalisiert Menge und Einheit gemeinsam, damit Umrechnungen wie Liter -> dl
 * die Zahl mitziehen. Nicht abbildbare Einheiten (Dose, Packung, Handvoll)
 * lassen sich ohne Füllmenge nicht sinnvoll übersetzen und werfen weiterhin.
 */
export function normalizeImportAmount(
  amount: number,
  unit: string,
): { amount: number; unit: AllowedUnit } {
  const raw = (unit ?? '').trim();

  const direct = ALLOWED_UNITS.find(u => u === raw);
  if (direct) return { amount, unit: direct };

  const lower = raw.toLowerCase();

  const synonym = UNIT_SYNONYMS[lower];
  if (synonym) return { amount, unit: synonym };

  const conversion = UNIT_CONVERSIONS[lower];
  if (conversion) {
    const converted = amount * conversion.factor;
    // Krumme Nachkommastellen aus der Multiplikation vermeiden
    return { amount: Math.round(converted * 100) / 100, unit: conversion.unit };
  }

  throw new Error(
    `Einheit "${unit}" ist nicht erlaubt. Zulässig: ${ALLOWED_UNITS.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// Stichwort-Ablauf aus den Original-Instruktionen
// ---------------------------------------------------------------------------

/**
 * Kontrolliertes Kochverben-Vokabular. Nach Länge absteigend sortiert, damit
 * "anbraten" vor "braten" greift und nicht beide Treffer erzeugt werden.
 */
const COOKING_VERBS = [
  'gratinieren', 'überbacken', 'karamellisieren', 'abschmecken', 'marinieren',
  'blanchieren', 'einkochen', 'aufkochen', 'ablöschen', 'andämpfen', 'anbraten',
  'bestreuen', 'begiessen', 'abgiessen', 'pürieren', 'schichten', 'abkühlen',
  'schneiden', 'schälen', 'würfeln', 'köcheln', 'dünsten', 'würzen', 'wenden',
  'mischen', 'verrühren', 'servieren', 'backen', 'braten', 'kochen', 'hacken',
  'reiben', 'füllen', 'ruhen', 'garen',
].sort((a, b) => b.length - a.length);

/** Stamm ohne Infinitiv-Endung, damit auch "gebraten"/"brät" greifen. */
function verbStem(verb: string): string {
  return verb.replace(/en$/, '');
}

/**
 * Reduziert die Original-Zubereitung auf einen chronologischen Stichwort-Ablauf.
 *
 * Ganz bewusst EIN Leitverb pro Schritt statt "die ersten 8 Treffer insgesamt":
 * Letzteres verfälschte die Reihenfolge und liess bei einem Test mit Lasagne
 * ausgerechnet den Backschritt herausfallen, weil die frühen Schritte den Cap
 * bereits aufgebraucht hatten.
 *
 * Das Ergebnis enthält keine Formulierungen der Quelle, nur Tätigkeiten — also
 * Fakten, aus denen das Modell die Anleitung neu schreibt.
 */
export function extractStepKeywords(instructionTexts: string[], max = 8): string[] {
  const keywords: string[] = [];

  for (const text of instructionTexts.slice(0, max)) {
    const lower = (text ?? '').toLowerCase();
    const hit = COOKING_VERBS.find(v => lower.includes(verbStem(v)));
    if (hit && !keywords.includes(hit)) keywords.push(hit);
  }

  return keywords;
}

/** Zeitangaben aus den Original-Instruktionen (reine Zahlenfakten). */
export function extractTimes(instructionTexts: string[]): string[] {
  const joined = instructionTexts.join(' ');
  const hits = joined.match(/\d+\s*(?:Minuten|Min\.?|Stunden|Std\.?)/gi) ?? [];
  return dedupe(hits.map(h => h.replace(/\s+/g, ' ').trim()));
}

/** Temperaturangaben aus den Original-Instruktionen. */
export function extractTemperatures(instructionTexts: string[]): string[] {
  const joined = instructionTexts.join(' ');
  const hits = joined.match(/\d+\s*(?:°\s*C|Grad)/gi) ?? [];
  return dedupe(hits.map(h => h.replace(/\s+/g, ' ').trim()));
}

// ---------------------------------------------------------------------------
// Diätform — überschreibt das Modell
// ---------------------------------------------------------------------------

/**
 * Begriffe, die einen Fleisch- oder Fischstamm enthalten, aber nichts damit zu tun
 * haben. Sie werden VOR dem Abgleich aus dem Text entfernt.
 *
 * Alle Einträge stammen aus echten Fehltreffern im Bestand:
 * "Fleischtomaten" und "Tomatenfruchtfleisch" wurden als Fleisch gewertet,
 * "Muschelnudeln" (eine Teigwarenform) und "Grillschnecken" (Brotspiralen) als Fisch.
 */
const FALSE_FRIENDS = [
  'fleischtomate', 'fruchtfleisch', 'tomatenfleisch',
  'muschelnudel', 'grillschnecke', 'schneckennudel', 'nussschnecke',
];

/**
 * Eindeutige Fleisch-Begriffe: kommen in keinem harmlosen deutschen Wort vor und
 * dürfen deshalb auch mitten im Kompositum treffen ("Katenschinkenwürfel").
 */
const MEAT_SUBSTRINGS = [
  'schinken', 'salami', 'chorizo', 'prosciutto', 'cervelat', 'bratwurst',
  'hackfleisch', 'rindfleisch', 'kalbfleisch', 'schweinefleisch', 'lammfleisch',
  'bündnerfleisch', 'trockenfleisch', 'poulet', 'pancetta', 'guanciale',
  'truthahn', 'kaninchen', 'speck', 'bacon', 'hähnchen',
];

/**
 * Mehrdeutige Stämme: nur am Wortanfang oder Wortende gültig.
 * "Bündnerfleisch" trifft über die Endung, "gehackte Tomaten" gar nicht.
 */
const MEAT_BOUNDARY = [
  'fleisch', 'huhn', 'ente', 'gans', 'wurst', 'leberwurst', 'gehacktes',
];

/** Fisch/Meeresfrüchte — nutzt die bestehenden Allergen-Listen als Basis. */
const FISH_KEYWORDS = [
  ...EU_ALLERGEN_MAP.fisch,
  ...EU_ALLERGEN_MAP.krebstiere,
  ...EU_ALLERGEN_MAP.weichtiere,
];

const LETTER = 'a-zäöüß';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Entfernt die bekannten Fehlfreunde, bevor überhaupt verglichen wird. */
function stripFalseFriends(text: string): string {
  let out = text.toLowerCase();
  for (const term of FALSE_FRIENDS) out = out.split(term).join(' ');
  return out;
}

/** Teilstring-Treffer — nur für eindeutige Begriffe. */
function containsSubstring(haystack: string, needles: string[]): boolean {
  return needles.some(n => n && haystack.includes(n.toLowerCase()));
}

/**
 * Treffer am Wortanfang ODER am Wortende, nicht mitten im Wort.
 *
 * Beides ist nötig, weil deutsche Komposita den Kopf hinten tragen:
 * "Bündnerfleisch" trifft über die Endung, "Fleischvogel" über den Anfang.
 * Ein Treffer mitten im Wort wird verworfen — daran scheiterte die erste
 * Fassung, die "gehackte Tomaten" als Fleisch einstufte.
 */
function containsAtWordEdge(haystack: string, needles: string[]): boolean {
  return needles.some(n => {
    if (!n) return false;
    const e = escapeRe(n.toLowerCase());
    return new RegExp(`(^|[^${LETTER}])${e}`, 'i').test(haystack)
        || new RegExp(`${e}($|[^${LETTER}])`, 'i').test(haystack);
  });
}

/**
 * Bestimmt die Diätform deterministisch aus den Zutaten.
 * Fleisch schlägt Fisch, Fisch schlägt alles Vegetarische — unabhängig davon,
 * was das Modell behauptet hat. Zwischen 'vegetarian' und 'vegan' kann nur das
 * Modell sinnvoll unterscheiden (Butter, Honig, Rahm), deshalb wird dessen
 * Angabe dort übernommen.
 */
export function resolveDietCategory(
  ingredientNames: string[],
  modelAnswer?: DietCategory,
): DietCategory {
  const text = stripFalseFriends(ingredientNames.join(' | '));

  if (containsSubstring(text, MEAT_SUBSTRINGS) || containsAtWordEdge(text, MEAT_BOUNDARY)) {
    return 'meat';
  }
  if (containsAtWordEdge(text, FISH_KEYWORDS)) return 'fish';

  return modelAnswer === 'vegan' ? 'vegan' : 'vegetarian';
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const ALL_TAGS: string[] = Object.values(TAG_GROUPS).flatMap(g => [...g]);

export interface TagValidation {
  tags: string[];
  warnings: string[];
}

/**
 * Validiert die Tags hart gegen TAG_GROUPS. Ein unbekannter Tag ist ein Fehler,
 * kein Grund zum stillen Filtern — sonst verschwinden Modell-Halluzinationen
 * unbemerkt und die Tag-Vergabe wird nie besser.
 *
 * Fehlende Pflichtgruppen (Mahlzeit, Zubereitung, Saison) werden als Warnung
 * gemeldet, nicht als Fehler: sie machen den Datensatz unvollständig, nicht ungültig.
 */
export function validateTags(tags: unknown): TagValidation {
  if (!Array.isArray(tags)) {
    throw new Error('tags fehlt oder ist kein Array.');
  }

  const unknown = tags.filter(t => typeof t !== 'string' || !ALL_TAGS.includes(t));
  if (unknown.length) {
    throw new Error(
      `Unbekannte Tags: ${unknown.map(String).join(', ')}. ` +
      `Erlaubt sind ausschliesslich die Werte aus TAG_GROUPS.`,
    );
  }

  const clean = dedupe(tags as string[]);
  const warnings: string[] = [];

  const has = (group: readonly string[]) => clean.some(t => group.includes(t));
  if (!has(TAG_GROUPS.Mahlzeit))    warnings.push('Kein Tag aus der Gruppe Mahlzeit.');
  if (!has(TAG_GROUPS.Zubereitung)) warnings.push('Kein Tag aus der Gruppe Zubereitung.');
  if (!has(TAG_GROUPS.Saison))      warnings.push('Kein Tag aus der Gruppe Saison.');

  const cuisineCount = clean.filter(t => (TAG_GROUPS.Küche as readonly string[]).includes(t)).length;
  if (cuisineCount > 1) warnings.push(`${cuisineCount} Küchen-Tags — genau einer ist vorgesehen.`);

  return { tags: clean, warnings };
}

// ---------------------------------------------------------------------------
// Duplikat-Erkennung
// ---------------------------------------------------------------------------

/**
 * Zutaten, die nichts über die Identität eines Gerichts aussagen. Ohne diese
 * Filterung würden sich Rezepte allein über Salz, Pfeffer und Olivenöl ähneln.
 */
const GENERIC_INGREDIENTS = [
  'salz', 'pfeffer', 'olivenöl', 'öl', 'sonnenblumenöl', 'rapsöl', 'bratbutter',
  'wasser', 'zucker', 'mehl', 'weissmehl', 'muskatnuss', 'paprika', 'paprikapulver',
  'gewürze', 'kräuter', 'essig', 'zitronensaft', 'butter',
];

/** Umlaute auflösen, Kleinschreibung, Sonderzeichen entfernen. */
export function normalizeIngredientName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, ' ')          // Vorbereitungshinweise wie "(fein gehackt)"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Grober Wortstamm. Ziel ist nicht korrekte Morphologie, sondern dass Singular
 * und Plural derselben Zutat auf denselben Token zusammenfallen.
 *
 * Die Endungen werden NACHEINANDER abgetragen, nicht als Alternativen — sonst
 * konvergieren die Formen nicht: "zitronen" -> "zitron", "zitrone" bliebe stehen.
 * Sequenziell landen beide bei "zitron".
 */
function stemWord(word: string): string {
  if (word.length <= 4) return word;
  let w = word;
  if (w.endsWith('s') && w.length > 4) w = w.slice(0, -1);   // Oliven-s, Reis bleibt konsistent
  if (w.endsWith('n') && w.length > 4) w = w.slice(0, -1);   // zitronen -> zitrone
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);   // zitrone  -> zitron
  return w;
}

/**
 * Zutaten-Tokens für den Duplikat-Vergleich: normalisiert, gestemmt,
 * Grundzutaten entfernt, dedupliziert, sortiert.
 */
export function mainIngredientTokens(ingredientNames: string[]): string[] {
  const generic = new Set(
    GENERIC_INGREDIENTS.map(g => normalizeIngredientName(g).split(' ').map(stemWord).join(' ')),
  );

  const tokens = ingredientNames
    .map(normalizeIngredientName)
    .filter(Boolean)
    .map(n => n.split(' ').filter(Boolean).map(stemWord).join(' '))
    .filter(n => n && !generic.has(n));

  return dedupe(tokens).sort();
}

/**
 * Hash über die Hauptzutaten. Reihenfolge-unabhängig, damit dasselbe Gericht
 * mit anders sortierter Zutatenliste trotzdem auffällt. Schneller Exakt-Pfad;
 * die eigentliche Erkennung leistet findDuplicate().
 */
export function mainIngredientHash(ingredientNames: string[]): string {
  return createHash('sha1').update(mainIngredientTokens(ingredientNames).join('|')).digest('hex');
}

/** Jaccard-Ähnlichkeit zweier Zutaten-Mengen: 0 = disjunkt, 1 = identisch. */
export function ingredientSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  setA.forEach(t => { if (setB.has(t)) shared++; });
  return shared / (setA.size + setB.size - shared);
}

/**
 * Schwelle, ab der zwei Rezepte als dasselbe Gericht gelten.
 *
 * Ein exakter Hash-Vergleich war zu streng: beim ersten Testlauf wurden zwei echte
 * Duplikate NICHT erkannt, weil "Bio-Zitrone" gegen "Bio-Zitronen" stand und das
 * Modell "Cherry-Tomaten (verschiedenfarbig)" in zwei Zutaten aufgeteilt hatte —
 * bei 11 von 12 bzw. 15 von 16 identischen Zutaten.
 *
 * 0.7 war dann zu locker. Risotti teilen fast die ganze Basis (Reis, Zwiebel,
 * Bouillon, Weisswein, Parmesan) und kommen untereinander auf 71 % — Safran-,
 * Steinpilz- und Spargelrisotto hätten sich gegenseitig verdrängt. Die beiden
 * bekannten ECHTEN Duplikate lagen bei 86 % und 100 %, also trennt 0.8 sauber.
 * Gegenprobe über alle Bestandsrezepte: bei 0.7 zwei Paare über der Schwelle,
 * bei 0.8 nur noch eines (dieselbe Kräutersauce in zwei Gerichten).
 *
 * Per DUP_THRESHOLD übersteuerbar, um ein fälschlich übersprungenes Rezept ohne
 * Code-Änderung nachzuholen.
 */
export const DUPLICATE_THRESHOLD = (() => {
  const raw = Number(process.env.DUP_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.8;
})();

export interface DuplicateCandidate { id: string; name: string; tokens: string[] }

/** Findet das ähnlichste Bestandsrezept oberhalb der Schwelle. */
export function findDuplicate(
  tokens: string[],
  existing: DuplicateCandidate[],
  threshold = DUPLICATE_THRESHOLD,
): { match: DuplicateCandidate; similarity: number } | null {
  let best: { match: DuplicateCandidate; similarity: number } | null = null;

  for (const candidate of existing) {
    const similarity = ingredientSimilarity(tokens, candidate.tokens);
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { match: candidate, similarity };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

/** Dateiname-tauglicher Slug aus dem NEUEN Rezeptnamen. */
export function slugify(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Zutaten-Aufbau
// ---------------------------------------------------------------------------

export interface RawIngredient { name: string; amount: number; unit: string }
export interface RawGroup { name: string; ingredients: RawIngredient[] }

/**
 * Baut die Gruppen und das flache ingredients-Array in einem Zug.
 *
 * Das flache Array ist die Konkatenation aller Gruppen in Reihenfolge, INKLUSIVE
 * Wiederholungen (Olivenöl, Salz kommen mehrfach vor) — genauso wie in ei-02.
 * Es wird deterministisch gebaut und nie vom Modell übernommen.
 */
export function buildIngredients(
  groups: RawGroup[],
  basePortions: number,
): { ingredientGroups: { name: string; ingredients: Ingredient[] }[]; ingredients: Ingredient[] } {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('ingredientGroups fehlt oder ist leer.');
  }

  const ingredientGroups = groups.map(g => {
    if (!g.name?.trim()) throw new Error('Zutatengruppe ohne Namen.');
    if (!Array.isArray(g.ingredients) || g.ingredients.length === 0) {
      throw new Error(`Zutatengruppe "${g.name}" ist leer.`);
    }
    return {
      name: g.name.trim(),
      ingredients: g.ingredients.map(i => {
        if (!i.name?.trim()) throw new Error(`Zutat ohne Namen in "${g.name}".`);
        const raw = Number(i.amount);
        if (!Number.isFinite(raw) || raw <= 0) {
          throw new Error(`Ungültige Menge für "${i.name}" in "${g.name}": ${i.amount}`);
        }
        // Menge und Einheit gemeinsam normalisieren — Liter -> dl zieht die Zahl mit.
        const { amount, unit } = normalizeImportAmount(raw, i.unit);
        return {
          name:        i.name.trim(),
          amount,
          unit,
          perPortions: basePortions,
        };
      }),
    };
  });

  const ingredients = ingredientGroups.flatMap(g => g.ingredients);

  // Assertion: das flache Array MUSS die Konkatenation der Gruppen sein.
  const expected = ingredientGroups.reduce((n, g) => n + g.ingredients.length, 0);
  if (ingredients.length !== expected) {
    throw new Error(`ingredients (${ingredients.length}) weicht von den Gruppen (${expected}) ab.`);
  }

  return { ingredientGroups, ingredients };
}

// ---------------------------------------------------------------------------
// Schema-Validierung
// ---------------------------------------------------------------------------

const CATEGORIES: Category[] = [
  'Snacks & Vorspeisen', 'Suppen, Eintöpfe & Currys', 'Salate & Bowls',
  'Pasta & Teigwaren', 'Reis, Getreide & Hülsenfrüchte', 'Kartoffelgerichte',
  'Eiergerichte', 'Fleisch & Geflügel', 'Fisch & Meeresfrüchte', 'Gemüsegerichte',
  'Aufläufe & Gratins', 'Wraps, Sandwiches & Burger',
  'Pizza, Flammkuchen, Wähen & Quiches', 'Beilagen, Saucen & Dips',
  'Desserts & Süsses', 'Brot & Gebäck', 'Müesli, Porridge & Frühstücksschalen',
  'Getränke & Smoothies',
];

export function isValidCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value);
}

/** Schritte dürfen keine eigene Nummerierung tragen — die macht die UI. */
const NUMBERING_PREFIX = /^\s*(?:\d+[.)]|Schritt\s*\d+\s*:?)/i;

/**
 * Reste der Tool-Serialisierung, die gelegentlich in Textfelder durchschlagen.
 * Real beobachtet: eine description endete mit
 *   "...am Tisch sitzt.</description>\n<parameter name="category">Pasta & Teigwaren"
 * Solche Felder dürfen nie in die Datenbank gelangen.
 */
const MARKUP_CONTAMINATION = /<\/?(?:parameter|description|name|steps|tags|invoke|function)\b|<\/[a-z_]+>/i;

export function hasMarkupContamination(text: string): boolean {
  return MARKUP_CONTAMINATION.test(text ?? '');
}

/**
 * Schneidet einen Textwert an der ersten Stelle ab, an der Tool-Syntax durchschlägt.
 *
 * Beobachtet in drei von 65 Modellantworten: die description endete mit
 *   "...am Tisch sitzt.</description>\n<parameter name="category">Pasta & Teigwaren"
 * Der Teil DAVOR ist sauberer, vollständiger Text — nur der Anhang ist Müll.
 * Ihn zu entfernen ist eine Bereinigung des Serialisierungsartefakts, keine
 * inhaltliche Nachbesserung.
 *
 * Gibt null zurück, wenn nach dem Abschneiden kein brauchbarer Satz übrig bleibt.
 * Dann greift weiterhin der harte Fehler, statt einen Halbsatz zu speichern.
 */
export function stripMarkupTail(text: string): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  if (!hasMarkupContamination(raw)) return raw;

  const cut = raw.search(/<\/?[a-z_]+[\s>]|<\/[a-z_]+>/i);
  const head = (cut > 0 ? raw.slice(0, cut) : '').trim();

  // Nur akzeptieren, wenn ein vollständiger Satz übrig bleibt.
  if (head.length < 20 || !/[.!?]$/.test(head)) return null;
  if (hasMarkupContamination(head)) return null;
  return head;
}

/**
 * Letzte Kontrolle vor dem Schreiben. Wirft mit klarer Meldung, statt einen
 * halbgaren Datensatz in data/recipes/ zu hinterlassen.
 */
export function assertValidRecipe(r: Record<string, unknown>): void {
  const fail = (msg: string) => { throw new Error(`Schema-Fehler (${r.id ?? '?'}): ${msg}`); };

  if (typeof r.id !== 'string' || !r.id) fail('id fehlt.');
  if (typeof r.name !== 'string' || !r.name.trim()) fail('name fehlt.');
  if (!isValidCategory(r.category)) fail(`category ungültig: ${String(r.category)}`);
  if (!['warm', 'kalt', 'neutral'].includes(String(r.weatherType))) {
    fail(`weatherType ungültig: ${String(r.weatherType)}`);
  }
  if (!['meat', 'fish', 'vegetarian', 'vegan'].includes(String(r.dietCategory))) {
    fail(`dietCategory ungültig: ${String(r.dietCategory)}`);
  }
  if (!['own', 'licensed', 'public-domain', 'adapted', 'unclear'].includes(String(r.licenseStatus))) {
    fail(`licenseStatus ungültig: ${String(r.licenseStatus)}`);
  }
  if (typeof r.timeMinutes !== 'number' || r.timeMinutes <= 0) fail('timeMinutes ungültig.');
  if (typeof r.basePortions !== 'number' || r.basePortions <= 0) fail('basePortions ungültig.');
  if (typeof r.description !== 'string' || !r.description.trim()) fail('description fehlt.');

  if (!Array.isArray(r.steps) || r.steps.length === 0) fail('steps fehlt oder ist leer.');
  const numbered = (r.steps as string[]).filter(s => NUMBERING_PREFIX.test(s));
  if (numbered.length) fail(`steps mit Nummerierungspräfix: ${numbered.length}`);

  // Textfelder auf durchgeschlagene Tool-Syntax prüfen.
  const textFields: [string, unknown][] = [
    ['name', r.name], ['description', r.description], ['tips', r.tips],
    ...(r.steps as string[]).map((s, i) => [`steps[${i}]`, s] as [string, unknown]),
  ];
  for (const [label, value] of textFields) {
    if (typeof value === 'string' && hasMarkupContamination(value)) {
      fail(`${label} enthält Reste der Tool-Serialisierung (Markup im Text).`);
    }
  }

  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) fail('ingredients fehlt.');
  if (!Array.isArray(r.ingredientGroups) || r.ingredientGroups.length === 0) {
    fail('ingredientGroups fehlt.');
  }

  const flat = (r.ingredientGroups as RawGroup[]).flatMap(g => g.ingredients);
  if (flat.length !== (r.ingredients as unknown[]).length) {
    fail('ingredients ist nicht die Konkatenation der ingredientGroups.');
  }

  if (r.approved !== false) fail('approved muss false sein.');
  if (r.imageUrl !== null)  fail('imageUrl muss null sein (kein Fremdbild).');
}
