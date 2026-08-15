/**
 * enrich-recipes.ts
 *
 * Reichert alle Rezepte in data/recipes.json mit:
 *   - allergens: EuAllergen[]  — 14 EU-Pflichtallergene aus Zutaten
 *   - nutrition: Nutrition     — Nährwerte pro Portion via Claude Sonnet
 *
 * Ausfuehren: npm run recipes:enrich          — nur fehlende Naehrwerte holen
 *             npm run recipes:enrich -- --all — alle neu berechnen
 * Voraussetzung: ANTHROPIC_API_KEY in .env.local
 *
 * Allergene werden immer fuer alle Rezepte neu berechnet: das kostet keinen
 * API-Call und die Stichwortliste waechst mit jedem Import.
 *
 * Naehrwerte dagegen standardmaessig nur dort, wo sie fehlen. Vorher rechnete
 * der Lauf jedes Mal den gesamten Bestand neu — bei 419 Rezepten und 19 neuen
 * ist das teuer und erzeugt einen Diff ueber alle Einzeldateien, in dem die
 * eigentliche Aenderung nicht mehr zu finden ist.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import type { EuAllergen, Nutrition } from '../src/types/index';
import { computeAllergens } from './allergen-utils';
import type { RecipeLike } from './allergen-utils';

// Dotenv laden (falls .env.local vorhanden)
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// ---------------------------------------------------------------------------
// Nährwert-Berechnung via Claude Sonnet
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;

async function fetchNutrition(
  client: Anthropic,
  batch: RecipeLike[],
  batchNum: number,
  totalBatches: number,
): Promise<Map<string, Nutrition>> {
  const result = new Map<string, Nutrition>();

  console.log(`  Verarbeite Batch ${batchNum}/${totalBatches} (${batch.length} Rezepte: ${batch.map(r => r.id).join(', ')})...`);

  const payload = batch.map(r => ({
    id: r.id,
    name: r.name,
    basePortions: r.basePortions,
    ingredients: r.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      perPortions: ing.perPortions,
    })),
  }));

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: 'Du bist ein Ernaehrungsexperte. Schaetze die Naehrwerte pro Portion fuer die gegebenen Rezepte basierend auf ihren Zutaten und Mengenangaben. Antworte ausschliesslich mit validem JSON. Keine Erklaerungen, kein Markdown.',
      messages: [
        {
          role: 'user',
          content: `Berechne Naehrwerte pro Portion fuer diese Rezepte. basePortions gibt die Anzahl Portionen an, fuer die die Zutatenmengen gelten. Runde kcal auf ganze Zahlen, alle anderen Werte auf 1 Dezimalstelle.

Rezepte: ${JSON.stringify(payload)}

Antworte mit: { "results": [ { "id": "...", "kcal": 450, "protein": 28.5, "fat": 12.3, "carbs": 55.2, "fiber": 4.1 }, ... ] }`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    // JSON aus der Antwort extrahieren (robuster als direkt parsen)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Kein JSON in Antwort gefunden');

    const parsed = JSON.parse(jsonMatch[0]) as { results: Array<{ id: string; kcal: number; protein: number; fat: number; carbs: number; fiber: number }> };

    for (const item of parsed.results ?? []) {
      result.set(item.id, {
        kcal:    Math.round(item.kcal),
        protein: Math.round(item.protein * 10) / 10,
        fat:     Math.round(item.fat     * 10) / 10,
        carbs:   Math.round(item.carbs   * 10) / 10,
        fiber:   Math.round(item.fiber   * 10) / 10,
      });
    }
  } catch (err) {
    console.warn(`  Warnung: Batch ${batchNum} fehlgeschlagen — Naehrwerte werden uebersprungen. Fehler: ${(err as Error).message}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Fehler: ANTHROPIC_API_KEY nicht gesetzt. Lege .env.local an oder setze die Variable.');
    process.exit(1);
  }

  const recipesPath = path.join(__dirname, '../data/recipes.json');
  if (!fs.existsSync(recipesPath)) {
    console.error(`Fehler: ${recipesPath} nicht gefunden. Zuerst npm run recipes:build ausfuehren.`);
    process.exit(1);
  }

  const recipes: RecipeLike[] = JSON.parse(fs.readFileSync(recipesPath, 'utf-8'));
  console.log(`\nAngereichert werden ${recipes.length} Rezepte.\n`);

  // Schritt 1: Allergene (synchron, kein API-Call)
  console.log('=== Schritt 1: Allergene berechnen ===');
  let allergenCount = 0;
  for (const recipe of recipes) {
    (recipe as any).allergens = computeAllergens(recipe);
    if (((recipe as any).allergens as EuAllergen[]).length > 0) allergenCount++;
  }
  console.log(`  ${allergenCount}/${recipes.length} Rezepte haben mindestens ein Allergen.\n`);

  // Schritt 2: Naehrwerte (via API)
  const alle    = process.argv.includes('--all');
  const offen   = alle ? recipes : recipes.filter(r => !(r as any).nutrition);
  console.log(`=== Schritt 2: Naehrwerte via Claude Sonnet ===`);
  console.log(alle
    ? `  Modus --all: alle ${recipes.length} Rezepte werden neu berechnet.`
    : `  ${offen.length} von ${recipes.length} Rezepten ohne Naehrwerte. (--all rechnet alle neu.)`);

  if (offen.length === 0) {
    console.log('  Nichts zu tun.\n');
  }

  const client = new Anthropic({ apiKey });

  const batches: RecipeLike[][] = [];
  for (let i = 0; i < offen.length; i += BATCH_SIZE) {
    batches.push(offen.slice(i, i + BATCH_SIZE));
  }

  let nutritionCount = 0;
  for (let i = 0; i < batches.length; i++) {
    const nutritionMap = await fetchNutrition(client, batches[i], i + 1, batches.length);
    for (const recipe of batches[i]) {
      const n = nutritionMap.get(recipe.id);
      if (n) {
        (recipe as any).nutrition = n;
        nutritionCount++;
      }
    }
    // Kurze Pause zwischen Batches um Rate-Limits zu vermeiden
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n  ${nutritionCount}/${offen.length} bearbeitete Rezepte mit Naehrwerten versehen.`);
  console.log(`  Bestand gesamt: ${recipes.filter(r => (r as any).nutrition).length}/${recipes.length} mit Naehrwerten.\n`);

  // Schritt 3: data/recipes.json zurueckschreiben
  fs.writeFileSync(recipesPath, JSON.stringify(recipes, null, 2), 'utf-8');
  console.log(`=== Schritt 3: data/recipes.json aktualisiert. ===`);

  // Schritt 4: Anreicherungs-Felder auch in Einzeldateien schreiben
  // Damit bleiben allergens/nutrition bei npm run recipes:sync erhalten
  // (sync-recipes.js ueberschreibt nur ADMIN_FIELDS, nicht allergens/nutrition).
  console.log('\n=== Schritt 4: Einzeldateien aktualisieren (sync-safe) ===');
  const recipesDir = path.join(__dirname, '../data/recipes');
  let fileUpdates = 0;
  if (fs.existsSync(recipesDir)) {
    const enrichMap = new Map<string, { allergens: EuAllergen[]; nutrition: Nutrition | undefined }>();
    for (const r of recipes) {
      if ((r as any).allergens !== undefined) {
        enrichMap.set(r.id, {
          allergens: (r as any).allergens,
          nutrition: (r as any).nutrition,
        });
      }
    }
    const subdirs = fs.readdirSync(recipesDir).filter(f =>
      fs.statSync(path.join(recipesDir, f)).isDirectory()
    );
    for (const sub of subdirs) {
      const dir = path.join(recipesDir, sub);
      for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
        const filepath = path.join(dir, file);
        try {
          const recipe = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
          const enrich = enrichMap.get(recipe.id);
          if (enrich) {
            recipe.allergens = enrich.allergens;
            if (enrich.nutrition !== undefined) recipe.nutrition = enrich.nutrition;
            fs.writeFileSync(filepath, JSON.stringify(recipe, null, 2), 'utf-8');
            fileUpdates++;
          }
        } catch { /* einzelne Datei ueberspringen */ }
      }
    }
  }
  console.log(`  ${fileUpdates} Einzeldateien aktualisiert.\n`);
  console.log(`=== Fertig! ===\n`);
}

main().catch(err => {
  console.error('Unerwarteter Fehler:', err);
  process.exit(1);
});
