import { describe, it, expect } from 'vitest';
import { isRecipeExcluded, getExclusionReason } from '../allergens';

const noIngr = { name: 'Tomatensuppe', ingredients: [] };
const milkRecipe = {
  name: 'Käsespätzle',
  ingredients: [{ name: 'Käse' }, { name: 'Butter' }],
};
const cleanCopy = {
  name: 'Spätzle',
  ingredients: [{ name: 'Mehl' }, { name: 'Eier' }],
};

describe('getExclusionReason', () => {
  it('returns null when no conflict', () => {
    expect(getExclusionReason(noIngr, ['laktose'])).toBeNull();
  });

  it('returns reason string when conflict via ingredient', () => {
    const reason = getExclusionReason(milkRecipe, ['laktose']);
    expect(reason).toMatch(/Enthält/);
    expect(reason).toMatch(/Laktose/i);
  });

  it('recognizes keyword-based allergen (Käse → laktose)', () => {
    const reason = getExclusionReason(milkRecipe, ['milch']);
    expect(reason).toBeTruthy();
  });

  it('returns null for allergen-free copy', () => {
    expect(getExclusionReason(cleanCopy, ['laktose'])).toBeNull();
    expect(isRecipeExcluded(cleanCopy, ['laktose'])).toBe(false);
  });
});
