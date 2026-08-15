/**
 * Mengenangaben in Zubereitungsschritten.
 *
 * Zwei Probleme, die im Kochmodus zusammenfielen und wie ein Widerspruch aussahen:
 *
 * 1. Steht dieselbe Zutat zweimal in der Liste (Safranrisotto führt `1 EL Butter`
 *    zum Andämpfen und `20 g Butter` zum Verfeinern), zeigte die Zutatenkarte über
 *    dem Schritt immer den ersten Posten. Schritt 10 sagte „die 20 g Butter",
 *    darüber stand `1 EL Butter`.
 * 2. Mengen im Schritttext skalieren nicht mit der Portionenzahl. Bei 8 statt 4
 *    Portionen zeigte die Karte `2 EL Butter`, der Satz daneben weiterhin `1 EL`.
 *
 * Der Entwurf löst beides über denselben Gedanken: die Zutatenliste des Rezepts ist
 * die Wahrheit, der Schritttext wird gegen sie abgeglichen. Skaliert wird deshalb
 * nicht „jede Zahl mit Einheit", sondern gezielt die Mengen, die tatsächlich als
 * Zutat geführt werden. Gar- und Ruhezeiten sowie Ofentemperaturen sind damit
 * strukturell ausgeschlossen — es braucht keine Ausnahmeliste, die man später
 * ergänzen müsste.
 */

import type { Ingredient } from '@/types';
import { scaleDisplayAmount } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

/**
 * Schreibweisen, unter denen eine Einheit im Fliesstext auftauchen kann.
 * Der Schlüssel ist die Einheit, wie sie in der Zutatenliste steht.
 */
const UNIT_ALIASES: Record<string, string[]> = {
  g:     ['g', 'Gramm'],
  kg:    ['kg', 'Kilogramm', 'Kilo'],
  ml:    ['ml', 'Milliliter'],
  dl:    ['dl', 'Deziliter'],
  l:     ['l', 'Liter'],
  EL:    ['EL', 'Esslöffel'],
  TL:    ['TL', 'Teelöffel'],
  Stk:   ['Stk', 'Stk.', 'Stück'],
  Prise: ['Prise', 'Prisen'],
  Zehe:  ['Zehe', 'Zehen'],
  Bund:  ['Bund'],
  Zweig: ['Zweig', 'Zweige'],
  Blatt: ['Blatt', 'Blätter'],
  Dose:  ['Dose', 'Dosen'],
  Tasse: ['Tasse', 'Tassen'],
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Zahl so schreiben, wie sie im Rezepttext üblich ist: Komma statt Punkt. */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Zahl aus dem Text lesen, egal ob mit Punkt oder Komma geschrieben. */
function parseNumber(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

// ---------------------------------------------------------------------------
// Skalieren
// ---------------------------------------------------------------------------

/**
 * Ersetzt im Schritttext die Basismengen der Rezeptzutaten durch die auf
 * `portions` skalierten Werte.
 *
 * Beispiel: die Zutatenliste führt `20 g Butter`, das Rezept ist auf 4 Portionen
 * ausgelegt, gekocht wird für 8. Aus „die 20 g Butter unterrühren" wird
 * „die 40 g Butter unterrühren". „rund 20 Minuten köcheln" bleibt unberührt,
 * weil `Minuten` keine Zutateneinheit ist.
 *
 * Bewusst nur exakte Treffer auf Zahl UND Einheit: „ca. 6-8 EL Kochwasser" bleibt
 * stehen, weil kein Posten `6 EL` oder `8 EL` führt. Solche Teilmengen sind
 * inhaltlich richtig und sollen sich nicht mit der Portionenzahl ändern.
 */
export function scaleAmountsInStep(
  step: string,
  ingredients: Ingredient[],
  basePortions: number,
  portions: number,
): string {
  if (!step || !basePortions || basePortions === portions) return step;

  // Nachschlagewerk "<menge>|<einheit>" → skalierte Menge.
  const tabelle = new Map<string, number>();
  for (const ing of ingredients) {
    if (ing.amount > 0 && ing.unit) {
      tabelle.set(`${ing.amount}|${ing.unit}`, scaleDisplayAmount(ing.amount, basePortions, portions));
    }
  }
  if (tabelle.size === 0) return step;

  // Ein einziger Durchgang über den Text. Das ist nicht nur kürzer als eine
  // Ersetzung je Zutat, sondern auch korrekt: bei mehreren Durchgängen
  // verschieben sich die Fundstellen und ein bereits ersetzter Wert kann ein
  // zweites Mal skaliert werden. Ausserdem greift die Regex hier automatisch die
  // vollständige Zahl, "2 dl" trifft also nicht mehr die "2" in "12 dl".
  const aliasZuEinheit = new Map<string, string>();
  for (const [unit, aliases] of Object.entries(UNIT_ALIASES)) {
    for (const alias of aliases) aliasZuEinheit.set(alias.toLowerCase(), unit);
  }
  const alleAliase = Array.from(aliasZuEinheit.keys())
    .sort((a, b) => b.length - a.length)     // "Esslöffel" vor "EL", sonst bleibt "löffel" stehen
    .map(escapeRe)
    .join('|');

  const re = new RegExp(`(\\d+(?:[.,]\\d+)?)(\\s*)(${alleAliase})(?![a-zäöüß])`, 'gi');

  return step.replace(re, (treffer, zahl: string, zwischenraum: string, alias: string) => {
    const unit = aliasZuEinheit.get(alias.toLowerCase());
    if (!unit) return treffer;
    const skaliert = tabelle.get(`${parseNumber(zahl)}|${unit}`);
    if (skaliert === undefined) return treffer;   // keine Zutat mit dieser Menge → unverändert
    return `${formatNumber(skaliert)}${zwischenraum}${alias}`;
  });
}

// ---------------------------------------------------------------------------
// Zutaten je Schritt
// ---------------------------------------------------------------------------

/**
 * Findet alle Mengenangaben im Text, die zu einer bekannten Zutateneinheit passen.
 * Rückgabe als Menge von "<zahl>|<einheit>"-Schlüsseln.
 */
function amountsInText(text: string): Set<string> {
  const out = new Set<string>();
  for (const [unit, aliases] of Object.entries(UNIT_ALIASES)) {
    for (const alias of aliases) {
      const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${escapeRe(alias)}(?![a-zäöüß])`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) out.add(`${parseNumber(m[1])}|${unit}`);
    }
  }
  return out;
}

/**
 * Prüft, ob ein Zutatenname im Schritttext vorkommt.
 *
 * Verlangt mindestens 6 Zeichen Übereinstimmung ab Wortanfang. Die frühere
 * Fassung verglich 5-Zeichen-Präfixe ohne Wortgrenze, dadurch zog „unter das
 * Risotto rühren" den Posten `Risottoreis` in die Karte, obwohl der Reis in
 * diesem Schritt gar nicht vorkommt.
 */
function nameInStep(step: string, name: string): boolean {
  const woerter = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')                    // Zusätze wie "(fein gerieben)" ignorieren
    .replace(/[^a-zäöüß\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length >= 4);

  const lower = step.toLowerCase();

  return woerter.some(w => {
    const stamm = w.slice(0, Math.max(6, Math.min(w.length, 8)));
    // Wortanfang im Text suchen; das Wort im Text darf länger sein (Plural,
    // Kompositum), muss aber mit dem Stamm beginnen.
    const re = new RegExp(`(^|[^a-zäöüß])${escapeRe(stamm)}`, 'i');
    return re.test(lower);
  });
}

/**
 * Die Zutaten, die in diesem Schritt vorkommen — mit dem richtigen Posten.
 *
 * Steht im Text eine Menge, die zu genau einem Posten desselben Namens passt,
 * gewinnt dieser. Nur wenn der Text keine Menge nennt, greift der erste Posten.
 * Genau hier lag der Fehler: die alte Fassung deduplizierte über den Namen und
 * zeigte im Verfeinerungsschritt die Andämpf-Butter.
 */
export function ingredientsForStep(step: string, all: Ingredient[]): Ingredient[] {
  const genannt = amountsInText(step);
  const treffer = all.filter(i => nameInStep(step, i.name));

  // Nach Namen bündeln, um mehrfach geführte Zutaten gezielt aufzulösen.
  const proName = new Map<string, Ingredient[]>();
  for (const ing of treffer) {
    const key = ing.name.toLowerCase();
    const liste = proName.get(key);
    if (liste) liste.push(ing); else proName.set(key, [ing]);
  }

  const out: Ingredient[] = [];
  proName.forEach(posten => {
    if (posten.length === 1) { out.push(posten[0]); return; }
    const passend = posten.filter(p => genannt.has(`${p.amount}|${p.unit}`));
    // Genau ein Posten passt zur genannten Menge → der ist gemeint.
    // Mehrere oder keiner → alle zeigen, damit nichts stillschweigend verschwindet.
    out.push(...(passend.length === 1 ? passend : posten));
  });

  // Reihenfolge der Zutatenliste beibehalten, damit die Karte nicht springt.
  return all.filter(i => out.includes(i));
}
