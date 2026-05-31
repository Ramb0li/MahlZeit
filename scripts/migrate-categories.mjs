/**
 * Migrates all recipe JSON files from the old 14-category flat system to the new
 * 13-category + tags[] system. Run once, then `npm run recipes:build`.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = resolve(__dirname, '../data/recipes');

// ── Per-recipe migration table ──────────────────────────────────────────────
// Format: id → { category, tags }
// Tags listed here are ADDED (derived from old fields); old fields are removed.
const MIGRATION = {
  // Eier
  'ei-01': { category: 'Frühstück',                    tags: ['Mittagsgericht'] },
  'ei-02': { category: 'Vegetarische Hauptgerichte',   tags: ['Herbst', 'Winter'] },
  'ei-03': { category: 'Frühstück',                    tags: ['Mittagsgericht'] },
  'ei-04': { category: 'Vegetarische Hauptgerichte',   tags: ['Mittagsgericht'] },
  'ei-05': { category: 'Vegetarische Hauptgerichte',   tags: ['Herbst', 'Winter'] },
  'ei-06': { category: 'Vegetarische Hauptgerichte',   tags: ['Herbst', 'Winter'] },
  'ei-07': { category: 'Vegetarische Hauptgerichte',   tags: ['Herbst', 'Winter'] },
  'ei-08': { category: 'Vegetarische Hauptgerichte',   tags: ['Mittagsgericht', 'Vegetarisch'] },

  // Pasta
  'fvt-03': { category: 'Pasta',              tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Frühling'] },
  'fvt-04': { category: 'Pasta',              tags: ['Mittagsgericht', 'Herbst', 'Winter', 'Frühling'] },
  'fvt-06': { category: 'Pasta',              tags: [] },
  'fvt-09': { category: 'Pasta',              tags: ['Vegan', 'Herbst', 'Winter'] },
  'fvt-12': { category: 'Pasta',              tags: ['Mittagsgericht', 'Frühling', 'Sommer'] },
  'pas-01': { category: 'Pasta',              tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },
  'pas-02': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Ofengericht'] },
  'pas-03': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Ofengericht'] },
  'pas-04': { category: 'Pasta',              tags: ['Mittagsgericht', 'Frühling', 'Sommer'] },
  'pas-05': { category: 'Pasta',              tags: ['Mittagsgericht'] },
  'pas-06': { category: 'Pasta',              tags: ['Herbst', 'Winter'] },
  'pas-07': { category: 'Pasta',              tags: ['Herbst', 'Winter', 'Schweizer'] },
  'pas-08': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Ofengericht'] },
  'pas-09': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Frühling', 'Ofengericht'] },
  'pas-10': { category: 'Pasta',              tags: ['Mittagsgericht', 'Herbst', 'Winter'] },
  'pas-11': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Ofengericht'] },
  'pas-12': { category: 'Pasta',              tags: ['Herbst'] },
  'pas-13': { category: 'Pasta',              tags: ['Vegan', 'Mittagsgericht', 'Frühling', 'Sommer'] },

  // Reis & Getreide
  'fvt-10': { category: 'Reis & Getreide',             tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Asiatisch', 'Herbst', 'Winter', 'Frühling'] },
  'rei-01': { category: 'Reis & Getreide',             tags: ['Herbst', 'Winter', 'Frühling'] },
  'rei-02': { category: 'Reis & Getreide',             tags: ['Mealprep-geeignet', 'Ofengericht'] },
  'rei-03': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Asiatisch'] },
  'rei-04': { category: 'Salate & Bowls',              tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Frühling', 'Sommer'] },
  'rei-05': { category: 'Salate & Bowls',              tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Frühling', 'Sommer', 'Mexikanisch'] },
  'rei-06': { category: 'Reis & Getreide',             tags: ['Mealprep-geeignet', 'Mittagsgericht'] },
  'rei-07': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Vegan', 'Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },

  // Eintopf/Gratin
  'fvt-02': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },
  'ein-01': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Mexikanisch'] },
  'ein-02': { category: 'Reis & Getreide',             tags: [] },
  'ein-03': { category: 'Reis & Getreide',             tags: [] },
  'ein-04': { category: 'Reis & Getreide',             tags: ['Vegan', 'Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },
  'ein-05': { category: 'Aufläufe & Gratins',          tags: ['Vegan', 'Herbst', 'Winter', 'Ofengericht'] },
  'ein-06': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Vegan', 'Mealprep-geeignet', 'Mittagsgericht', 'Orientalisch', 'Herbst', 'Winter'] },

  // Suppen
  'fvt-07': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Frühling'] },
  'sup-01': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },
  'sup-02': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Frühling', 'Italienisch'] },
  'sup-03': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter', 'Schweizer'] },
  'sup-04': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },
  'sup-05': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Herbst', 'Winter'] },
  'sup-06': { category: 'Suppen, Eintöpfe & Currys',   tags: ['Vegan', 'Mealprep-geeignet', 'Mittagsgericht', 'Sommer', 'Herbst'] },

  // Salat/Bowl
  'rec-1779488181331-i6vew': { category: 'Salate & Bowls', tags: ['Mittagsgericht', 'Vegetarisch', 'Sommer'] },
  'sal-01': { category: 'Salate & Bowls', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Frühling', 'Sommer'] },
  'sal-02': { category: 'Salate & Bowls', tags: ['Mittagsgericht', 'Herbst', 'Frühling', 'Sommer'] },
  'sal-03': { category: 'Salate & Bowls', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Frühling', 'Sommer', 'Orientalisch'] },
  'sal-04': { category: 'Salate & Bowls', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Frühling', 'Sommer'] },
  'sal-05': { category: 'Salate & Bowls', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Frühling', 'Sommer'] },
  'sal-06': { category: 'Salate & Bowls', tags: ['Mittagsgericht', 'Schweizer'] },
  'sal-07': { category: 'Salate & Bowls', tags: ['Mittagsgericht', 'Frühling', 'Sommer'] },
  'sal-08': { category: 'Salate & Bowls', tags: ['Vegan', 'Mealprep-geeignet', 'Mittagsgericht'] },
  'sal-09': { category: 'Salate & Bowls', tags: ['Vegetarisch', 'Mittagsgericht', 'Sommer'] },

  // Ofen
  'fvt-08': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Ofengericht', 'Sommer', 'Herbst'] },
  'ofe-01': { category: 'Aufläufe & Gratins', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Ofengericht'] },
  'ofe-02': { category: 'Aufläufe & Gratins', tags: ['Vegetarisch', 'Mittagsgericht', 'Ofengericht', 'Sommer', 'Frühling', 'Italienisch'] },

  // Asiatisch
  'asi-01': { category: 'Pasta',         tags: ['Mittagsgericht', 'Asiatisch', 'Frühling', 'Sommer'] },
  'asi-02': { category: 'Reis & Getreide', tags: ['Mealprep-geeignet', 'Mittagsgericht', 'Asiatisch'] },
  'asi-03': { category: 'Pasta',         tags: ['Vegetarisch', 'Mittagsgericht', 'Asiatisch'] },

  // Fisch
  'fis-01': { category: 'Fisch & Meeresfrüchte', tags: [] },
  'fis-02': { category: 'Fisch & Meeresfrüchte', tags: ['Mittagsgericht'] },

  // Sonstige
  'fvt-01': { category: 'Snacks & Vorspeisen', tags: ['Mealprep-geeignet', 'Mittagsgericht'] },
  'fvt-05': { category: 'Snacks & Vorspeisen', tags: ['Mittagsgericht'] },
  'fvt-11': { category: 'Wraps & Sandwiches',  tags: ['Mittagsgericht', 'Mexikanisch'] },
  'fvt-13': { category: 'Snacks & Vorspeisen', tags: ['Mealprep-geeignet', 'Mittagsgericht'] },
  'son-01': { category: 'Wraps & Sandwiches',  tags: ['Mexikanisch'] },
  'son-02': { category: 'Wraps & Sandwiches',  tags: ['Mexikanisch'] },
  'son-03': { category: 'Wraps & Sandwiches',  tags: ['Mittagsgericht', 'Frühling', 'Sommer', 'Orientalisch'] },
  'son-04': { category: 'Frühstück',           tags: ['Vegetarisch', 'Mittagsgericht'] },

  // Kindersnacks (snack group — kds-01..12)
  'kds-01': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-02': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-03': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-04': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-05': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-06': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-07': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-08': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet', 'Mittagsgericht'] },
  'kds-09': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-10': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-11': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-12': { category: 'Snacks & Vorspeisen', tags: ['Vegan', 'Mealprep-geeignet'] },
  // Kindersnacks (sweet group — kds-13..21)
  'kds-13': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-14': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-15': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-16': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-17': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-18': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-19': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
  'kds-20': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet', 'Herbst', 'Winter'] },
  'kds-21': { category: 'Desserts & Süsses',   tags: ['Vegan', 'Mealprep-geeignet'] },
};

// Fields to remove from every recipe
const REMOVE_FIELDS = ['season', 'isMealprep', 'isSuitableForLunch', 'dietType', 'dietCategory', 'timeLabel'];

// ── Walk directory ───────────────────────────────────────────────────────────
function walkDir(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const e of entries) {
    const full = resolve(dir, e);
    if (statSync(full).isDirectory()) {
      files.push(...walkDir(full));
    } else if (e.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

const files = walkDir(RECIPES_DIR);
let migrated = 0;
let skipped  = 0;
let unknown  = 0;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const recipe = JSON.parse(raw);
  const m = MIGRATION[recipe.id];

  if (!m) {
    console.warn(`⚠️  No mapping for id="${recipe.id}" (${recipe.name}) — skipping`);
    unknown++;
    continue;
  }

  // Apply new category + tags
  recipe.category = m.category;
  recipe.tags = m.tags;

  // Remove old fields
  for (const f of REMOVE_FIELDS) {
    delete recipe[f];
  }

  writeFileSync(file, JSON.stringify(recipe, null, 2) + '\n');
  migrated++;
}

console.log(`\n✅ Migrated ${migrated} recipes.`);
if (unknown) console.log(`⚠️  ${unknown} recipes without mapping (left untouched).`);
if (skipped) console.log(`ℹ️  ${skipped} skipped.`);
