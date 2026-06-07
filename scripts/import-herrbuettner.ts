/**
 * import-herrbuettner.ts
 *
 * Importiert alle Rezepte von https://herrbuettner.de/rezepte/ (~126 Rezepte).
 * Extraktion via Claude Sonnet (gleicher Ansatz wie src/app/api/recipes/import/route.ts).
 *
 * Ausfuehren: npm run recipes:import-hbu
 * Voraussetzung: ANTHROPIC_API_KEY in .env.local
 *
 * Idempotent: bereits vorhandene IDs werden uebersprungen.
 * Nach dem Import: npm run recipes:build
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import type { EuAllergen, Category } from '../src/types/index';
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

const BASE_URL    = 'https://herrbuettner.de/rezepte/';
const TOTAL_PAGES = 14;
const MODEL       = 'claude-sonnet-4-5';
const RECIPES_DIR = path.join(__dirname, '../data/recipes');
const SOURCE      = 'herrbuettner.de';

// Kategorie → Ordner-Mapping
const CATEGORY_FOLDER: Record<Category, string> = {
  'Pasta':                      'pasta',
  'Suppen, Eintöpfe & Currys':  'suppen',
  'Salate & Bowls':             'salat-bowl',
  'Kartoffelgerichte':          'kartoffel',
  'Fleisch & Geflügel':         'fleisch',
  'Fisch & Meeresfrüchte':      'fisch',
  'Vegetarische Hauptgerichte': 'sonstige',
  'Aufläufe & Gratins':         'eintopf-gratin',
  'Reis & Getreide':            'reis',
  'Frühstück':                  'eier',
  'Snacks & Vorspeisen':        'sonstige',
  'Wraps & Sandwiches':         'sonstige',
  'Desserts & Süsses':          'sonstige',
};

// Ordner → ID-Praefix
const FOLDER_PREFIX: Record<string, string> = {
  pasta:           'pas',
  suppen:          'sup',
  'salat-bowl':    'sal',
  kartoffel:       'kar',
  fleisch:         'fle',
  fisch:           'fis',
  sonstige:        'son',
  'eintopf-gratin':'ein',
  reis:            'rei',
  eier:            'ei',
  ofen:            'ofe',
  asiatisch:       'asi',
  kindersnacks:    'kds',
};

// ---------------------------------------------------------------------------
// Tool-Schema (identisch zu route.ts, plus dietCategory)
// ---------------------------------------------------------------------------

const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Speichere das extrahierte Rezept in strukturiertem Format.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name:         { type: 'string', description: 'Rezeptname' },
      description:  { type: 'string', description: 'Kurze appetitliche Beschreibung (1-2 Saetze)' },
      category:     { type: 'string', enum: ['Frühstück','Snacks & Vorspeisen','Suppen, Eintöpfe & Currys','Salate & Bowls','Pasta','Reis & Getreide','Kartoffelgerichte','Fleisch & Geflügel','Fisch & Meeresfrüchte','Vegetarische Hauptgerichte','Aufläufe & Gratins','Wraps & Sandwiches','Desserts & Süsses'] },
      timeMinutes:  { type: 'number', description: 'Gesamtzeit in Minuten' },
      basePortions: { type: 'number', description: 'Anzahl Portionen' },
      weatherType:  { type: 'string', enum: ['warm','kalt','neutral'] },
      dietCategory: { type: 'string', enum: ['meat','fish','vegetarian','vegan'], description: 'meat=Fleisch, fish=Fisch, vegetarian=vegetarisch, vegan=vegan' },
      tags: {
        type: 'array',
        description: 'Passende Tags aus: Vegetarisch, Vegan, Mealprep-geeignet, Kinderfreundlich, Frühling, Sommer, Herbst, Winter, Grillgericht, Ofengericht, Mittagsgericht, Abendgericht, Schweizer, Italienisch, Asiatisch, Mexikanisch, Orientalisch',
        items: { type: 'string' },
      },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:   { type: 'string' },
            amount: { type: 'number' },
            unit:   { type: 'string', description: 'g, kg, ml, l, EL, TL, Stk, Prise, Bund, Zehe' },
          },
          required: ['name', 'amount', 'unit'],
        },
      },
      steps: {
        type: 'array',
        items: { type: 'string', description: 'Sinngemäss auf Deutsch umformuliert (nicht 1:1 kopieren)' },
      },
    },
    required: ['name','category','timeMinutes','basePortions','weatherType','tags','ingredients','steps'],
  },
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen (aus route.ts uebernommen)
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

function extractImageUrl(html: string, jsonLd: Record<string, unknown> | null): string | null {
  // 1. JSON-LD image
  if (jsonLd?.image) {
    const img = jsonLd.image;
    if (typeof img === 'string') return img;
    if (Array.isArray(img) && typeof img[0] === 'string') return img[0];
    if (typeof img === 'object' && img !== null) {
      const url = (img as Record<string, unknown>).url;
      if (typeof url === 'string') return url;
    }
  }
  // 2. og:image meta tag
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) return ogMatch[1];
  return null;
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
    const dir = path.join(RECIPES_DIR, folder);
    const prefix = FOLDER_PREFIX[folder];
    if (!prefix) continue;
    let max = 0;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const m = file.match(/^[a-z]+-(\d+)\.json$/);
      if (m) max = Math.max(max, parseInt(m[1]));
    }
    maxIds.set(folder, max);
  }
  return maxIds;
}

function nextId(folder: string, counters: Map<string, number>): string {
  const prefix = FOLDER_PREFIX[folder] ?? 'son';
  const current = counters.get(folder) ?? 0;
  const next = current + 1;
  counters.set(folder, next);
  // 'ei' prefix hat 2-stellige IDs, rest 2-stellig mit padding
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// URL-Sammlung von Listing-Seiten
// ---------------------------------------------------------------------------

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; MahlZeitPlaner/1.0; recipe-import)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'de,en;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} fuer ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`  Fetch-Fehler fuer ${url}: ${(e as Error).message}`);
    return null;
  }
}

function extractRecipeLinks(html: string): string[] {
  const links = new Set<string>();
  // Suche alle herrbuettner.de/rezepte/*-Links im HTML
  // Ausschluss: /page/, /tag/, /category/, /author/, /feed/
  const regex = /href=["'](https:\/\/herrbuettner\.de\/rezepte\/[^"'#?]+\/)["']/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = m[1];
    const path = url.replace('https://herrbuettner.de/rezepte/', '');
    // Ausschliessen: nur der root (/rezepte/) oder Pagination (/page/) oder Tags
    if (
      path === '' || path === '/' ||
      path.startsWith('page/') ||
      path.startsWith('tag/') ||
      path.startsWith('category/') ||
      path.startsWith('author/') ||
      path.startsWith('feed/')
    ) continue;
    links.add(url);
  }
  return Array.from(links);
}

async function collectAllUrls(): Promise<string[]> {
  const allUrls = new Set<string>();
  console.log('=== Phase 1: URLs sammeln ===');

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const listUrl = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
    process.stdout.write(`  Seite ${page}/${TOTAL_PAGES} fetchen...`);
    const html = await fetchHtml(listUrl);
    if (!html) { console.log(' uebersprungen'); continue; }
    const links = extractRecipeLinks(html);
    links.forEach(l => allUrls.add(l));
    console.log(` ${links.length} Links (gesamt: ${allUrls.size})`);
    await new Promise(r => setTimeout(r, 300));
  }

  return Array.from(allUrls);
}

// ---------------------------------------------------------------------------
// Rezept-Extraktion via Claude Sonnet
// ---------------------------------------------------------------------------

async function extractRecipeFromUrl(
  client: Anthropic,
  url: string,
): Promise<{ recipe: Record<string, unknown>; imageUrl: string | null } | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const jsonLd  = extractJsonLd(html);
  const imageUrl = extractImageUrl(html, jsonLd);

  let prompt: string;
  if (jsonLd) {
    prompt = `Du bist ein Rezept-Import-Assistent. Extrahiere und normalisiere die folgenden JSON-LD Rezeptdaten.

Regeln:
- Mengen in metrischen Einheiten (g, kg, ml, l, EL, TL, Stk, Prise, Bund, Zehe)
- Zubereitungsschritte SINNGEMÄSS auf Deutsch umformulieren (urheberrechtlich nicht 1:1 kopieren)
- Kategorie korrekt auswaehlen
- dietCategory: 'vegan'=keine Tierprodukte, 'vegetarian'=kein Fleisch/Fisch, 'fish'=Fisch aber kein Fleisch, 'meat'=Fleisch enthalten
- weatherType: 'warm'=leichte Sommergerichte, 'kalt'=Suppen/Eintöpfe/Gratins, 'neutral'=Rest
- Alle Zutaten vollstaendig erfassen inkl. Gewuerze, Oel, Salz, Pfeffer

JSON-LD Daten:
${JSON.stringify(jsonLd).slice(0, 5500)}`;
  } else {
    const stripped = stripHtml(html);
    if (stripped.length < 100) return null;
    prompt = `Du bist ein Rezept-Extraktor. Extrahiere das Rezept aus dem folgenden Webseitentext.
Zubereitungsschritte SINNGEMÄSS auf Deutsch umformulieren (nicht 1:1 kopieren).
Alle Zutaten vollstaendig erfassen inkl. Gewuerze, Oel, Salz, Pfeffer.

${stripped}`;
  }

  try {
    const response = await client.messages.create({
      model:       MODEL,
      max_tokens:  2048,
      tools:       [RECIPE_TOOL],
      tool_choice: { type: 'tool', name: 'save_recipe' },
      messages:    [{ role: 'user', content: prompt }],
    });

    const block = response.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return null;

    const recipe = block.input as Record<string, unknown>;

    // JSON-LD Felder als Fallback erganzen
    if (jsonLd) {
      if (!recipe.timeMinutes || recipe.timeMinutes === 0) {
        const t = parseIso8601Duration(
          (jsonLd.totalTime ?? jsonLd.cookTime ?? jsonLd.prepTime) as string,
        );
        if (t > 0) recipe.timeMinutes = t;
      }
      if (!recipe.basePortions && jsonLd.recipeYield) {
        const yld = jsonLd.recipeYield;
        const match = String(Array.isArray(yld) ? yld[0] : yld).match(/\d+/);
        if (match) recipe.basePortions = parseInt(match[0]);
      }
    }

    return { recipe, imageUrl };
  } catch (e) {
    console.warn(`  API-Fehler: ${(e as Error).message}`);
    return null;
  }
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

  // Phase 1: URLs sammeln
  const allUrls = await collectAllUrls();
  console.log(`\n  ${allUrls.length} Rezept-URLs gesammelt.\n`);

  // Bestehende IDs laden (fuer Idempotenz-Check)
  const allExistingIds = new Set<string>();
  const allExistingFiles = new Set<string>(); // filepath → true
  const subdirs = fs.readdirSync(RECIPES_DIR).filter(f =>
    fs.statSync(path.join(RECIPES_DIR, f)).isDirectory()
  );
  for (const folder of subdirs) {
    const dir = path.join(RECIPES_DIR, folder);
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const recipe = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      if (recipe.source === SOURCE) allExistingFiles.add(recipe.name?.toLowerCase() ?? '');
      allExistingIds.add(recipe.id ?? '');
    }
  }

  // ID-Zaehler initialisieren
  const idCounters = loadCurrentMaxIds();

  // Image-Manifest
  const imageManifest: Array<{ id: string; name: string; originalImageUrl: string | null; recipeUrl: string }> = [];

  // Phase 2: Rezepte importieren
  console.log('=== Phase 2: Rezepte extrahieren & importieren ===');
  let imported = 0;
  let skipped  = 0;
  let failed   = 0;

  for (let i = 0; i < allUrls.length; i++) {
    const recipeUrl = allUrls[i];
    process.stdout.write(`  [${i + 1}/${allUrls.length}] ${recipeUrl.replace('https://herrbuettner.de', '')} ...`);

    const result = await extractRecipeFromUrl(client, recipeUrl);

    if (!result) {
      console.log(' FEHLER (uebersprungen)');
      failed++;
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    const { recipe, imageUrl } = result;
    const name = (recipe.name as string) ?? '';

    // Idempotenz: ueberspringe falls Name bereits aus herrbuettner importiert
    if (allExistingFiles.has(name.toLowerCase())) {
      console.log(` uebersprungen (bereits vorhanden: "${name}")`);
      skipped++;
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    // Kategorie → Ordner → ID
    const category  = (recipe.category as Category) ?? 'Vegetarische Hauptgerichte';
    const folder    = CATEGORY_FOLDER[category] ?? 'sonstige';
    const id        = nextId(folder, idCounters);

    // Zutaten normalisieren: perPortions hinzufuegen
    const basePortions = (recipe.basePortions as number) ?? 4;
    const rawIngredients = Array.isArray(recipe.ingredients)
      ? (recipe.ingredients as Array<Record<string, unknown>>)
      : [];

    // Kein richtiges Rezept (z.B. Kategorie-Seite) → ueberspringen
    if (rawIngredients.length === 0) {
      console.log(` uebersprungen (keine Zutaten — vermutlich keine Rezept-Seite)`);
      skipped++;
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    const ingredients = rawIngredients.map(ing => ({
      name:        (ing.name        as string) ?? '',
      amount:      (ing.amount      as number) ?? 0,
      unit:        (ing.unit        as string) ?? 'Stk',
      perPortions: basePortions,
    }));

    // Allergene berechnen
    const allergens = computeAllergens({ name, ingredients });

    // Rezept-Objekt zusammenbauen
    const recipeObj = {
      id,
      name,
      category,
      timeMinutes:  (recipe.timeMinutes  as number)  ?? 30,
      basePortions,
      tags:         (recipe.tags         as string[]) ?? [],
      ingredients,
      weatherType:  (recipe.weatherType  as string)  ?? 'neutral',
      source:       SOURCE,
      description:  (recipe.description  as string)  ?? '',
      steps:        (recipe.steps        as string[]) ?? [],
      ...(recipe.tips        ? { tips:        recipe.tips        as string } : {}),
      ...(recipe.dietCategory ? { dietCategory: recipe.dietCategory as string } : {}),
      imageUrl:     imageUrl ?? null,
      imageZutaten: null,
      imageKochen:  null,
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

    allExistingFiles.add(name.toLowerCase());
    imageManifest.push({ id, name, originalImageUrl: imageUrl, recipeUrl });
    imported++;

    console.log(` OK → ${id} (${category})`);
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n  Ergebnis: ${imported} importiert, ${skipped} uebersprungen, ${failed} fehlgeschlagen.\n`);

  // Image-Manifest schreiben
  const manifestPath = path.join(__dirname, '../data/herrbuettner-image-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(imageManifest, null, 2), 'utf-8');
  console.log(`=== Image-Manifest: data/herrbuettner-image-manifest.json (${imageManifest.length} Eintraege) ===`);

  // Image-Ordner anlegen
  const imgDir = path.join(__dirname, '../public/images/recipes/herrbuettner');
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
    fs.writeFileSync(
      path.join(imgDir, 'README.txt'),
      `Bilder fuer herrbuettner.de Rezepte\n\nDateinamen: {rezept-id}.jpg  (z.B. pas-19.jpg)\nNach dem Ablegen der Bilder: imageUrl im Admin auf /images/recipes/herrbuettner/{id}.jpg setzen.\n\nAlle IDs und Original-Bild-URLs: data/herrbuettner-image-manifest.json\n`,
      'utf-8',
    );
    console.log(`=== Image-Ordner angelegt: public/images/recipes/herrbuettner/ ===`);
  }

  // Rebuild
  console.log('\n=== Rebuilde data/recipes.json ===');
  require('./build-recipes.js');
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
