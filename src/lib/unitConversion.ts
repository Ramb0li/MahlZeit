/**
 * Einheiten-Normalisierung für die Einkaufsliste.
 *
 * Ziel: EL/TL-Angaben in Gramm oder Milliliter umrechnen, damit
 * gleiche Zutaten in verschiedenen Einheiten (z.B. "1 EL Butter" + "10g Butter")
 * zusammengefasst werden können.
 *
 * Strategie:
 * - Nur EL/TL werden konvertiert; alle anderen Einheiten bleiben unverändert.
 * - Das Keyword-Matching erfolgt auf dem Zutats-Namen (lowercase, ohne Akzente-Normalisierung nötig).
 * - Wenn kein Keyword passt, bleibt die Einheit unverändert (kein Merge-Versuch).
 * - approx: true signalisiert der UI, die Menge als "ca. X" darzustellen.
 */

interface ConversionFactor {
  tl:       number;     // Gramm (oder ml) pro TL
  el:       number;     // Gramm (oder ml) pro EL
  baseUnit: 'g' | 'ml';
}

// Konversionstabelle nach Zutat-Kategorie
// Werte gemäss Rezeptur-Praxis (abgerundet auf ganze Zahlen)
const CONVERSIONS: Array<{ keywords: string[]; factor: ConversionFactor }> = [
  // Flüssigkeiten — immer in ml
  {
    keywords: ['öl', 'oel', 'essig', 'sojasauce', 'fischsauce', 'worcester', 'zitronensaft', 'limettensaft', 'reisessig', 'balsamico', 'sauce', 'sesamöl', 'olivenöl', 'rapsöl', 'sonnenblumenöl'],
    factor: { tl: 5, el: 15, baseUnit: 'ml' },
  },
  // Honig, Sirup, Konfitüre
  {
    keywords: ['honig', 'konfitüre', 'konfiruere', 'marmelade', 'sirup', 'ahornsirup', 'agaven', 'agavendicksaft'],
    factor: { tl: 6, el: 17, baseUnit: 'g' },
  },
  // Butter, Fette, Margarine
  {
    keywords: ['butter', 'margarine', 'kokosfett', 'schmalz', 'ghee'],
    factor: { tl: 4, el: 14, baseUnit: 'g' },
  },
  // Mehl, Stärke
  {
    keywords: ['mehl', 'stärke', 'staerke', 'maizena', 'speisestärke', 'speisestärke', 'kartoffelstärke', 'maisstärke'],
    factor: { tl: 3, el: 12, baseUnit: 'g' },
  },
  // Zucker, Salz
  {
    keywords: ['zucker', 'salz', 'meersalz', 'fleur', 'rohrzucker', 'puderzucker', 'kristallzucker', 'vanillezucker', 'vanillinzucker'],
    factor: { tl: 5, el: 12, baseUnit: 'g' },
  },
  // Gewürze / Pulver
  {
    keywords: ['pfeffer', 'paprika', 'curry', 'zimt', 'kümmel', 'kumin', 'koriander', 'muskat', 'oregano', 'thymian', 'cayenne', 'ingwer', 'kurkuma', 'kreuzkümmel', 'chili', 'kardamom', 'sumach', 'ras', 'harissa', 'backpulver', 'natron'],
    factor: { tl: 4, el: 10, baseUnit: 'g' },
  },
];

// Fallback-Faktor wenn kein Keyword passt (Generisch)
// → kein Merge, Wert unverändert zurückgeben
const NO_MATCH = null;

function findFactor(name: string, unit: 'EL' | 'TL'): ConversionFactor | null {
  const lower = name.toLowerCase();
  for (const entry of CONVERSIONS) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return entry.factor;
      }
    }
  }
  return NO_MATCH;
}

export interface NormalizedUnit {
  amount:   number;
  unit:     string;
  approx:   boolean;
}

/**
 * Normalisiert EL/TL → g oder ml für die Einkaufslisten-Aggregation.
 *
 * - Gibt bei unbekannten Einheiten (nicht EL/TL) die Original-Werte zurück.
 * - Gibt bei unbekannten Zutaten die Original-Werte zurück (kein Merge, kein approx).
 * - Gibt bei Treffer die konvertierte Menge + Basiseinheit + approx=true zurück.
 */
export function normalizeUnit(name: string, amount: number, unit: string): NormalizedUnit {
  if (unit !== 'EL' && unit !== 'TL') {
    return { amount, unit, approx: false };
  }
  const factor = findFactor(name, unit as 'EL' | 'TL');
  if (!factor) {
    // Unbekannte Zutat mit EL/TL — nicht konvertieren, nicht mergen
    return { amount, unit, approx: false };
  }
  const multiplier = unit === 'TL' ? factor.tl : factor.el;
  return {
    amount: Math.round(amount * multiplier * 10) / 10, // 1 Dezimalstelle
    unit:   factor.baseUnit,
    approx: true,
  };
}
