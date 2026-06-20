import { describe, it, expect } from 'vitest';
import { filterExpiredPromotions } from '../promotionUtils';
import type { Promotion } from '@/types';

const today = new Date();
const fmt = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

const daysFromNow = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

const promo = (validUntil?: string): Promotion => ({
  store: 'migros', product: 'Test', validUntil,
});

describe('filterExpiredPromotions', () => {
  it('keeps promotions without a date', () => {
    const result = filterExpiredPromotions([promo(undefined)]);
    expect(result).toHaveLength(1);
  });

  it('keeps promotions valid today', () => {
    const result = filterExpiredPromotions([promo(daysFromNow(0))]);
    expect(result).toHaveLength(1);
  });

  it('keeps promotions valid in the future', () => {
    const result = filterExpiredPromotions([promo(daysFromNow(7))]);
    expect(result).toHaveLength(1);
  });

  it('removes promotions that expired yesterday', () => {
    const result = filterExpiredPromotions([promo(daysFromNow(-1))]);
    expect(result).toHaveLength(0);
  });

  it('handles mixed valid/expired promotions', () => {
    const mixed: Promotion[] = [
      promo(daysFromNow(-5)),  // expired
      promo(daysFromNow(3)),   // valid
      promo(undefined),         // no date → keep
    ];
    const result = filterExpiredPromotions(mixed);
    expect(result).toHaveLength(2);
  });

  it('handles malformed date strings gracefully', () => {
    const result = filterExpiredPromotions([promo('invalid-date')]);
    expect(result).toHaveLength(1); // keep on parse error
  });

  it('returns empty array for empty input', () => {
    expect(filterExpiredPromotions([])).toEqual([]);
  });
});
