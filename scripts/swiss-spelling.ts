/**
 * swiss-spelling.ts
 *
 * Setzt die eindeutigen Schweizer Schreibweisen in den Zutatennamen durch —
 * Zucchini wird Zucchetti, Hähnchen wird Poulet, Garnelen werden Crevetten.
 *
 * Ausfuehren: npx tsx scripts/swiss-spelling.ts            (Trockenlauf)
 *             npx tsx scripts/swiss-spelling.ts --schreiben (aendert die Dateien)
 *
 * Nur die als `sicher` markierten Regeln aus src/lib/ingredientIndex.ts laufen
 * automatisch. Regional zweideutige Faelle wie Karotte/Rüebli oder Paprika/Peperoni
 * bleiben liegen und werden im Zutaten-Tab des Admin-Bereichs zur Entscheidung
 * angezeigt — beide Formen sind in der Schweiz gebraeuchlich, das kann kein Skript
 * entscheiden.
 *
 * Geaendert werden die Einzeldateien in data/recipes/**. Danach `npm run recipes:build`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPELLING_RULES, replaceWordInText } from '../src/lib/ingredientIndex';
import type { Recipe, Ingredient } from '../src/types/index';

const SCHREIBEN = process.argv.includes('--schreiben');
const RECIPES_DIR = path.join(__dirname, '..', 'data', 'recipes');

/** Wendet ausschliesslich die sicheren Regeln an. */
function sichereSchreibweise(name: string): string {
  let out = name;
  for (const regel of SPELLING_RULES) {
    if (!regel.sicher) continue;
    if (regel.ausnahme?.test(out)) continue;
    regel.muster.lastIndex = 0;
    out = out.replace(regel.muster, regel.ersatz);
  }
  return out;
}

function alleDateien(): string[] {
  const out: string[] = [];
  for (const sub of fs.readdirSync(RECIPES_DIR)) {
    const dir = path.join(RECIPES_DIR, sub);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) out.push(path.join(dir, f));
    }
  }
  return out.sort();
}

function main() {
  const dateien = alleDateien();
  let rezepteGeaendert = 0;
  let zutatenGeaendert = 0;
  let schritteGeaendert = 0;
  const beispiele: string[] = [];

  for (const datei of dateien) {
    const recipe = JSON.parse(fs.readFileSync(datei, 'utf-8')) as Recipe;

    // Welche Namen aendern sich? Erst sammeln, dann anwenden.
    const umbenennungen = new Map<string, string>();
    for (const ing of recipe.ingredients ?? []) {
      const neu = sichereSchreibweise(ing.name);
      if (neu !== ing.name) umbenennungen.set(ing.name, neu);
    }

    // Die sicheren Regeln gelten auch fuer die Schritttexte, unabhaengig davon,
    // wie die Zutat in der Liste heisst. Sonst bleibt "Die Zucchini grob schaelen"
    // stehen, weil der Zutateneintrag "Zucchini (fuer Bruehe)" lautet und als
    // ganzer Name im Text nicht vorkommt. Bei eindeutigen Regeln ist das
    // unbedenklich: Zucchini heisst in der Schweiz immer Zucchetti.
    const schritteVorher = recipe.steps ? [...recipe.steps] : [];
    const textRegeln = (s: string) => {
      let out = s;
      for (const regel of SPELLING_RULES) {
        if (!regel.sicher) continue;
        if (regel.ausnahme?.test(out)) continue;
        regel.muster.lastIndex = 0;
        out = out.replace(regel.muster, regel.ersatz);
      }
      return out;
    };
    const textTrifft = schritteVorher.some(s => textRegeln(s) !== s);

    if (umbenennungen.size === 0 && !textTrifft) continue;

    const rename = (i: Ingredient): Ingredient => {
      const neu = umbenennungen.get(i.name);
      return neu ? { ...i, name: neu } : i;
    };

    // ingredients UND ingredientGroups gleich behandeln — die Invariante
    // "ingredients ist die Konkatenation der Gruppen" wird beim Import geprueft.
    recipe.ingredients = (recipe.ingredients ?? []).map(rename);
    if (recipe.ingredientGroups?.length) {
      recipe.ingredientGroups = recipe.ingredientGroups.map(g => ({
        ...g,
        ingredients: g.ingredients.map(rename),
      }));
    }
    zutatenGeaendert += umbenennungen.size;

    if (recipe.steps?.length) {
      recipe.steps = recipe.steps.map(s => {
        // Erst die vollstaendigen Zutatennamen, dann die allgemeinen Regeln —
        // so bleibt "Zucchini (fein gerieben)" als Ganzes erhalten, falls es im
        // Text steht, und ein einzelnes "Zucchini" wird trotzdem erfasst.
        let neu = s;
        umbenennungen.forEach((nach, von) => { neu = replaceWordInText(neu, von, nach); });
        neu = textRegeln(neu);
        if (neu !== s) schritteGeaendert++;
        return neu;
      });
    }

    rezepteGeaendert++;
    if (beispiele.length < 12) {
      umbenennungen.forEach((nach, von) => {
        if (beispiele.length < 12) beispiele.push(`  ${recipe.id.padEnd(9)}${von}  ->  ${nach}`);
      });
    }

    if (SCHREIBEN) fs.writeFileSync(datei, JSON.stringify(recipe, null, 2), 'utf-8');
  }

  console.log(`\n${SCHREIBEN ? '=== Geschrieben ===' : '=== Trockenlauf (nichts geaendert) ==='}`);
  console.log(`  Dateien geprueft  : ${dateien.length}`);
  console.log(`  Rezepte betroffen : ${rezepteGeaendert}`);
  console.log(`  Zutatennamen      : ${zutatenGeaendert}`);
  console.log(`  Schritte angepasst: ${schritteGeaendert}`);
  if (beispiele.length) {
    console.log('\n  Beispiele:');
    beispiele.forEach(b => console.log(b));
  }
  if (!SCHREIBEN && rezepteGeaendert > 0) {
    console.log('\n  Zum Anwenden: npx tsx scripts/swiss-spelling.ts --schreiben && npm run recipes:build');
  }
  console.log();
}

main();
