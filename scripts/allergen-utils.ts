import { ALLERGEN_KEYWORDS, matchesTerm } from '../src/lib/allergens';
import type { EuAllergen } from '../src/types/index';

export const EU_ALLERGEN_MAP: Record<EuAllergen, string[]> = {
  gluten:          [...(ALLERGEN_KEYWORDS['gluten'] ?? []), ...(ALLERGEN_KEYWORDS['weizen'] ?? [])],
  krebstiere:      ['garnele', 'garnelen', 'shrimp', 'krabbe', 'krabben', 'krebs', 'hummer', 'languste', 'meeresfrüchte'],
  ei:              ALLERGEN_KEYWORDS['ei'] ?? [],
  fisch:           ALLERGEN_KEYWORDS['fisch'] ?? [],
  erdnuesse:       ALLERGEN_KEYWORDS['erdnüsse'] ?? [],
  soja:            ALLERGEN_KEYWORDS['soja'] ?? [],
  milch:           [...(ALLERGEN_KEYWORDS['milch'] ?? []), ...(ALLERGEN_KEYWORDS['laktose'] ?? [])],
  schalenfruechte: [
    ...(ALLERGEN_KEYWORDS['haselnüsse'] ?? []),
    ...(ALLERGEN_KEYWORDS['walnüsse'] ?? []),
    'mandel', 'mandeln', 'mandelmehl', 'cashew', 'cashews', 'pistazie', 'pistazien',
    'pekan', 'pekannuss', 'macadamia', 'paranuss', 'paranüsse', 'kokosnuss',
  ],
  sellerie:        ALLERGEN_KEYWORDS['sellerie'] ?? [],
  senf:            ALLERGEN_KEYWORDS['senf'] ?? [],
  sesam:           ALLERGEN_KEYWORDS['sesam'] ?? [],
  sulfite:         ALLERGEN_KEYWORDS['alkohol'] ?? [],
  lupinen:         ALLERGEN_KEYWORDS['lupinen'] ?? [],
  weichtiere:      ['tintenfisch', 'calamari', 'muschel', 'miesmuschel', 'venusmuschel', 'jakobsmuschel', 'oktopus', 'schnecke', 'schnecken'],
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
