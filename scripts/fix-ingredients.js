#!/usr/bin/env node
// fix-ingredients.js — appends missing ingredients to fam-*.json recipe files
// Safe: only adds ingredients that don't already exist (by name match)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RECIPES_DIR = path.join(__dirname, '..', 'data', 'recipes');

// Find all fam-*.json files and build a lookup map: id -> filepath
function buildFileMap() {
  const output = execSync(`find "${RECIPES_DIR}" -name "fam-*.json"`, { encoding: 'utf8' });
  const map = {};
  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    const id = path.basename(line, '.json');
    map[id] = line;
  }
  return map;
}

// Additions: each entry is { id, ingredients: [{name, amount, unit}] }
// perPortions will be set from the file's basePortions at runtime
const ADDITIONS = [
  {
    id: 'fam-09',
    ingredients: [
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Bouillon', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
    ],
  },
  {
    id: 'fam-11',
    ingredients: [
      { name: 'Peperoncini', amount: 1, unit: 'Stk' },
      { name: 'Tomatenpüree', amount: 1, unit: 'EL' },
      { name: 'Bouillon', amount: 0.5, unit: 'dl' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-12',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-14',
    ingredients: [
      { name: 'Basilikum', amount: 0.5, unit: 'Bund' },
      { name: 'Weisswein', amount: 1, unit: 'EL' },
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-15',
    ingredients: [
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: "All'Arrabbiata Gewürz", amount: 1, unit: 'TL' },
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-16',
    ingredients: [
      { name: 'Bratbutter', amount: 1, unit: 'EL' },
      { name: 'Bratensaucenpulver', amount: 1, unit: 'TL' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Sambal Oelek', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-18',
    ingredients: [
      { name: 'Bratbutter', amount: 1, unit: 'EL' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Senf', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-19',
    ingredients: [
      { name: 'Vanillezucker', amount: 1, unit: 'Pkg' },
    ],
  },
  {
    id: 'fam-20',
    ingredients: [
      { name: 'Rapsöl', amount: 1, unit: 'EL' },
      { name: 'Butter', amount: 1, unit: 'EL' },
      { name: 'Gemüsebouillon', amount: 1, unit: 'TL' },
      { name: 'Muskatnuss', amount: 1, unit: 'Prise' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-21',
    ingredients: [
      { name: 'Mehl', amount: 2, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-22',
    ingredients: [
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-23',
    ingredients: [
      { name: 'Knoblauch', amount: 1, unit: 'Zehe' },
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Basilikum', amount: 0.5, unit: 'Bund' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-24',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
      { name: 'Cayennepfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-25',
    ingredients: [
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
      { name: 'Cayennepfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-26',
    ingredients: [
      { name: 'Zwiebel', amount: 1, unit: 'Stk' },
      { name: 'Lorbeerblatt', amount: 1, unit: 'Stk' },
      { name: 'Nelke', amount: 1, unit: 'Stk' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-27',
    ingredients: [
      { name: 'Mayonnaise', amount: 1, unit: 'EL' },
    ],
  },
  {
    id: 'fam-28',
    ingredients: [
      { name: 'Rosmarin', amount: 0.5, unit: 'TL' },
      { name: "All'Arrabbiata Gewürz", amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-30',
    ingredients: [
      { name: 'Chilischote', amount: 1, unit: 'Stk' },
      { name: 'Bratbutter', amount: 1, unit: 'EL' },
      { name: 'Curry', amount: 1, unit: 'TL' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-31',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-32',
    ingredients: [
      { name: 'Bratbutter', amount: 1, unit: 'EL' },
      { name: 'Senf', amount: 1, unit: 'TL' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-33',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-34',
    ingredients: [
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Reisessig', amount: 1, unit: 'EL' },
      { name: 'Rohrzucker', amount: 1, unit: 'EL' },
      { name: 'Chiliflocken', amount: 0.5, unit: 'TL' },
      { name: 'Koriander', amount: 0.5, unit: 'Bund' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-35',
    ingredients: [
      { name: 'Senf', amount: 1, unit: 'TL' },
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-36',
    ingredients: [
      { name: 'Sonnenblumenöl', amount: 1, unit: 'EL' },
      { name: 'Zucker', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-38',
    ingredients: [
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-39',
    ingredients: [
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-02',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-03',
    ingredients: [
      { name: 'Vanillezucker', amount: 1, unit: 'Pkg' },
      { name: 'Kaffee', amount: 60, unit: 'ml' },
    ],
  },
  {
    id: 'fam-04',
    ingredients: [
      { name: 'Curry', amount: 1, unit: 'TL' },
      { name: 'Provence Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-05',
    ingredients: [
      { name: 'Bohnenkraut', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-06',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-07',
    ingredients: [
      { name: 'Salz', amount: 0.25, unit: 'TL' },
      { name: 'Vanillezucker', amount: 0.5, unit: 'Pkg' },
    ],
  },
  {
    id: 'fam-08',
    ingredients: [
      { name: 'Senf', amount: 1, unit: 'EL' },
      { name: 'Ketchup', amount: 1, unit: 'EL' },
    ],
  },
  {
    id: 'fam-10',
    ingredients: [
      { name: 'Curry', amount: 1, unit: 'TL' },
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-42',
    ingredients: [
      { name: 'Senf', amount: 1, unit: 'TL' },
      { name: 'Rapsöl', amount: 1, unit: 'EL' },
      { name: 'Paprika', amount: 0.5, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-43',
    ingredients: [
      { name: 'Zwiebel', amount: 1, unit: 'Stk' },
      { name: 'Rahm', amount: 1, unit: 'EL' },
      { name: 'Kapern', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-44',
    ingredients: [
      { name: 'Senf', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-45',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-46',
    ingredients: [
      { name: 'Kräutersalz', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-47',
    ingredients: [
      { name: 'Kräutersalz', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-48',
    ingredients: [
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-49',
    ingredients: [
      { name: 'Italienische Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-50',
    ingredients: [
      { name: 'Bouillon', amount: 1, unit: 'TL' },
      { name: 'Curry', amount: 1, unit: 'TL' },
      { name: 'Provence Kräuter', amount: 1, unit: 'TL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-51',
    ingredients: [
      { name: 'Muskatnuss', amount: 1, unit: 'Prise' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-52',
    ingredients: [
      { name: 'Mehl', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-53',
    ingredients: [
      { name: 'Senf', amount: 1, unit: 'TL' },
      { name: 'Milch', amount: 2, unit: 'EL' },
      { name: 'Rapsöl', amount: 1, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-54',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-55',
    ingredients: [
      { name: 'Butter', amount: 1, unit: 'EL' },
      { name: 'Zitronenschale (abgerieben)', amount: 0.5, unit: 'Stk' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-56',
    ingredients: [
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-58',
    ingredients: [
      { name: 'Nelkenpulver', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-59',
    ingredients: [
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
  {
    id: 'fam-60',
    ingredients: [
      { name: 'Zwiebel', amount: 1, unit: 'Stk' },
      { name: 'Petersilienstiele', amount: 3, unit: 'Stk' },
      { name: 'Pfefferkörner', amount: 0.5, unit: 'EL' },
      { name: 'Salz', amount: 1, unit: 'Prise' },
      { name: 'Pfeffer', amount: 1, unit: 'Prise' },
    ],
  },
];

function main() {
  const fileMap = buildFileMap();
  let modified = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of ADDITIONS) {
    const filePath = fileMap[entry.id];
    if (!filePath) {
      console.error(`ERROR: File not found for ${entry.id}`);
      errors++;
      continue;
    }

    let recipe;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      recipe = JSON.parse(raw);
    } catch (e) {
      console.error(`ERROR: Could not read/parse ${filePath}: ${e.message}`);
      errors++;
      continue;
    }

    const basePortions = recipe.basePortions;
    if (!basePortions) {
      console.error(`ERROR: ${entry.id} has no basePortions field`);
      errors++;
      continue;
    }

    const existingNames = new Set(
      (recipe.ingredients || []).map(i => i.name.toLowerCase().trim())
    );

    const toAdd = entry.ingredients.filter(
      ing => !existingNames.has(ing.name.toLowerCase().trim())
    );

    if (toAdd.length === 0) {
      console.log(`SKIP   ${entry.id} — all ingredients already present`);
      skipped++;
      continue;
    }

    const newIngredients = toAdd.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      perPortions: basePortions,
    }));

    recipe.ingredients = [...(recipe.ingredients || []), ...newIngredients];

    try {
      fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2) + '\n', 'utf8');
      const names = newIngredients.map(i => i.name).join(', ');
      console.log(`OK     ${entry.id} — added: ${names}`);
      modified++;
    } catch (e) {
      console.error(`ERROR: Could not write ${filePath}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Modified: ${modified}, Skipped: ${skipped}, Errors: ${errors}`);
  if (errors > 0) process.exit(1);
}

main();
