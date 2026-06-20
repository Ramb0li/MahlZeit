import { describe, it, expect } from 'vitest';
import { ingredientMatchesPromotion } from '../promotionUtils';

describe('ingredientMatchesPromotion', () => {
  // ── True positives ─────────────────────────────────────────────────────────
  it('matches exact product token', () => {
    expect(ingredientMatchesPromotion('Tomaten', 'Bio Tomaten gehackt 12x400g')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(ingredientMatchesPromotion('tomaten', 'Bio Tomaten 500g')).toBe(true);
  });

  it('does NOT match Tomaten inside Rispentomaten (compound word)', () => {
    expect(ingredientMatchesPromotion('Tomaten', 'Rispentomaten 500g')).toBe(false);
  });

  it('matches multi-word ingredient by second word', () => {
    expect(ingredientMatchesPromotion('Cherry Tomaten', 'Cherrytomate 500g')).toBe(false); // compound
    expect(ingredientMatchesPromotion('Rote Linsen', 'Linsen 500g')).toBe(true);
  });

  it('matches via Poulet→Chicken synonym', () => {
    expect(ingredientMatchesPromotion('Poulet', 'Chicken Breast 400g')).toBe(true);
  });

  it('matches via Chicken→Poulet synonym', () => {
    expect(ingredientMatchesPromotion('Chicken', 'Poulet Filet 300g')).toBe(true);
  });

  it('matches via Zucchetti→Zucchini synonym', () => {
    expect(ingredientMatchesPromotion('Zucchetti', 'Zucchini 500g')).toBe(true);
  });

  it('matches via Peterli→Petersilie synonym', () => {
    expect(ingredientMatchesPromotion('Peterli', 'Frische Petersilie Bund')).toBe(true);
  });

  // ── True negatives (no false positives from compound words) ────────────────
  it('does NOT match Butter inside Erdnussbutter', () => {
    expect(ingredientMatchesPromotion('Butter', 'Erdnussbutter 500g')).toBe(false);
  });

  it('does NOT match Apfel inside Apfelsaft', () => {
    expect(ingredientMatchesPromotion('Apfel', 'Apfelsaft 1L')).toBe(false);
  });

  it('does NOT match Poulet inside Pouletgewürz', () => {
    expect(ingredientMatchesPromotion('Poulet', 'Pouletgewürz 50g')).toBe(false);
  });

  it('does NOT match Rahm inside Rahmsauce', () => {
    expect(ingredientMatchesPromotion('Rahm', 'Rahmsauce 200ml')).toBe(false);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────
  it('ignores short words (< 4 chars)', () => {
    // "Bio" is 3 chars → filtered out; only "Ei" (2 chars) → nothing matches
    expect(ingredientMatchesPromotion('Bio Ei', 'Bio Eier Freiland 10er')).toBe(false);
  });

  it('returns false for empty ingredient name', () => {
    expect(ingredientMatchesPromotion('', 'Tomaten 500g')).toBe(false);
  });

  it('returns false for empty product name', () => {
    expect(ingredientMatchesPromotion('Tomaten', '')).toBe(false);
  });
});
