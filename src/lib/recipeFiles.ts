/**
 * Dateizugriff auf die Einzelrezepte — ausschliesslich für den lokalen Dev-Betrieb.
 *
 * In Produktion liegen die Rezepte in Redis, dort wird nichts davon aufgerufen.
 * Lokal (kein UPSTASH_REDIS_REST_URL) schreibt das Admin-Panel dagegen direkt in
 * `data/recipes/<ordner>/<id>.json` und baut anschliessend `data/recipes.json` neu.
 *
 * Liegt in src/lib und nicht in der Route, weil inzwischen zwei Admin-Routen
 * denselben Weg brauchen (Rezepte und Zutaten-Umbenennung).
 *
 * `require` bewusst erst im Funktionsrumpf: so landen `fs` und `child_process`
 * nicht im Modul-Graph, wenn die Datei von einer Client-Komponente berührt wird.
 */

export function findRecipeFile(id: string): string | null {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const dir  = path.join(process.cwd(), 'data', 'recipes');
  for (const sub of fs.readdirSync(dir)) {
    const candidate = path.join(dir, sub, `${id}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Schreibt ein Rezept in seine Einzeldatei. Gibt false zurück, wenn es sie nicht gibt. */
export function writeRecipeFile(id: string, recipe: unknown): boolean {
  const fs   = require('fs') as typeof import('fs');
  const file = findRecipeFile(id);
  if (!file) return false;
  fs.writeFileSync(file, JSON.stringify(recipe, null, 2), 'utf-8');
  return true;
}

/** Baut data/recipes.json aus den Einzeldateien neu. */
export function rebuildRecipesJson(): void {
  const { execSync } = require('child_process') as typeof import('child_process');
  execSync('node scripts/build-recipes.js', { cwd: process.cwd(), stdio: 'pipe' });
}
