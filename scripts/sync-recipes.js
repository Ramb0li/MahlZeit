/**
 * sync-recipes.js
 *
 * Synchronisiert die Einzelrezept-Dateien in data/recipes/** mit einem
 * aus dem Admin-Panel exportierten data/recipes.json.
 *
 * Was der Script macht:
 *   1. Liest data/recipes.json (der Export aus Redis / Admin)
 *   2. Aktualisiert alle Einzeldateien mit den Admin-Änderungen (Bilder, Steps, etc.)
 *   3. Löscht Einzeldateien, deren ID nicht mehr im Export vorhanden ist
 *   4. Ruft build-recipes.js auf, um data/recipes.json neu zu generieren
 *
 * Workflow:
 *   1. Änderungen im Admin-Panel vornehmen (Bilder, Edits, Löschungen)
 *   2. Im Admin "Export JSON" herunterladen → als data/recipes.json speichern
 *   3. npm run recipes:sync
 *   4. git add -A && git commit && git push
 *   5. Im Admin "Seed Redis" klicken
 */

const fs   = require('fs');
const path = require('path');

const RECIPES_JSON = path.join(__dirname, '..', 'data', 'recipes.json');
const RECIPES_DIR  = path.join(__dirname, '..', 'data', 'recipes');

// Felder, die via Admin bearbeitet werden können
const ADMIN_FIELDS = [
  'imageUrl', 'imageZutaten', 'imageKochen',
  'dietCategory', 'description', 'steps', 'tips',
  'name', 'tags', 'timeMinutes', 'activeTimeMinutes', 'basePortions',
  'weatherType', 'category', 'ingredients', 'ingredientGroups',
  'source', 'archived',
];

function findAllRecipeFiles() {
  const result = [];
  const subdirs = fs.readdirSync(RECIPES_DIR).filter(f =>
    fs.statSync(path.join(RECIPES_DIR, f)).isDirectory()
  );
  for (const sub of subdirs) {
    const dir = path.join(RECIPES_DIR, sub);
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      result.push({ filepath: path.join(dir, file), subdir: sub, file });
    }
  }
  return result;
}

function syncRecipes() {
  if (!fs.existsSync(RECIPES_JSON)) {
    console.error('❌  data/recipes.json nicht gefunden. Zuerst aus dem Admin exportieren.');
    process.exit(1);
  }

  const export_ = JSON.parse(fs.readFileSync(RECIPES_JSON, 'utf-8'));
  const exportById = {};
  for (const r of export_) exportById[r.id] = r;

  console.log(`📥  Export: ${export_.length} Rezepte`);

  const allFiles = findAllRecipeFiles();
  let updated = 0;
  let deleted = 0;

  for (const { filepath, subdir, file } of allFiles) {
    const recipe = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const rid = recipe.id;

    if (!rid || !(rid in exportById)) {
      // Nicht im Export → wurde im Admin gelöscht
      fs.unlinkSync(filepath);
      console.log(`  🗑  Gelöscht: ${subdir}/${file} (id=${rid ?? '?'})`);
      deleted++;
      continue;
    }

    const exported = exportById[rid];
    let changed = false;

    for (const field of ADMIN_FIELDS) {
      const newVal = exported[field];
      if (JSON.stringify(recipe[field]) !== JSON.stringify(newVal)) {
        recipe[field] = newVal;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filepath, JSON.stringify(recipe, null, 2), 'utf-8');
      console.log(`  ✏️  Aktualisiert: ${subdir}/${file}`);
      updated++;
    }
  }

  console.log(`\n✅  Sync: ${updated} aktualisiert, ${deleted} gelöscht`);

  // Rebuild
  require('./build-recipes.js');
}

syncRecipes();
