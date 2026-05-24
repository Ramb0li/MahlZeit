/**
 * build-recipes.js
 *
 * Liest alle Einzelrezept-Dateien aus data/recipes/**\/*.json
 * und kombiniert sie zu data/recipes.json (wird von der App gelesen).
 *
 * Ausführen:
 *   node scripts/build-recipes.js
 *
 * Wird automatisch vor `next dev` und `next build` aufgerufen (siehe package.json).
 */

const fs   = require('fs');
const path = require('path');

const RECIPES_DIR  = path.join(__dirname, '..', 'data', 'recipes');
const OUTPUT_FILE  = path.join(__dirname, '..', 'data', 'recipes.json');

// Reihenfolge der Kategorien im kombinierten Array
const CATEGORY_ORDER = [
  'eier',
  'pasta',
  'reis',
  'eintopf-gratin',
  'suppen',
  'salat-bowl',
  'ofen',
  'asiatisch',
  'fisch',
  'sonstige',
];

function buildRecipes() {
  const recipes = [];

  for (const folder of CATEGORY_ORDER) {
    const dir = path.join(RECIPES_DIR, folder);

    if (!fs.existsSync(dir)) {
      console.warn(`⚠️  Ordner nicht gefunden: ${folder}`);
      continue;
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort(); // alphabetisch nach ID sortieren

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const recipe  = JSON.parse(content);
        recipes.push(recipe);
      } catch (err) {
        console.error(`❌ Fehler in ${folder}/${file}:`, err.message);
        process.exit(1);
      }
    }
  }

  // Etwaige Ordner die nicht in CATEGORY_ORDER sind (z.B. neu angelegt)
  const allFolders  = fs.readdirSync(RECIPES_DIR).filter(f =>
    fs.statSync(path.join(RECIPES_DIR, f)).isDirectory()
  );
  const extraFolders = allFolders.filter(f => !CATEGORY_ORDER.includes(f));
  for (const folder of extraFolders) {
    console.warn(`⚠️  Unbekannter Ordner – wird ans Ende angehängt: ${folder}`);
    const dir   = path.join(RECIPES_DIR, folder);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      const recipe = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      recipes.push(recipe);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(recipes, null, 2), 'utf-8');
  console.log(`✅ ${recipes.length} Rezepte → data/recipes.json`);
}

buildRecipes();
