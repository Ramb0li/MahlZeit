import { ALLERGEN_KEYWORDS, matchesTerm } from '../src/lib/allergens';
import type { EuAllergen } from '../src/types/index';

export const EU_ALLERGEN_MAP: Record<EuAllergen, string[]> = {
  gluten:          [...(ALLERGEN_KEYWORDS['gluten'] ?? []), ...(ALLERGEN_KEYWORDS['weizen'] ?? [])],
  // "Crevetten" (CH-Standardbegriff), gambas und scampi fehlten hier — Rezepte damit
  // trugen kein krebstiere-Allergen, obwohl Krebstiere zu den 14 EU-Pflichtallergenen zählen.
  krebstiere:      ['garnele', 'garnelen', 'shrimp', 'krabbe', 'krabben', 'krebs', 'hummer', 'languste', 'meeresfrüchte', 'crevette', 'crevetten', 'gambas', 'scampi', 'langustine', 'flusskrebs'],
  ei:              ALLERGEN_KEYWORDS['ei'] ?? [],
  fisch:           ALLERGEN_KEYWORDS['fisch'] ?? [],
  erdnuesse:       ALLERGEN_KEYWORDS['erdnüsse'] ?? [],
  soja:            ALLERGEN_KEYWORDS['soja'] ?? [],
  milch:           [...(ALLERGEN_KEYWORDS['milch'] ?? []), ...(ALLERGEN_KEYWORDS['laktose'] ?? [])],
  // Speist sich aus derselben Liste wie der Vorschlagsfilter. Vorher standen hier
  // eigene Stichwoerter, die es in ALLERGEN_KEYWORDS nicht gab — dadurch trug ein
  // Rezept das Allergen, wurde Nussallergikern aber trotzdem vorgeschlagen.
  schalenfruechte: ALLERGEN_KEYWORDS['schalenfrüchte'] ?? [],
  sellerie:        ALLERGEN_KEYWORDS['sellerie'] ?? [],
  senf:            ALLERGEN_KEYWORDS['senf'] ?? [],
  sesam:           ALLERGEN_KEYWORDS['sesam'] ?? [],
  sulfite:         ALLERGEN_KEYWORDS['alkohol'] ?? [],
  lupinen:         ALLERGEN_KEYWORDS['lupinen'] ?? [],
  // "schnecke" ist hier bewusst raus: im Bestand sind das Grillschnecken aus
  // Brotteig, die dadurch faelschlich als Weichtier gefuehrt wurden.
  weichtiere:      ['tintenfisch', 'calamari', 'muschel', 'miesmuschel', 'venusmuschel', 'jakobsmuschel', 'austern', 'oktopus', 'krake'],
};

export const EU_ALLERGEN_KEYS = Object.keys(EU_ALLERGEN_MAP) as EuAllergen[];

export interface RecipeLike {
  id: string;
  name: string;
  basePortions: number;
  ingredients: { name: string; amount: number; unit: string; perPortions: number }[];
}

export function computeAllergens(recipe: { name: string; ingredients: { name: string }[] }): EuAllergen[] {
  const found: EuAllergen[] = [];
  for (const allergen of EU_ALLERGEN_KEYS) {
    const keywords = EU_ALLERGEN_MAP[allergen];
    const hasIt = keywords.some(kw => {
      if (matchesTerm(recipe.name, kw)) return true;
      return recipe.ingredients.some(ing => matchesTerm(ing.name ?? '', kw));
    });
    if (hasIt) found.push(allergen);
  }
  return found.sort();
}
