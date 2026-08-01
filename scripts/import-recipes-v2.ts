/**
 * import-recipes-v2.ts
 *
 * Verarbeitet manuell kuratierte Quell-URLs zu vollständigen MahlZyt-Rezepten
 * im Entwurfsstatus (approved: false).
 *
 * Ausführen:      npm run recipes:import-v2
 * Voraussetzung:  ANTHROPIC_API_KEY in .env.local
 * Danach:         npm run recipes:build && npm run recipes:enrich
 *
 * ── ABRUF-DISZIPLIN ───────────────────────────────────────────────────────────
 * KEIN Crawling. Keine Kategorie-Listen, keine Sitemap, keine Link-Verfolgung.
 * Verarbeitet werden ausschliesslich die in data/import-queue.json genannten URLs.
 * Die Auswahl trifft ein Mensch, und das ist bewusst so.
 * Sequenziell, kein paralleler Abruf, mindestens 10 Sekunden Pause zwischen zwei
 * Requests (fooby.ch robots.txt: "Crawl-delay: 10").
 * Der Roh-HTML wird nie auf Platte geschrieben.
 *
 * ── ARBEITSTEILUNG ────────────────────────────────────────────────────────────
 * Deterministisch (scripts/import-utils.ts): Allergene, Einheiten, Diätform,
 *   Tags, Duplikat-Check, Schema-Validierung, Zutaten-Aufbau.
 * Sprachmodell (claude-sonnet-5): Neuformulierung, Anreicherung, Kategorisierung.
 *
 * ── EIGENSTÄNDIGKEIT ──────────────────────────────────────────────────────────
 * Dem Modell werden weder der Originalname noch die Original-Beschreibung noch
 * der Zubereitungstext gezeigt. Es bekommt Zutaten, Mengen, Zeiten, Temperaturen
 * und einen Stichwort-Ablauf — also Fakten. Daraus schreibt es die Anleitung neu.
 * Das ist der Unterschied zwischen Bearbeitung und Neufassung, und er entsteht
 * hier im Prompt, nicht im Nachhinein.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { TAG_GROUPS } from '../src/types/index';
import type { Category, DietCategory } from '../src/types/index';
import { computeAllergens } from './allergen-utils';
import {
  ALLOWED_UNITS, extractStepKeywords, extractTimes, extractTemperatures,
  resolveDietCategory, validateTags, mainIngredientTokens, findDuplicate, slugify,
  buildIngredients, isValidCategory, assertValidRecipe, stripMarkupTail,
  type RawGroup, type DuplicateCandidate,
} from './import-utils';

// ---------------------------------------------------------------------------
// Dotenv
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

const MODEL        = 'claude-sonnet-5';
const RECIPES_DIR  = path.join(__dirname, '../data/recipes');
const QUEUE_PATH   = path.join(__dirname, '../data/import-queue.json');
const REPORT_PATH  = path.join(__dirname, '../data/import-report-v2.json');
const REFERENZ_DIR = path.join(__dirname, '../../Menüs/Referenz/Fooby');
const CRAWL_DELAY_MS = 10_000;   // robots.txt: Crawl-delay: 10

// Grosszügig bemessen: ein Rezept mit mehreren Zutatengruppen und ausformulierten
// Schritten kam bei 4000 Tokens gelegentlich ins Abschneiden, wodurch das Tool-JSON
// unvollständig zurückkam.
const MAX_TOKENS = 8000;

const FOLDER_PREFIX: Record<string, string> = {
  pasta: 'pas', suppen: 'sup', 'salat-bowl': 'sal', kartoffel: 'kar',
  fleisch: 'fle', fisch: 'fis', sonstige: 'son', 'eintopf-gratin': 'ein',
  reis: 'rei', eier: 'ei', ofen: 'ofe', asiatisch: 'asi', kindersnacks: 'kds',
};

const CATEGORY_FOLDER: Record<string, string> = {
  'Fleisch & Geflügel': 'fleisch',
  'Fisch & Meeresfrüchte': 'fisch',
  'Salate & Bowls': 'salat-bowl',
  'Snacks & Vorspeisen': 'sonstige',
  'Wraps, Sandwiches & Burger': 'sonstige',
  'Pizza, Flammkuchen, Wähen & Quiches': 'sonstige',
  'Beilagen, Saucen & Dips': 'sonstige',
  'Gemüsegerichte': 'sonstige',
  'Suppen, Eintöpfe & Currys': 'suppen',
  'Pasta & Teigwaren': 'pasta',
  'Reis, Getreide & Hülsenfrüchte': 'reis',
  'Kartoffelgerichte': 'kartoffel',
  'Aufläufe & Gratins': 'eintopf-gratin',
  'Eiergerichte': 'eier',
  'Desserts & Süsses': 'sonstige',
  'Brot & Gebäck': 'sonstige',
  'Müesli, Porridge & Frühstücksschalen': 'sonstige',
  'Getränke & Smoothies': 'sonstige',
};

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

interface QueueEntry { url: string; zielkategorie: Category }

const QUEUE_TEMPLATE: QueueEntry[] = [
  { url: 'https://fooby.ch/de/rezepte/14229/lasagne-al-forno', zielkategorie: 'Pasta & Teigwaren' },
];

function loadQueue(): QueueEntry[] | null {
  if (!fs.existsSync(QUEUE_PATH)) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(QUEUE_TEMPLATE, null, 2) + '\n', 'utf-8');
    console.error(
      '\ndata/import-queue.json fehlte und wurde als Beispiel-Gerüst angelegt.\n' +
      'Trage die kuratierten URLs samt zielkategorie ein und starte erneut.\n' +
      'Die Auswahl erfolgt bewusst manuell — dieses Script crawlt nicht.\n',
    );
    return null;
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')) as QueueEntry[];
  if (!Array.isArray(queue) || queue.length === 0) {
    console.error('data/import-queue.json ist leer.');
    return null;
  }

  queue.forEach((e, i) => {
    if (!e.url?.startsWith('https://')) {
      throw new Error(`Queue-Eintrag ${i}: url fehlt oder ist nicht https.`);
    }
    if (!isValidCategory(e.zielkategorie)) {
      throw new Error(`Queue-Eintrag ${i}: zielkategorie "${e.zielkategorie}" ist keine gültige Category.`);
    }
  });

  return queue;
}

// ---------------------------------------------------------------------------
// Stufe A — Abruf + JSON-LD
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
      for (const obj of Array.isArray(parsed) ? parsed : [parsed]) {
        if (isRecipeType(obj)) return obj;
        if (obj?.['@graph'] && Array.isArray(obj['@graph'])) {
          const found = (obj['@graph'] as unknown[]).find(isRecipeType);
          if (found) return found as Record<string, unknown>;
        }
      }
    } catch { /* defektes JSON-LD überspringen */ }
  }
  return null;
}

function parseIso8601Duration(d: unknown): number {
  if (!d || typeof d !== 'string') return 0;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(d);
  if (!m) return 0;
  return parseInt(m[1] ?? '0') * 60 + parseInt(m[2] ?? '0');
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; MahlZytPlaner/1.0; recipe-import)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'de-CH,de;q=0.9',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) { console.warn(`    HTTP ${res.status}`); return null; }
    return await res.text();
  } catch (e) {
    console.warn(`    Fetch-Fehler: ${(e as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stufe B — Faktenextraktion (kein LLM)
// ---------------------------------------------------------------------------

/** Genau diese Fakten sieht das Modell — und sonst nichts aus der Quelle. */
interface RecipeFacts {
  zutaten:        string[];
  ablaufStichworte: string[];
  zeiten:         string[];
  temperaturen:   string[];
  gesamtzeitMin:  number;
  portionen:      number;
  quellKategorie: string;
  quellKueche:    string;
}

function extractFacts(jsonLd: Record<string, unknown>): RecipeFacts {
  const instructions = Array.isArray(jsonLd.recipeInstructions)
    ? (jsonLd.recipeInstructions as unknown[]).map(s =>
        typeof s === 'string' ? s : String((s as Record<string, unknown>)?.text ?? ''))
    : [];

  const yieldRaw = String(
    Array.isArray(jsonLd.recipeYield) ? jsonLd.recipeYield[0] : jsonLd.recipeYield ?? '',
  );
  const portionen = parseInt(yieldRaw.match(/\d+/)?.[0] ?? '4') || 4;

  return {
    zutaten:          Array.isArray(jsonLd.recipeIngredient) ? jsonLd.recipeIngredient as string[] : [],
    ablaufStichworte: extractStepKeywords(instructions),
    zeiten:           extractTimes(instructions),
    temperaturen:     extractTemperatures(instructions),
    gesamtzeitMin:    parseIso8601Duration(jsonLd.totalTime ?? jsonLd.cookTime ?? jsonLd.prepTime),
    portionen,
    quellKategorie:   String(jsonLd.recipeCategory ?? ''),
    quellKueche:      String(jsonLd.recipeCuisine ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Stufe C — Sonnet
// ---------------------------------------------------------------------------

const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Speichere das neu verfasste Rezept in strukturiertem Format.',
  input_schema: {
    type: 'object' as const,
    properties: {
      // Bewusst NICHT "name": im ersten Produktivlauf fehlte das Feld in 15 von 45
      // Antworten, während alle übrigen Felder ankamen. Gleichzeitig schlug in zwei
      // Fällen die Zeichenfolge <parameter name="..."> in einen Textwert durch.
      // Beides deutet auf eine Kollision des Feldnamens "name" mit dem name-Attribut
      // der Tool-Serialisierung. Mit einem eindeutigen Schlüssel tritt das nicht auf.
      rezeptTitel: {
        type: 'string',
        description:
          'NEUER, eigenständiger Rezeptname auf Deutsch. Beschreibend nach den Hauptkomponenten, ' +
          'z.B. "Spiegeleier mit Rahmspinat und Bratkartoffeln". Keine Fantasienamen, keine ' +
          'englischen Begriffe, keine Superlative.',
      },
      description: {
        type: 'string',
        description:
          '1 bis 3 Sätze, warm und persönlich, gern mit einer Alltagsbeobachtung. ' +
          'Kein Marketing, keine Superlative, keine Werbesprache.',
      },
      category:     { type: 'string', enum: Object.keys(CATEGORY_FOLDER) },
      dietCategory: { type: 'string', enum: ['meat', 'fish', 'vegetarian', 'vegan'] },
      weatherType: {
        type: 'string',
        enum: ['warm', 'kalt', 'neutral'],
        description:
          'Zu welchem Wetter passt das Gericht? "kalt" = passt zu kaltem Wetter ' +
          '(Eintopf, Gratin, Suppe, Deftiges). "warm" = passt zu heissem Wetter ' +
          '(Salat, Kaltes, Leichtes). "neutral" = ganzjährig unauffällig.',
      },
      timeMinutes:  { type: 'number', description: 'Gesamtzeit in Minuten inkl. Warte- und Backzeiten.' },
      basePortions: { type: 'number', description: 'Anzahl Portionen.' },
      tags: {
        type: 'array',
        items: { type: 'string', enum: Object.values(TAG_GROUPS).flatMap(g => [...g]) },
        description:
          'Mindestens ein Tag aus Mahlzeit, mindestens einer aus Zubereitung, mindestens einer ' +
          'aus Saison, genau einer aus Küche sofern zuordenbar, dazu passende aus Planung. ' +
          '"Ganzjährig" nur wenn das Gericht wirklich saisonneutral ist.',
      },
      ingredientGroups: {
        type: 'array',
        description:
          'Eine Gruppe je Komponente des Gerichts. Bei einkomponentigen Rezepten genau eine Gruppe. ' +
          'Zutaten, die in mehreren Komponenten vorkommen (Olivenöl, Salz), in JEDER Gruppe wiederholen.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Exakt im Muster "Zutaten für <Komponente>", z.B. "Zutaten für Bratkartoffeln".',
            },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name:   { type: 'string', description: 'Schweizer Begriffe: Rüebli, Peperoni, Rahm, Poulet.' },
                  amount: { type: 'number' },
                  unit:   { type: 'string', enum: [...ALLOWED_UNITS] },
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
        items: { type: 'string' },
        description:
          'Vollständige Sätze, ein Arbeitsschritt pro Array-Eintrag, chronologisch. ' +
          'OHNE Nummerierungspräfix ("1.", "Schritt 1:"). Mit konkreten Zeiten und Temperaturen.',
      },
      tips: { type: 'string', description: 'Optionaler Tipp zu Variation, Aufbewahrung oder Beilage.' },
    },
    required: [
      'rezeptTitel', 'description', 'category', 'dietCategory', 'weatherType',
      'timeMinutes', 'basePortions', 'tags', 'ingredientGroups', 'steps',
    ],
  },
};

function buildPrompt(facts: RecipeFacts, zielkategorie: Category): string {
  return `Du schreibst ein Rezept für MahlZyt, einen Schweizer Menüplaner für Familien und WGs.

Du bekommst ausschliesslich FAKTEN: Zutatenliste, Mengen, Zeiten, Temperaturen und einen
Stichwort-Ablauf. Du bekommst bewusst KEINEN Originaltext. Schreibe die Zubereitung aus
diesen Fakten und deinem Kochwissen komplett selbst — nicht umformulieren, sondern verfassen.

SPRACHE — Schweizer Hochdeutsch, immer "ss" statt "ß":
Rüebli (nicht Karotte), Peperoni (nicht Paprikaschote), Rahm oder Nidel (nicht Sahne),
Poulet (nicht Hähnchen), andämpfen, beigeben, geniessen, anschliessend, Pfanne, Backofen.

STIL DER BESCHREIBUNG:
1 bis 3 Sätze, warm und persönlich, gern mit einer Alltagsbeobachtung — so wie jemand,
der das Gericht wirklich kocht, es einem Freund beschreiben würde. Kein Marketing,
keine Superlative, kein "unwiderstehlich" oder "perfekt".

STIL DER SCHRITTE:
Vollständige Sätze, ein Arbeitsschritt pro Eintrag, chronologisch, ohne Nummerierung.
Konkrete Zeiten und Temperaturen nennen. Anfänger sollen dem Ablauf folgen können.

rezeptTitel — PFLICHTFELD, niemals leer lassen:
Ein neuer, eigenständiger Name, der die Hauptkomponenten beschreibt.
Beispiel für den gewünschten Zuschnitt: "Spiegeleier mit Rahmspinat und Bratkartoffeln".

Benenne nach dem, was tatsächlich im Topf ist — Hauptzutat, Beilage, prägende Sauce.
Ein gängiger Gerichtsname allein (etwa "Safranrisotto") ist zu dünn: er beschreibt das
Gericht nicht, sondern benennt nur die Sorte. Führe mindestens zwei tragende
Komponenten auf, so wie es das Beispiel oben tut.

TAGS — nur exakt die Werte aus der Enum-Liste des Tool-Schemas:
Erfinde keine Tags und verwende keine sinngemäss passenden Eigenschöpfungen.
Die Ernährungsform gehört NICHT in die Tags — dafür gibt es das Feld dietCategory.
Also kein "Vegetarisch", "Vegan", "Fleischhaltig", "Schnell" oder "Glutenfrei" in tags.
Erlaubte Werte, nach Gruppen:
- Mahlzeit: ${TAG_GROUPS.Mahlzeit.join(', ')}
- Planung: ${TAG_GROUPS.Planung.join(', ')}
- Zubereitung: ${TAG_GROUPS.Zubereitung.join(', ')}
- Saison: ${TAG_GROUPS.Saison.join(', ')}
- Küche: ${TAG_GROUPS.Küche.join(', ')}

SAISON — nicht ausweichen:
"Ganzjährig" ist die Ausnahme, nicht der Standard. Setze es NUR, wenn wirklich jede
Hauptzutat das ganze Jahr über in guter Qualität verfügbar ist.
Richte dich nach den Hauptzutaten, nicht nach dem Gefühl:
- Spargel, Bärlauch, Kohlrabi, Frühkartoffeln, Radiesli -> Frühling
- Tomaten, Zucchetti, Auberginen, Peperoni, Beeren, Bohnen -> Sommer
- Kürbis, Federkohl, Pilze, Trauben, Zwetschgen, Wirz -> Herbst
- Rosenkohl, Lauch, Randen, Sellerie, Chicorée, Nüsslisalat -> Winter
Mehrere Saison-Tags sind erlaubt (z.B. Herbst und Winter). "Ganzjährig" darf NIE
zusammen mit einer konkreten Saison stehen — entscheide dich.

WETTERTYP — ebenfalls nicht ausweichen:
"kalt" heisst: das Gericht passt an einen KALTEN Tag. Suppen, Eintöpfe, Currys,
Gratins, Aufläufe, Geschmortes und alles Deftige gehören hierher.
"warm" heisst: passt an einen HEISSEN Tag — Salate, Kaltes, Leichtes, Bowls.
"neutral" ist nur für Gerichte, die wirklich zu jedem Wetter passen. Wähle es nicht
aus Bequemlichkeit: ein Gratin ist nie neutral, eine Suppe auch nicht.

KATEGORIE: ${zielkategorie}

ZUTATEN (Originalangaben der Quelle):
${facts.zutaten.map(z => `- ${z}`).join('\n')}

ABLAUF ALS STICHWORTE (chronologisch): ${facts.ablaufStichworte.join(' → ') || '(keine erkannt)'}
ZEITANGABEN: ${facts.zeiten.join(', ') || '(keine)'}
TEMPERATUREN: ${facts.temperaturen.join(', ') || '(keine)'}
GESAMTZEIT LAUT QUELLE: ${facts.gesamtzeitMin || '?'} Minuten
PORTIONEN LAUT QUELLE: ${facts.portionen}
GERICHTSART LAUT QUELLE: ${facts.quellKategorie || '(keine)'}
KÜCHE LAUT QUELLE: ${facts.quellKueche || '(keine)'}

Gliedere die Zutaten in Gruppen je Komponente, benannt "Zutaten für <Komponente>".
Wiederhole gemeinsame Zutaten wie Olivenöl oder Salz in jeder Gruppe, in der sie gebraucht werden.`;
}

// ---------------------------------------------------------------------------
// ID-Verwaltung
// ---------------------------------------------------------------------------

function loadMaxIds(): Map<string, number> {
  const maxIds = new Map<string, number>();
  for (const folder of fs.readdirSync(RECIPES_DIR)) {
    const dir = path.join(RECIPES_DIR, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
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
  const prefix = FOLDER_PREFIX[folder] ?? 'son';
  const next   = (counters.get(folder) ?? 0) + 1;
  counters.set(folder, next);
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Bestand + Duplikat-Index
// ---------------------------------------------------------------------------

function loadExisting(): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (const folder of fs.readdirSync(RECIPES_DIR)) {
    const dir = path.join(RECIPES_DIR, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as Record<string, unknown>;
        const names = ((r.ingredients as { name: string }[]) ?? []).map(i => i.name);
        out.push({ id: String(r.id), name: String(r.name), tokens: mainIngredientTokens(names) });
      } catch { /* defekte Datei überspringen */ }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stufe G — Bildreferenz (ausserhalb des Repos)
// ---------------------------------------------------------------------------

interface ManifestEntry {
  slug: string; rezeptId: string; neuerName: string;
  quellUrl: string; bildUrl: string; geladenAm: string;
}

async function saveReferenceImage(
  bildUrl: string, slug: string, rezeptId: string, neuerName: string, quellUrl: string,
): Promise<string | null> {
  try {
    fs.mkdirSync(REFERENZ_DIR, { recursive: true });
    const res = await fetch(bildUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(REFERENZ_DIR, `${slug}.jpg`), buf);

    const manifestPath = path.join(REFERENZ_DIR, '_manifest.json');
    const manifest: ManifestEntry[] = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      : [];
    manifest.push({
      slug, rezeptId, neuerName, quellUrl, bildUrl, geladenAm: new Date().toISOString(),
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    return `${slug}.jpg`;
  } catch (e) {
    console.warn(`    Referenzbild fehlgeschlagen: ${(e as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

interface ReportEntry {
  url: string;
  originalTitle: string;
  neuerName?: string;
  id?: string;
  kategorie?: string;
  status: 'ok' | 'skipped' | 'failed';
  warnungen: string[];
  duplicateOf?: string;
  faktenAuszug?: RecipeFacts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const queue = loadQueue();
  if (!queue) process.exit(0);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY nicht gesetzt.'); process.exit(1); }

  const client     = new Anthropic({ apiKey });
  const idCounters = loadMaxIds();
  const existing   = loadExisting();
  const report: ReportEntry[] = [];

  console.log(`\n=== Import v2 — ${queue.length} URLs, Modell ${MODEL} ===`);
  console.log(`=== Crawl-delay ${CRAWL_DELAY_MS / 1000}s, sequenziell ===\n`);

  for (let i = 0; i < queue.length; i++) {
    const { url, zielkategorie } = queue[i];
    console.log(`[${i + 1}/${queue.length}] ${url}`);

    if (i > 0) await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));

    const html = await fetchHtml(url);
    if (!html) {
      report.push({ url, originalTitle: '?', status: 'failed', warnungen: ['Abruf fehlgeschlagen'] });
      continue;
    }

    const jsonLd = extractJsonLd(html);
    if (!jsonLd) {
      report.push({ url, originalTitle: '?', status: 'failed', warnungen: ['Kein Recipe-JSON-LD gefunden'] });
      console.log('    kein JSON-LD → übersprungen');
      continue;
    }

    const originalTitle = String(jsonLd.name ?? '?');
    const facts         = extractFacts(jsonLd);
    const warnungen: string[] = [];

    if (facts.zutaten.length === 0) {
      report.push({ url, originalTitle, status: 'failed', warnungen: ['Keine Zutaten im JSON-LD'], faktenAuszug: facts });
      console.log('    keine Zutaten → übersprungen');
      continue;
    }

    // ── Stufe C: Sonnet ──────────────────────────────────────────────────────
    let model: Record<string, unknown>;
    try {
      const response = await client.messages.create({
        model:       MODEL,
        max_tokens:  MAX_TOKENS,
        tools:       [RECIPE_TOOL],
        tool_choice: { type: 'tool', name: 'save_recipe' },
        messages:    [{ role: 'user', content: buildPrompt(facts, zielkategorie) }],
      });

      // Bei abgeschnittener Antwort ist das Tool-JSON unvollständig — dann fehlen
      // einzelne Felder stillschweigend. Lieber hier hart abbrechen als einen
      // halben Datensatz weiterreichen.
      if (response.stop_reason === 'max_tokens') {
        throw new Error(`Antwort bei ${MAX_TOKENS} Tokens abgeschnitten — Limit erhöhen.`);
      }

      const block = response.content.find(b => b.type === 'tool_use');
      if (!block || block.type !== 'tool_use') {
        throw new Error(`Keine Tool-Antwort (stop_reason: ${response.stop_reason}).`);
      }
      model = block.input as Record<string, unknown>;
    } catch (e) {
      report.push({ url, originalTitle, status: 'failed', warnungen: [`Modell: ${(e as Error).message}`], faktenAuszug: facts });
      console.log(`    Modellfehler → übersprungen`);
      continue;
    }

    try {
      // ── Stufe D: deterministische Nachbearbeitung ─────────────────────────
      // Fallback auf 'name' nur zur Sicherheit — das Feld heisst jetzt rezeptTitel.
      const neuerName = String(model.rezeptTitel ?? model.name ?? '').trim();
      if (!neuerName) {
        // Diagnose statt Rätselraten: welche Felder kamen überhaupt zurück?
        throw new Error(
          `Modell lieferte keinen Titel. Gelieferte Felder: ${Object.keys(model).join(', ') || '(keine)'}`,
        );
      }

      // Vorgabe aus der Queue gewinnt immer.
      const modelCategory = String(model.category ?? '');
      if (modelCategory && modelCategory !== zielkategorie) {
        warnungen.push(`Modell schlug "${modelCategory}" vor, Vorgabe "${zielkategorie}" gewinnt.`);
      }
      const category = zielkategorie;

      const basePortions = Number(model.basePortions) || facts.portionen || 4;

      const { ingredientGroups, ingredients } = buildIngredients(
        model.ingredientGroups as RawGroup[], basePortions,
      );

      const dietCategory = resolveDietCategory(
        ingredients.map(i => i.name), model.dietCategory as DietCategory | undefined,
      );
      if (model.dietCategory && model.dietCategory !== dietCategory) {
        warnungen.push(`dietCategory: Modell sagte "${model.dietCategory}", Zutaten-Scan ergab "${dietCategory}".`);
      }

      const { tags, warnings: tagWarnings } = validateTags(model.tags);
      warnungen.push(...tagWarnings);

      // Serialisierungs-Artefakt am Textende abschneiden, falls vorhanden.
      // Bleibt kein vollständiger Satz übrig, schlägt die Schema-Prüfung zu.
      const rohBeschreibung = String(model.description ?? '').trim();
      const beschreibung = stripMarkupTail(rohBeschreibung) ?? rohBeschreibung;
      if (beschreibung !== rohBeschreibung) {
        warnungen.push('Beschreibung: Tool-Syntax am Ende entfernt.');
      }

      // ── Stufe E: Duplikat-Check ──────────────────────────────────────────
      const tokens = mainIngredientTokens(ingredients.map(i => i.name));
      const dup    = findDuplicate(tokens, existing);
      if (dup) {
        const pct = Math.round(dup.similarity * 100);
        report.push({
          url, originalTitle, neuerName, kategorie: category, status: 'skipped', warnungen,
          duplicateOf: `${dup.match.id} (${dup.match.name}) — ${pct}% Zutaten-Übereinstimmung`,
          faktenAuszug: facts,
        });
        console.log(`    Duplikat von ${dup.match.id} "${dup.match.name}" (${pct}%) → übersprungen`);
        continue;
      }

      const folder = CATEGORY_FOLDER[category] ?? 'sonstige';
      const id     = nextId(folder, idCounters);

      const recipe: Record<string, unknown> = {
        id,
        name:         neuerName,
        category,
        timeMinutes:  Number(model.timeMinutes) || facts.gesamtzeitMin || 30,
        basePortions,
        weatherType:  String(model.weatherType ?? 'neutral'),
        dietCategory,
        description:  beschreibung,
        tags,
        ingredients,
        ingredientGroups,
        steps:        (model.steps as string[]) ?? [],
        ...(model.tips ? { tips: String(model.tips) } : {}),
        source:        'fooby.ch',
        sourceUrl:     url,
        sourceType:    'imported',
        licenseStatus: 'adapted',
        rewrittenAt:   new Date().toISOString(),
        approved:          false,   // ausnahmslos
        suggestionEnabled: true,
        imageUrl:      null,        // niemals ein Fremdbild
        imageZutaten:  null,
        imageKochen:   null,
        allergens:     computeAllergens({ name: neuerName, ingredients }),
        // nutrition bewusst nicht gesetzt — kommt aus npm run recipes:enrich
      };

      // ── Stufe F: Schema-Validierung ──────────────────────────────────────
      assertValidRecipe(recipe);

      // ── Stufe G: Bildreferenz ausserhalb des Repos ───────────────────────
      const bildUrl = typeof jsonLd.image === 'string'
        ? jsonLd.image
        : Array.isArray(jsonLd.image) ? String(jsonLd.image[0]) : '';
      if (bildUrl) {
        const saved = await saveReferenceImage(bildUrl, slugify(neuerName), id, neuerName, url);
        if (!saved) warnungen.push('Referenzbild konnte nicht geladen werden.');
      } else {
        warnungen.push('Kein Bild im JSON-LD gefunden.');
      }

      // ── Schreiben ────────────────────────────────────────────────────────
      const dir = path.join(RECIPES_DIR, folder);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(recipe, null, 2), 'utf-8');

      existing.push({ id, name: neuerName, tokens });
      report.push({
        url, originalTitle, neuerName, id, kategorie: category,
        status: 'ok', warnungen, faktenAuszug: facts,
      });
      console.log(`    OK → ${id} "${neuerName}"${warnungen.length ? ` (${warnungen.length} Warnung(en))` : ''}`);

    } catch (e) {
      report.push({
        url, originalTitle, status: 'failed',
        warnungen: [...warnungen, (e as Error).message], faktenAuszug: facts,
      });
      console.log(`    FEHLER: ${(e as Error).message}`);
    }
  }

  const ok      = report.filter(r => r.status === 'ok').length;
  const skipped = report.filter(r => r.status === 'skipped').length;
  const failed  = report.filter(r => r.status === 'failed').length;

  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    date: new Date().toISOString(), model: MODEL,
    total: queue.length, imported: ok, skipped, failed,
    recipes: report,
  }, null, 2), 'utf-8');

  console.log(`\n=== ${ok} importiert, ${skipped} übersprungen, ${failed} fehlgeschlagen ===`);
  console.log(`=== Report: data/import-report-v2.json ===`);
  console.log(`=== Alle Rezepte sind Entwürfe (approved: false) ===\n`);
  console.log('Nächste Schritte: npm run recipes:build && npm run recipes:enrich\n');
}

main().catch(err => { console.error('Unerwarteter Fehler:', err); process.exit(1); });
