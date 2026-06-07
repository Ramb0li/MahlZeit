/**
 * fix-recipes.ts
 *
 * Einmalig-Skript (one-shot) mit zwei Aufgaben:
 *  1. Setzt dietCategory auf allen Rezepten korrekt (meat | fish | vegetarian | vegan)
 *     — basierend auf Kategorie, Tags und Zutaten-Keywords.
 *  2. Ersetzt ß durch ss in allen String-Feldern (name, description, tips, source,
 *     steps, ingredients.name, ingredientGroups.[].ingredients.[].name etc.).
 *
 * Ausführen:  npx tsx scripts/fix-recipes.ts
 * Danach:     data/recipes.json + data/recipes/ committen.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Schlüsselwörter für Fleisch / Fisch ────────────────────────────────────

const MEAT_KEYWORDS = [
  // Hackfleisch / Gehacktes
  'hackfleisch', 'rindshack', 'schweinehack', 'hackbällchen', 'hackbraten',
  // Rind
  'rindsfleisch', 'rindfleisch', 'rindssteak', 'rindsfilet', 'rindsentrecote',
  // Schwein
  'schweinefleisch', 'schweinsfilet', 'schweinsloin', 'schweinskotelett',
  // Kalb
  'kalbsfleisch', 'kalbsgeschnetzeltes', 'kalbsfilet', 'kalbssteak',
  // Geflügel
  'hühnchen', 'hühnerbrustfilet', 'hähnchen', 'hähnchenbrustfilet',
  'poulet', 'pouletbrust', 'pouletschenkel',
  'entenbrust', 'putenbrustfilet', 'truthahn',
  // Lamm
  'lammfleisch', 'lammrücken', 'lammsteak', 'lammwürfel', 'lammfilet',
  // Wurstwaren / Charcuterie
  'speck', 'speckwürfel',
  'katenschinken', 'schinken', 'rohschinken',
  'leberwurst', 'bratwurst', 'brühwurst', 'bockwurst', 'cervelat',
  'salami', 'chorizo', 'cabanossi', 'wienerli',
  'aufschnitt', 'leberkäse',
  'mettenden', 'mettwurst', 'räucherwurst',
  'bacon',
  // Wild
  'wildschweinhack', 'wildschwein',
];

const FISH_KEYWORDS = [
  'lachs', 'lachsfilet',
  'thunfisch', 'thunfischfilet',
  'forelle', 'forellenfilet',
  'seelachs', 'seelachsfilet',
  'makrele',
  'garnelen',
  'anchovis', 'anchovies', 'sardellen',
  'muscheln', 'jakobsmuscheln',
  'krabben', 'scampi',
  'heilbutt', 'dorade', 'branzino',
  'kabeljau', 'kabeljaufilet',
  'meeresfrucht', 'meeresfrüchte',
];

// Kategorien
const MEAT_CATEGORY = 'Fleisch & Geflügel';
const FISH_CATEGORY = 'Fisch & Meeresfrüchte';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function replaceBeta(s: string): string {
  // eslint-disable-next-line no-control-regex
  return typeof s === 'string' ? s.replace(/ß/g, 'ss') : s;
}

function fixStrings(obj: unknown): unknown {
  if (typeof obj === 'string') return replaceBeta(obj);
  if (Array.isArray(obj)) return obj.map(fixStrings);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = fixStrings(v);
    }
    return out;
  }
  return obj;
}

function deriveDietCategory(recipe: Record<string, unknown>): 'meat' | 'fish' | 'vegetarian' | 'vegan' {
  const category = (recipe.category as string) ?? '';
  const tags     = (recipe.tags as string[]) ?? [];
  const ingrs    = (recipe.ingredients as { name: string }[]) ?? [];

  // 1. Explizite Kategorie
  if (category === MEAT_CATEGORY) return 'meat';
  if (category === FISH_CATEGORY) return 'fish';

  // 2. Tags
  if (tags.includes('Vegan')) return 'vegan';
  if (tags.includes('Vegetarisch')) return 'vegetarian';

  // 3. Zutaten-Keywords
  const ingNames = ingrs.map(i => (i.name ?? '').toLowerCase());

  if (MEAT_KEYWORDS.some(kw => ingNames.some(n => n.includes(kw)))) return 'meat';
  if (FISH_KEYWORDS.some(kw => ingNames.some(n => n.includes(kw)))) return 'fish';

  // 4. Name-Heuristik (Backup)
  const name = ((recipe.name as string) ?? '').toLowerCase();
  if (MEAT_KEYWORDS.some(kw => name.includes(kw))) return 'meat';
  if (FISH_KEYWORDS.some(kw => name.includes(kw))) return 'fish';

  // 5. Fallback — konservativ vegetarian
  return 'vegetarian';
}

// ── Verarbeitung ───────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..');

let filesChanged = 0;
let recipeCount  = 0;
let betaFixed    = 0;

const dietBreakdown: Record<string, number> = { meat: 0, fish: 0, vegetarian: 0, vegan: 0 };

function processRecipe(recipe: Record<string, unknown>, sourceLabel: string): { changed: boolean; recipe: Record<string, unknown> } {
  const original = JSON.stringify(recipe);

  // 1. ß → ss in allen Text-Feldern
  const fixed = fixStrings(recipe) as Record<string, unknown>;

  // 2. dietCategory setzen / korrigieren
  const derived = deriveDietCategory(fixed);
  const current = fixed.dietCategory as string | undefined;

  if (!current || current !== derived) {
    if (current && current !== derived) {
      console.log(`  [KORR] ${sourceLabel} → ${current} => ${derived}`);
    }
    fixed.dietCategory = derived;
  }

  dietBreakdown[derived] = (dietBreakdown[derived] ?? 0) + 1;

  const updated = JSON.stringify(fixed);
  const changed = updated !== original;
  if (changed && JSON.stringify(recipe).includes('ß')) betaFixed++;

  return { changed, recipe: fixed };
}

// ── 1. Einzel-Rezept-Dateien (data/recipes/*/*.json) ──────────────────────

const recipesDir = path.join(ROOT, 'data', 'recipes');
if (fs.existsSync(recipesDir)) {
  const subdirs = fs.readdirSync(recipesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const sub of subdirs) {
    const subDir = path.join(recipesDir, sub);
    const files  = fs.readdirSync(subDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(subDir, file);
      const raw      = fs.readFileSync(filePath, 'utf-8');
      let recipe: Record<string, unknown>;
      try { recipe = JSON.parse(raw); } catch { console.warn('Parse-Fehler:', filePath); continue; }

      const { changed, recipe: updated } = processRecipe(recipe, `${sub}/${file}`);
      recipeCount++;

      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
        filesChanged++;
      }
    }
  }
}

// ── 2. Haupt-Seed-Datei (data/recipes.json) ───────────────────────────────

const seedPath = path.join(ROOT, 'data', 'recipes.json');
if (fs.existsSync(seedPath)) {
  const raw   = fs.readFileSync(seedPath, 'utf-8');
  let recipes: Record<string, unknown>[];
  try { recipes = JSON.parse(raw); } catch { console.warn('Parse-Fehler: data/recipes.json'); recipes = []; }

  let seedChanged = false;
  const updatedSeed = recipes.map(recipe => {
    const { changed, recipe: updated } = processRecipe(recipe, `recipes.json:${recipe.id}`);
    recipeCount++;
    if (changed) seedChanged = true;
    return updated;
  });

  if (seedChanged) {
    fs.writeFileSync(seedPath, JSON.stringify(updatedSeed, null, 2) + '\n', 'utf-8');
    filesChanged++;
    console.log('data/recipes.json aktualisiert');
  }
}

// ── Ergebnis ──────────────────────────────────────────────────────────────

console.log('\n── fix-recipes abgeschlossen ──────────────────────────────');
console.log(`Rezepte gesamt:  ${recipeCount}`);
console.log(`Dateien geändert: ${filesChanged}`);
console.log(`ß-Vorkommen ersetzt (grob): ${betaFixed} Dateien`);
console.log('Ernährungs-Verteilung:');
for (const [k, v] of Object.entries(dietBreakdown)) {
  console.log(`  ${k.padEnd(12)} ${v}`);
}
console.log('\nNicht vergessen: data/ committen.\n');
