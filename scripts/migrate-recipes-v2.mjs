#!/usr/bin/env node
/**
 * migrate-recipes-v2.mjs
 *
 * Migrates individual recipe source files in data/recipes/**\/*.json
 * to the new Category / Tag schema (v2). Idempotent via _migrated_v2 flag.
 *
 * Usage:
 *   node scripts/migrate-recipes-v2.mjs            # write changes + rebuild
 *   node scripts/migrate-recipes-v2.mjs --dry-run  # preview only
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = path.join(__dirname, '../data/recipes');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Category renames ────────────────────────────────────────────────────────

const CAT_MAP = {
  'Pasta':                      'Pasta & Teigwaren',
  'Reis & Getreide':            'Reis, Getreide & Hülsenfrüchte',
  'Wraps & Sandwiches':         'Wraps, Sandwiches & Burger',
  'Vegetarische Hauptgerichte': null, // handled via heuristic
  'Eigene Rezepte':             'Gemüsegerichte',
  'Frühstück':                  null, // handled via heuristic
};

// ─── Heuristic category assignment ──────────────────────────────────────────

const EGG_WORDS    = ['ei', 'eier', 'omelette', 'omelett', 'frittata', 'rührei', 'spiegelei', 'shakshuka', 'quiche'];
const MUESLI_WORDS = ['müesli', 'muesli', 'porridge', 'granola', 'bircher', 'oatmeal', 'haferflocken', 'overnight oats'];
const SMOOTHIE_WORDS = ['smoothie', 'shake'];

function heuristicCatForFreuhstueck(name, tags) {
  const n = name.toLowerCase();
  if (EGG_WORDS.some(w => n.includes(w))) return 'Eiergerichte';
  if (MUESLI_WORDS.some(w => n.includes(w))) return 'Müesli, Porridge & Frühstücksschalen';
  if (SMOOTHIE_WORDS.some(w => n.includes(w))) return 'Getränke & Smoothies';
  return 'Eiergerichte'; // safe default: Frühstück folder = mostly egg dishes
}

function heuristicCatForVegetarisch(name) {
  const n = name.toLowerCase();
  if (EGG_WORDS.some(w => n.includes(w)))                                              return 'Eiergerichte';
  if (['pasta','nudel','spaghetti','lasagne','gnocchi','tagliatelle','spätzle','penne','rigatoni','fusilli','linguine'].some(w => n.includes(w))) return 'Pasta & Teigwaren';
  if (['risotto','couscous','quinoa','linsen','kichererbsen','bulgur','dinkel','hirse',' reis','polenta'].some(w => n.includes(w))) return 'Reis, Getreide & Hülsenfrüchte';
  if (['pizza','flammkuchen','wähe','quiche'].some(w => n.includes(w)))                return 'Pizza, Flammkuchen, Wähen & Quiches';
  if (['auflauf','gratin'].some(w => n.includes(w)))                                   return 'Aufläufe & Gratins';
  if (['suppe','eintopf','curry'].some(w => n.includes(w)))                            return 'Suppen, Eintöpfe & Currys';
  if (['kartoffel','rösti','bratkartoffel'].some(w => n.includes(w)))                  return 'Kartoffelgerichte';
  if (['salat','bowl'].some(w => n.includes(w)))                                       return 'Salate & Bowls';
  return null; // manual review needed
}

// ─── Tag renames / removals ──────────────────────────────────────────────────

const TAG_RENAMES = {
  'Schweizer':        'Schweizerisch',
  'Orientalisch':     'Nahöstlich',
  'Frühstücksgericht': 'Frühstück',
  'Mittagsgericht':   'Mittagessen',
  'Abendgericht':     'Abendessen',
  'Abendsgericht':    'Abendessen',
  'Winterzeit':       'Winter',
  'Sommergericht':    'Sommer',
};

const REMOVE_TAGS = new Set([
  'Schnell und einfach', 'Schnell zubereitet', 'Schnell', 'Einfach',
  'Fisch', 'Fleischhaltig', 'Pescetarisch', 'Vegetarisch', 'Vegan',
]);

// Valid new categories for validation
const VALID_CATS = new Set([
  'Snacks & Vorspeisen', 'Suppen, Eintöpfe & Currys', 'Salate & Bowls',
  'Pasta & Teigwaren', 'Reis, Getreide & Hülsenfrüchte', 'Kartoffelgerichte',
  'Eiergerichte', 'Fleisch & Geflügel', 'Fisch & Meeresfrüchte', 'Gemüsegerichte',
  'Aufläufe & Gratins', 'Wraps, Sandwiches & Burger', 'Pizza, Flammkuchen, Wähen & Quiches',
  'Beilagen, Saucen & Dips', 'Desserts & Süsses', 'Brot & Gebäck',
  'Müesli, Porridge & Frühstücksschalen', 'Getränke & Smoothies',
]);

// Decode literal \uXXXX sequences that snuck into string values (data quality issue)
function decodeUnicodeEscapes(str) {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ─── Process a single recipe ─────────────────────────────────────────────────

const SEASON_TAGS = new Set(['Frühling', 'Sommer', 'Herbst', 'Winter']);

function migrateRecipe(r, stats) {
  if (r._migrated_v2) { stats.skipped++; return r; }

  let category = decodeUnicodeEscapes(r.category ?? '');
  let tags = [...(r.tags ?? [])];

  // 1. Category migration
  if (CAT_MAP[category] !== undefined) {
    if (CAT_MAP[category] === null) {
      if (category === 'Frühstück') {
        const newCat = heuristicCatForFreuhstueck(r.name, tags);
        category = newCat;
        if (!tags.includes('Frühstück') && !tags.includes('Frühstücksgericht')) {
          tags = [...tags, 'Frühstück'];
        }
        stats.heuristic++;
      } else {
        // Vegetarische Hauptgerichte
        const newCat = heuristicCatForVegetarisch(r.name);
        if (newCat) {
          category = newCat;
          stats.heuristic++;
        } else {
          category = 'Gemüsegerichte';
          stats.reviewNeeded.push({ id: r.id, name: r.name, origCat: r.category });
          stats.heuristic++;
        }
      }
    } else {
      category = CAT_MAP[category];
      stats.direct++;
    }
  } else if (VALID_CATS.has(category)) {
    stats.direct++;
  } else {
    stats.errors.push({ id: r.id, name: r.name, category });
    stats.direct++;
  }

  // 2. sourceType
  const sourceType = r.sourceType ?? 'mahlzyt';

  // 3. Tag renames / removals
  const renamedTags = tags
    .filter(t => !REMOVE_TAGS.has(t))
    .map(t => TAG_RENAMES[t] ?? t);
  tags = renamedTags.filter((t, i) => renamedTags.indexOf(t) === i); // dedupe

  // 4. Flag Asiatisch tag
  if (tags.includes('Asiatisch')) {
    stats.asiatisch.push({ id: r.id, name: r.name });
  }

  // 5. All 4 seasons → Ganzjährig
  const selected = tags.filter(t => SEASON_TAGS.has(t));
  if (selected.length === 4) {
    tags = [...tags.filter(t => !SEASON_TAGS.has(t)), 'Ganzjährig'];
  }

  return { ...r, category, tags, sourceType, _migrated_v2: true };
}

// ─── Walk individual source files ────────────────────────────────────────────

const stats = {
  total: 0, skipped: 0, direct: 0, heuristic: 0,
  reviewNeeded: [], asiatisch: [], errors: [],
};

const folders = readdirSync(RECIPES_DIR)
  .filter(f => statSync(path.join(RECIPES_DIR, f)).isDirectory());

for (const folder of folders) {
  const dir = path.join(RECIPES_DIR, folder);
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    const filePath = path.join(dir, file);
    const r = JSON.parse(readFileSync(filePath, 'utf-8'));
    stats.total++;
    const migrated = migrateRecipe(r, stats);
    if (!DRY_RUN && migrated !== r) {
      writeFileSync(filePath, JSON.stringify(migrated, null, 2) + '\n');
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('\n=== MahlZeit Rezept-Migration v2 ===\n');
console.log(`Gesamt:           ${stats.total}`);
console.log(`Bereits migriert: ${stats.skipped}`);
console.log(`Direkt migriert:  ${stats.direct}`);
console.log(`Heuristisch:      ${stats.heuristic}`);
console.log(`Asiatisch (Prüfung nötig): ${stats.asiatisch.length}`);
console.log(`Manuell zu prüfen: ${stats.reviewNeeded.length}`);
console.log(`Fehler:           ${stats.errors.length}`);

if (stats.reviewNeeded.length > 0) {
  console.log('\n⚠️  Manuell zu prüfen (Gemüsegerichte-Fallback):');
  stats.reviewNeeded.forEach(r => console.log(`   ${r.id}: ${r.name} (war: ${r.origCat})`));
}

if (stats.asiatisch.length > 0) {
  console.log('\n⚠️  Asiatisch-Tag → bitte spezifische Küche setzen:');
  stats.asiatisch.forEach(r => console.log(`   ${r.id}: ${r.name}`));
}

if (stats.errors.length > 0) {
  console.log('\n❌  Unbekannte Kategorien:');
  stats.errors.forEach(r => console.log(`   ${r.id}: ${r.name} (${r.category})`));
}

if (DRY_RUN) {
  console.log('\n[dry-run] Keine Änderungen geschrieben.\n');
} else {
  console.log('\n✅ Einzelne Quelldateien aktualisiert.');
  console.log('Rebuilding data/recipes.json...');
  execSync('npm run recipes:build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}
