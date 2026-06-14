/**
 * import-fooby.ts
 *
 * Importiert 25 Grill-Rezepte von fooby.ch in die MahlZeit-Datenbank.
 * Extraktion via Claude Sonnet 4.6 (strukturiertes Tool-Use).
 *
 * Ausfuehren: npm run recipes:import-fooby
 * Voraussetzung: ANTHROPIC_API_KEY in .env.local
 *
 * Idempotent: bereits vorhandene Rezepte (gleicher Name + source fooby.ch) werden uebersprungen.
 * Nach dem Import: npm run recipes:build
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import type { Category } from '../src/types/index';
import { computeAllergens } from './allergen-utils';

// ---------------------------------------------------------------------------
// Dotenv Loader
// ---------------------------------------------------------------------------

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const MODEL       = 'claude-sonnet-4-6';
const RECIPES_DIR = path.join(__dirname, '../data/recipes');
const SOURCE      = 'fooby.ch';

// Ordner → ID-Praefix
const FOLDER_PREFIX: Record<string, string> = {
  pasta:             'pas',
  suppen:            'sup',
  'salat-bowl':      'sal',
  kartoffel:         'kar',
  fleisch:           'fle',
  fisch:             'fis',
  sonstige:          'son',
  'eintopf-gratin':  'ein',
  reis:              'rei',
  eier:              'ei',
  ofen:              'ofe',
  asiatisch:         'asi',
  kindersnacks:      'kds',
};

// Kategorie → Ordner
const CATEGORY_FOLDER: Record<string, string> = {
  'Fleisch & Geflügel':                  'fleisch',
  'Fisch & Meeresfrüchte':              'fisch',
  'Salate & Bowls':                      'salat-bowl',
  'Snacks & Vorspeisen':                 'sonstige',
  'Wraps, Sandwiches & Burger':          'sonstige',
  'Pizza, Flammkuchen, Wähen & Quiches': 'sonstige',
  'Beilagen, Saucen & Dips':            'sonstige',
  'Gemüsegerichte':                      'sonstige',
  'Suppen, Eintöpfe & Currys':          'suppen',
  'Pasta & Teigwaren':                   'pasta',
  'Reis, Getreide & Hülsenfrüchte':     'reis',
  'Kartoffelgerichte':                   'kartoffel',
  'Aufläufe & Gratins':                  'eintopf-gratin',
  'Eiergerichte':                        'eier',
  'Desserts & Süsses':                   'sonstige',
  'Brot & Gebäck':                       'sonstige',
  'Müesli, Porridge & Frühstücksschalen': 'sonstige',
  'Getränke & Smoothies':                'sonstige',
};

// ---------------------------------------------------------------------------
// 25 FOOBY-Rezepte (Slug-basierte URLs — Node.js folgt Redirects automatisch)
// ---------------------------------------------------------------------------

const FOOBY_RECIPES = [
  { url: 'https://fooby.ch/de/rezepte/19982/grillschnecken--grillbrot---tomaten',         title: 'Grillschnecken mit Grillbrot und Tomaten' },
  { url: 'https://fooby.ch/de/rezepte/29027/grillplatte',                                 title: 'Grillplatte' },
  { url: 'https://fooby.ch/de/rezepte/13510/bbq-marinade',                                title: 'BBQ-Marinade' },
  { url: 'https://fooby.ch/de/rezepte/15687/buntes-grillgemuese',                         title: 'Buntes Grillgemüse' },
  { url: 'https://fooby.ch/de/rezepte/13500/t-bone-steak-mit-grillspargel',               title: 'T-Bone-Steak mit Grillspargel' },
  { url: 'https://fooby.ch/de/rezepte/19704/ratatouille-vom-grill',                       title: 'Ratatouille vom Grill' },
  { url: 'https://fooby.ch/de/rezepte/13562/pastasalat',                                  title: 'Pastasalat' },
  { url: 'https://fooby.ch/de/rezepte/13370/sommer-flammkuchen',                          title: 'Sommer-Flammkuchen' },
  { url: 'https://fooby.ch/de/rezepte/17997/grillierte-auberginen-mit-granatapfel-und-kichererbsen-', title: 'Gegrillte Auberginen mit Granatapfel und Kichererbsen' },
  { url: 'https://fooby.ch/de/rezepte/21155/sticky-blumenkohl-spiessli',                  title: 'Sticky Blumenkohl-Spiessli' },
  { url: 'https://fooby.ch/de/rezepte/13555/pouletbruestli-im-speckmantel',               title: 'Pouletbrüstli im Speckmantel' },
  { url: 'https://fooby.ch/de/rezepte/13519/the-executive-burger',                        title: 'Rindfleischburger vom Grill' },
  { url: 'https://fooby.ch/de/rezepte/11180/cordon-bleu-burger',                          title: 'Cordon-bleu-Burger' },
  { url: 'https://fooby.ch/de/rezepte/26549/sommer-hoernli-salat',                        title: 'Sommer-Hörnli-Salat' },
  { url: 'https://fooby.ch/de/rezepte/17708/vegi-burger-mit-bohnen-und-suesskartoffeln',  title: 'Vegi-Burger mit Bohnen und Süsskartoffeln' },
  { url: 'https://fooby.ch/de/rezepte/13402/auberginen-sandwich-mit-huettenkaese',        title: 'Auberginen-Sandwich mit Hüttenkäse' },
  { url: 'https://fooby.ch/de/rezepte/13201/pulled-beef-burger',                          title: 'Pulled-Beef-Burger' },
  { url: 'https://fooby.ch/de/rezepte/22199/pulled-mushroom-burger',                      title: 'Pulled-Mushroom-Burger' },
  { url: 'https://fooby.ch/de/rezepte/22952/grillierte-auberginen-mit-sojasauce-und-ingwer', title: 'Gegrillte Auberginen mit Sojasosse und Ingwer' },
  { url: 'https://fooby.ch/de/rezepte/21156/pouletfluegeli-spiessli-mit-erdnuss-dip',    title: 'Pouletflügeli-Spiessli mit Erdnuss-Dip' },
  { url: 'https://fooby.ch/de/rezepte/19338/poulet-steaks-mit-jamaica-marinade',          title: 'Poulet-Steaks mit Jamaica-Marinade' },
  { url: 'https://fooby.ch/de/rezepte/13515/the-classic-pulled-pork',                     title: 'Pulled Pork vom Grill' },
  { url: 'https://fooby.ch/de/rezepte/13563/grillierte-avocado-mit-tomaten-mozzarella-salsa', title: 'Gegrillte Avocado mit Tomaten-Mozzarella-Salsa' },
  { url: 'https://fooby.ch/de/rezepte/19800/cevapcici-vom-grill',                         title: 'Cevapcici vom Grill' },
  { url: 'https://fooby.ch/de/rezepte/8146/crevetten-spiessli-vom-grill',                 title: 'Crevetten-Spiessli vom Grill' },
];

// ---------------------------------------------------------------------------
// Tool-Schema mit ingredientGroups
// ---------------------------------------------------------------------------

const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Speichere das extrahierte Rezept in strukturiertem Format.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Rezeptname auf Deutsch — Umlaute korrekt (ü, ä, ö). Keine englischen Begriffe.',
      },
      description: {
        type: 'string',
        description: 'Kurze appetitliche Beschreibung (1-2 Sätze) auf Schweizerdeutsch-nahem Hochdeutsch.',
      },
      category: {
        type: 'string',
        enum: [
          'Snacks & Vorspeisen',
          'Suppen, Eintöpfe & Currys',
          'Salate & Bowls',
          'Pasta & Teigwaren',
          'Reis, Getreide & Hülsenfrüchte',
          'Kartoffelgerichte',
          'Eiergerichte',
          'Fleisch & Geflügel',
          'Fisch & Meeresfrüchte',
          'Gemüsegerichte',
          'Aufläufe & Gratins',
          'Wraps, Sandwiches & Burger',
          'Pizza, Flammkuchen, Wähen & Quiches',
          'Beilagen, Saucen & Dips',
          'Desserts & Süsses',
          'Brot & Gebäck',
          'Müesli, Porridge & Frühstücksschalen',
          'Getränke & Smoothies',
        ],
      },
      timeMinutes: {
        type: 'number',
        description: 'Gesamtzeit in Minuten (Vorbereitung + Zubereitung). Mindestens 5.',
      },
      basePortions: {
        type: 'number',
        description: 'Anzahl Portionen.',
      },
      weatherType: {
        type: 'string',
        enum: ['warm', 'kalt', 'neutral'],
        description: 'warm=leichte Sommergerichte/Salate/Grill, kalt=Suppen/Eintöpfe/Gratins, neutral=Rest.',
      },
      dietCategory: {
        type: 'string',
        enum: ['meat', 'fish', 'vegetarian', 'vegan'],
        description: 'meat=enthält Fleisch/Geflügel, fish=Fisch/Meeresfrüchte ohne Fleisch, vegetarian=kein Fleisch/Fisch, vegan=keine tierischen Produkte.',
      },
      tags: {
        type: 'array',
        description: 'Passende Tags. Verfügbar: Frühstück, Brunch, Mittagessen, Abendessen, Snack, Dessert, Mealprep-geeignet, Kinderfreundlich, Einfrierbar, Resteverwertung, Budgetfreundlich, Für Gäste, Gut zum Mitnehmen, Pfannengericht, Ofengericht, Grillgericht, One-Pot-Gericht, Airfryer, Ohne Kochen, Frühling, Sommer, Herbst, Winter, Ganzjährig, Schweizerisch, Italienisch, Mediterran, Französisch, Griechisch, Mexikanisch, Amerikanisch, Indisch, Thai, Chinesisch, Japanisch, Türkisch, Nahöstlich.',
        items: { type: 'string' },
      },
      ingredients: {
        type: 'array',
        description: 'ALLE Zutaten vollständig, inkl. Gewürze, Öl, Salz, Pfeffer. Mengen in metrischen Einheiten.',
        items: {
          type: 'object',
          properties: {
            name:   { type: 'string', description: 'Zutat auf Deutsch. Schweizer Begriffe: Rüebli, Peperoni, Nidel, Rahm, Poulet.' },
            amount: { type: 'number' },
            unit:   { type: 'string', description: 'g, kg, ml, l, EL, TL, Stk, Prise, Bund, Zehe, Dose' },
          },
          required: ['name', 'amount', 'unit'],
        },
      },
      ingredientGroups: {
        type: 'array',
        description: 'Nur ausfüllen wenn Rezept mehrere Komponenten hat (z.B. Marinade, Füllung, Dip, Beilage). Jede Gruppe enthält einen Untermengen der Zutaten. Vorbereitung in Klammern angeben: "Zwiebeln (fein gehackt)".',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Gruppenname, z.B. "Marinade", "Füllung", "Beilage", "Dip".' },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name:   { type: 'string' },
                  amount: { type: 'number' },
                  unit:   { type: 'string' },
                },
                required: ['name', 'amount', 'unit'],
              },
            },
          },
          required: ['name', 'ingredients'],
        },
      },
      steps: {
        type: 'array',
        description: 'Zubereitungsschritte VOLLSTÄNDIG NEU auf Deutsch schreiben — nicht 1:1 von fooby übernehmen. Je ein Schritt pro Element. Keine Nummerierung. Schweizer Standardsprache: Pfanne, Backofen, beigeben, andämpfen, würzen.',
        items: { type: 'string' },
      },
      tips: {
        type: 'string',
        description: 'Optionaler Tipp (Variationen, Aufbewahrung, Serviervorschlag).',
      },
    },
    required: ['name', 'category', 'timeMinutes', 'basePortions', 'weatherType', 'dietCategory', 'tags', 'ingredients', 'steps'],
  },
};

// ---------------------------------------------------------------------------
// HTML-Hilfsfunktionen
// ---------------------------------------------------------------------------

function isRecipeType(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const type = (obj as Record<string, unknown>)['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of candidates) {
        if (isRecipeType(obj)) return obj;
        if (obj?.['@graph'] && Array.isArray(obj['@graph'])) {
          const found = (obj['@graph'] as unknown[]).find(isRecipeType);
          if (found) return found as Record<string, unknown>;
        }
      }
    } catch { /* malformed JSON-LD */ }
  }
  return null;
}

function parseIso8601Duration(d: unknown): number {
  if (!d || typeof d !== 'string') return 0;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(d);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0');
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

// ---------------------------------------------------------------------------
// HTTP-Fetch
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; MahlZeitPlaner/1.0; recipe-import)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'de-CH,de;q=0.9,en;q=0.7',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} für ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`  Fetch-Fehler für ${url}: ${(e as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// ID-Verwaltung
// ---------------------------------------------------------------------------

function loadCurrentMaxIds(): Map<string, number> {
  const maxIds = new Map<string, number>();
  const subdirs = fs.readdirSync(RECIPES_DIR).filter(f =>
    fs.statSync(path.join(RECIPES_DIR, f)).isDirectory()
  );
  for (const folder of subdirs) {
    const dir    = path.join(RECIPES_DIR, folder);
    const prefix = FOLDER_PREFIX[folder];
    if (!prefix) continue;
    let max = 0;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const m = new RegExp(`^${prefix}-(\\d+)\\.json$`).exec(file);
      if (m) max = Math.max(max, parseInt(m[1]));
    }
    maxIds.set(folder, max);
  }
  return maxIds;
}

function nextId(folder: string, counters: Map<string, number>): string {
  const prefix  = FOLDER_PREFIX[folder] ?? 'son';
  const current = counters.get(folder) ?? 0;
  const next    = current + 1;
  counters.set(folder, next);
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Claude-Extraktion
// ---------------------------------------------------------------------------

async function extractRecipe(
  client: Anthropic,
  url: string,
  fallbackTitle: string,
): Promise<Record<string, unknown> | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const jsonLd  = extractJsonLd(html);

  let prompt: string;
  if (jsonLd) {
    prompt = `Du extrahierst ein Rezept von fooby.ch für MahlZeit, eine Schweizer Familienmenüplan-App.

SPRACHE: Schweizer Hochdeutsch. Küchenbegriffe: Rüebli (Karotte), Peperoni (Paprika), Nidel/Rahm (Sahne), Poulet (Hähnchen), andämpfen (anbraten), beigeben (hinzugeben), würzen, Pfanne, Backofen.

WICHTIG:
- Schreibe die Zubereitungsschritte vollständig NEU — nicht 1:1 von fooby übernehmen (Urheberrecht)
- Chronologische Reihenfolge, kurze Sätze, kein "Schritt 1:" am Anfang
- ingredientGroups nur wenn Rezept klar mehrere Komponenten hat (Marinade, Dip, Beilage etc.)
- Mengen in metrischen Einheiten (g, kg, ml, EL, TL, Stk)
- Alle Zutaten vollständig inkl. Gewürze, Öl, Salz

JSON-LD Daten:
${JSON.stringify(jsonLd).slice(0, 5500)}`;
  } else {
    const stripped = stripHtml(html);
    if (stripped.length < 200) {
      console.warn(`  Kein verwertbarer Inhalt für ${fallbackTitle}`);
      return null;
    }
    prompt = `Du extrahierst ein Rezept von fooby.ch für MahlZeit, eine Schweizer Familienmenüplan-App.

SPRACHE: Schweizer Hochdeutsch. Küchenbegriffe: Rüebli, Peperoni, Rahm, Poulet, andämpfen, beigeben.

WICHTIG:
- Schreibe die Zubereitungsschritte vollständig NEU (Urheberrecht)
- ingredientGroups nur wenn mehrere Komponenten vorhanden
- Alle Zutaten vollständig inkl. Gewürze, Öl, Salz, Pfeffer

Webseitentext (fooby.ch):
${stripped}`;
  }

  try {
    const response = await client.messages.create({
      model:       MODEL,
      max_tokens:  3000,
      tools:       [RECIPE_TOOL],
      tool_choice: { type: 'tool', name: 'save_recipe' },
      messages:    [{ role: 'user', content: prompt }],
    });

    const block = response.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return null;

    const recipe = block.input as Record<string, unknown>;

    // Zeitangabe aus JSON-LD als Fallback
    if (jsonLd && (!recipe.timeMinutes || recipe.timeMinutes === 0)) {
      const t = parseIso8601Duration(
        (jsonLd.totalTime ?? jsonLd.cookTime ?? jsonLd.prepTime) as string,
      );
      if (t > 0) recipe.timeMinutes = t;
    }

    // Portionen aus JSON-LD als Fallback
    if (jsonLd && !recipe.basePortions && jsonLd.recipeYield) {
      const yld   = jsonLd.recipeYield;
      const match = String(Array.isArray(yld) ? yld[0] : yld).match(/\d+/);
      if (match) recipe.basePortions = parseInt(match[0]);
    }

    return recipe;
  } catch (e) {
    console.warn(`  API-Fehler: ${(e as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Typ-Helfer für ingredientGroups
// ---------------------------------------------------------------------------

interface RawGroup {
  name: string;
  ingredients: Array<{ name: string; amount: number; unit: string }>;
}

function buildIngredientGroups(
  rawGroups: RawGroup[],
  basePortions: number,
): Array<{ name: string; ingredients: Array<{ name: string; amount: number; unit: string; perPortions: number }> }> {
  return rawGroups.map(g => ({
    name:        g.name,
    ingredients: g.ingredients.map(i => ({
      name:        i.name,
      amount:      i.amount,
      unit:        i.unit,
      perPortions: basePortions,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Bericht-Typ
// ---------------------------------------------------------------------------

interface ReportEntry {
  url:    string;
  title:  string;
  id?:    string;
  status: 'ok' | 'skipped' | 'failed';
  reason?: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Fehler: ANTHROPIC_API_KEY nicht gesetzt.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Bestehende Rezeptnamen (aus allen fooby.ch-Quellen) für Idempotenz
  const existingFoobyNames = new Set<string>();
  const subdirs = fs.readdirSync(RECIPES_DIR).filter(f =>
    fs.statSync(path.join(RECIPES_DIR, f)).isDirectory()
  );
  for (const folder of subdirs) {
    const dir = path.join(RECIPES_DIR, folder);
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const recipe = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Record<string, unknown>;
        if (recipe.source === SOURCE) {
          existingFoobyNames.add(((recipe.name as string) ?? '').toLowerCase().trim());
        }
      } catch { /* malformed JSON */ }
    }
  }

  // ID-Zaehler initialisieren
  const idCounters = loadCurrentMaxIds();

  const report: ReportEntry[] = [];
  let imported = 0;
  let skipped  = 0;
  let failed   = 0;

  console.log(`=== FOOBY Import (${FOOBY_RECIPES.length} Rezepte, Modell: ${MODEL}) ===\n`);

  for (let i = 0; i < FOOBY_RECIPES.length; i++) {
    const { url, title } = FOOBY_RECIPES[i];
    process.stdout.write(`  [${i + 1}/${FOOBY_RECIPES.length}] ${title} ...`);

    // Idempotenz-Check anhand des Titels (Plan-Bereinigung)
    const titleNorm = title.toLowerCase().trim();
    if (existingFoobyNames.has(titleNorm)) {
      console.log(' uebersprungen (bereits vorhanden)');
      report.push({ url, title, status: 'skipped', reason: 'bereits vorhanden' });
      skipped++;
      continue;
    }

    const recipeRaw = await extractRecipe(client, url, title);

    if (!recipeRaw) {
      console.log(' FEHLER (uebersprungen)');
      report.push({ url, title, status: 'failed', reason: 'fetch/extraktion fehlgeschlagen' });
      failed++;
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const name          = ((recipeRaw.name as string) ?? title).trim();
    const category      = (recipeRaw.category as Category) ?? 'Gemüsegerichte';
    const folder        = CATEGORY_FOLDER[category] ?? 'sonstige';
    const id            = nextId(folder, idCounters);
    const basePortions  = (recipeRaw.basePortions as number) ?? 4;

    // Zutaten normalisieren
    const rawIngredients = Array.isArray(recipeRaw.ingredients)
      ? (recipeRaw.ingredients as Array<{ name: string; amount: number; unit: string }>)
      : [];

    if (rawIngredients.length === 0) {
      console.log(' uebersprungen (keine Zutaten)');
      report.push({ url, title, status: 'failed', reason: 'keine Zutaten extrahiert' });
      failed++;
      // ID-Counter zuruecksetzen
      idCounters.set(folder, (idCounters.get(folder) ?? 1) - 1);
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    const ingredients = rawIngredients.map(ing => ({
      name:        ing.name,
      amount:      ing.amount ?? 0,
      unit:        ing.unit ?? 'Stk',
      perPortions: basePortions,
    }));

    // ingredientGroups aufbereiten
    const rawGroups = Array.isArray(recipeRaw.ingredientGroups)
      ? (recipeRaw.ingredientGroups as RawGroup[])
      : [];
    const ingredientGroups = rawGroups.length > 0
      ? buildIngredientGroups(rawGroups, basePortions)
      : undefined;

    // Allergene berechnen
    const allergens = computeAllergens({ name, ingredients });

    // Rezept-Objekt
    const recipeObj: Record<string, unknown> = {
      id,
      name,
      category,
      timeMinutes:   (recipeRaw.timeMinutes  as number)  ?? 30,
      basePortions,
      weatherType:   (recipeRaw.weatherType  as string)  ?? 'neutral',
      source:        SOURCE,
      sourceType:    'imported',
      approved:      false,
      description:   (recipeRaw.description  as string)  ?? '',
      tags:          (recipeRaw.tags         as string[]) ?? [],
      ingredients,
      ...(ingredientGroups ? { ingredientGroups } : {}),
      steps:         (recipeRaw.steps        as string[]) ?? [],
      ...(recipeRaw.tips ? { tips: recipeRaw.tips as string } : {}),
      ...(recipeRaw.dietCategory ? { dietCategory: recipeRaw.dietCategory as string } : {}),
      imageUrl:      null,
      imageZutaten:  null,
      imageKochen:   null,
      allergens,
    };

    // Datei schreiben
    const folderPath = path.join(RECIPES_DIR, folder);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(
      path.join(folderPath, `${id}.json`),
      JSON.stringify(recipeObj, null, 2),
      'utf-8',
    );

    existingFoobyNames.add(name.toLowerCase().trim());
    report.push({ url, title: name, id, status: 'ok' });
    imported++;

    console.log(` OK → ${id} (${category})`);
    await new Promise(r => setTimeout(r, 1200));
  }

  // Zusammenfassung
  console.log(`\n=== Ergebnis: ${imported} importiert, ${skipped} uebersprungen, ${failed} fehlgeschlagen ===\n`);

  // Bericht schreiben
  const reportPath = path.join(__dirname, '../data/fooby-import-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        date:                new Date().toISOString(),
        model:               MODEL,
        total:               FOOBY_RECIPES.length,
        imported,
        skipped_duplicates:  skipped,
        failed,
        recipes:             report,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`=== Bericht: data/fooby-import-report.json ===\n`);

  // recipes.json neu aufbauen
  console.log('=== Rebuilde data/recipes.json ===');
  require('./build-recipes.js');
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
