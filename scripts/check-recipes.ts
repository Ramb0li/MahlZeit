/**
 * check-recipes.ts
 *
 * Prüft den gesamten Rezeptbestand auf strukturelle Fehler.
 *
 * Ausfuehren: npm run recipes:check
 *
 * Warum es das braucht: assertValidRecipe in import-utils.ts laeuft nur auf frisch
 * importierte Rezepte. Die bestehenden 419 werden von nichts geprueft — deshalb ist
 * jahrelang unbemerkt geblieben, dass bei sal-63 Tomaten und Avocados in keiner
 * Zutatengruppe stehen und im Kochmodus damit gar nicht auftauchen.
 *
 * Die Regel hier ist bewusst eine andere als beim Import: dort wird ingredients als
 * flatMap der Gruppen GEBAUT, ein Laengenvergleich ist also eine Zusicherung ueber
 * eigenen Code und darf streng sein. Fuer den Bestand gilt die inhaltliche Regel:
 * jede Zutat muss in mindestens einer Gruppe vorkommen. Dass ein Gewuerz in zwei
 * Gruppen steht und in ingredients nur einmal, ist richtig und kein Fehler.
 *
 * Exit-Code 1 bei Fehlern, damit sich das Skript in eine Pipeline haengen laesst.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Recipe } from '../src/types/index';

const RECIPES_JSON = path.join(__dirname, '..', 'data', 'recipes.json');

interface Befund { id: string; name: string; problem: string }

/** Vergleichsschluessel fuer Zutatennamen: Gross/Klein und Randleerzeichen egal. */
function key(name: string): string {
  return name.toLowerCase().trim();
}

function pruefe(r: Recipe): Befund[] {
  const out: Befund[] = [];
  const melde = (problem: string) => out.push({ id: r.id, name: r.name, problem });

  if (!r.name?.trim())                       melde('name fehlt');
  if (!r.category)                           melde('category fehlt');
  if (!r.basePortions || r.basePortions <= 0) melde('basePortions fehlt oder ist 0');

  const zutaten = r.ingredients ?? [];
  if (zutaten.length === 0) melde('keine Zutaten');

  for (const i of zutaten) {
    if (!i.name?.trim())        melde('Zutat ohne Namen');
    else if (!i.unit?.trim())   melde(`Zutat ohne Einheit: ${i.name}`);
    else if (typeof i.amount !== 'number' || Number.isNaN(i.amount)) {
      melde(`Zutat ohne gueltige Menge: ${i.name}`);
    }
  }

  // Die eigentliche Regel: jede Zutat muss in mindestens einer Gruppe stehen,
  // sonst fehlt sie in der Mise-en-Place des Kochmodus.
  if (r.ingredientGroups?.length) {
    const inGruppen = new Set(r.ingredientGroups.flatMap(g => g.ingredients).map(i => key(i.name)));
    for (const i of zutaten) {
      if (i.name && !inGruppen.has(key(i.name))) {
        melde(`Zutat steht in keiner Gruppe (fehlt in der Mise-en-Place): ${i.name}`);
      }
    }
    // Der umgekehrte Fall waere ebenfalls falsch: was in einer Gruppe steht, muss
    // auch auf der Einkaufsliste landen.
    const inListe = new Set(zutaten.map(i => key(i.name)));
    for (const g of r.ingredientGroups) {
      for (const i of g.ingredients) {
        if (i.name && !inListe.has(key(i.name))) {
          melde(`Zutat nur in Gruppe "${g.name}", fehlt in ingredients: ${i.name}`);
        }
      }
    }
  }

  return out;
}

function main() {
  if (!fs.existsSync(RECIPES_JSON)) {
    console.error(`Fehler: ${RECIPES_JSON} nicht gefunden. Zuerst npm run recipes:build.`);
    process.exit(1);
  }

  const recipes: Recipe[] = JSON.parse(fs.readFileSync(RECIPES_JSON, 'utf-8'));
  const befunde = recipes.flatMap(pruefe);

  console.log(`\n=== Rezeptpruefung: ${recipes.length} Rezepte ===`);
  if (befunde.length === 0) {
    console.log('  Keine Befunde.\n');
    return;
  }

  const proRezept = new Map<string, Befund[]>();
  befunde.forEach(b => {
    const liste = proRezept.get(b.id) ?? [];
    liste.push(b);
    proRezept.set(b.id, liste);
  });

  console.log(`  ${befunde.length} Befund(e) in ${proRezept.size} Rezept(en):\n`);
  proRezept.forEach((liste, id) => {
    console.log(`  ${id}  ${liste[0].name}`);
    liste.forEach(b => console.log(`      - ${b.problem}`));
  });
  console.log();
  process.exit(1);
}

main();
