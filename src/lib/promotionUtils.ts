import type { Promotion } from '@/types';

export const FOOD_SYNONYMS: Record<string, string[]> = {
  poulet:     ['poulet', 'chicken', 'hähnchen', 'hühnchen'],
  chicken:    ['chicken', 'poulet', 'hähnchen', 'hühnchen'],
  hähnchen:   ['hähnchen', 'poulet', 'chicken'],
  rahm:       ['rahm', 'sahne', 'crème'],
  sahne:      ['sahne', 'rahm', 'crème'],
  zucchetti:  ['zucchetti', 'zucchini'],
  zucchini:   ['zucchini', 'zucchetti'],
  peterli:    ['peterli', 'petersilie'],
  petersilie: ['petersilie', 'peterli'],
  kartoffel:  ['kartoffel', 'erdäpfel'],
  erdäpfel:   ['kartoffel', 'erdäpfel'],
  lachs:      ['lachs', 'salmon'],
  thon:       ['thon', 'thunfisch', 'tuna'],
  thunfisch:  ['thunfisch', 'thon', 'tuna'],
};

/**
 * Token-based ingredient matching.
 * Splits the product name on whitespace and separators, then checks for
 * exact token equality — preventing compound-word false positives like
 * "Butter" matching "Erdnussbutter".
 */
export function ingredientMatchesPromotion(
  ingredientName: string,
  productName: string,
): boolean {
  const prodTokens = productName
    .toLowerCase()
    .split(/[\s,\-\/\(\)]+/)
    .filter(Boolean);

  // Use all words from the ingredient name (min 4 chars) as candidates
  const ingWords = ingredientName
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 4);

  for (const word of ingWords) {
    const candidates = new Set([word, ...(FOOD_SYNONYMS[word] ?? [])]);
    if (prodTokens.some(tok => candidates.has(tok))) return true;
  }
  return false;
}

/**
 * Removes promotions whose validUntil date is in the past.
 * Promotions without a date are kept.
 */
export function filterExpiredPromotions(promotions: Promotion[]): Promotion[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return promotions.filter(p => {
    if (!p.validUntil) return true;
    const parts = p.validUntil.split('.');
    if (parts.length !== 3) return true;
    const [d, m, y] = parts;
    const validDate = new Date(Number(y), Number(m) - 1, Number(d));
    return validDate >= today;
  });
}
