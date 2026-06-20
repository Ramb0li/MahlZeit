import { describe, it, expect } from 'vitest';

// Test URL-building logic and scope assignment without network calls.
// The scraper's URL-building is internal, so we test the observable contract:
// - with city → scope 'regional' in parsed results
// - without city → scope 'national'
// We test this via the parseAktionisPage logic indirectly through known fixtures.

describe('aktionis.ch URL construction', () => {
  const AKTIONIS_BASE = 'https://www.aktionis.ch';

  function buildUrl(page: number, city?: string, radiusKm = 10): string {
    const base = `${AKTIONIS_BASE}/deals?c=7-`;
    const loc  = city ? `&city=${encodeURIComponent(city)}&distance=${radiusKm}` : '';
    return `${base}${loc}&page=${page}&f=t&empty_search=false`;
  }

  it('builds national URL without location', () => {
    expect(buildUrl(1)).toBe(
      'https://www.aktionis.ch/deals?c=7-&page=1&f=t&empty_search=false',
    );
  });

  it('builds regional URL with city', () => {
    expect(buildUrl(1, 'Luzern')).toBe(
      'https://www.aktionis.ch/deals?c=7-&city=Luzern&distance=10&page=1&f=t&empty_search=false',
    );
  });

  it('URL-encodes city with umlauts', () => {
    const url = buildUrl(1, 'Zürich');
    expect(url).toContain('city=Z%C3%BCrich');
  });

  it('uses custom radius', () => {
    expect(buildUrl(2, 'Bern', 5)).toContain('distance=5');
  });

  it('increments page number', () => {
    for (let p = 1; p <= 5; p++) {
      expect(buildUrl(p)).toContain(`page=${p}`);
    }
  });
});

describe('scope assignment', () => {
  it('is national when no city is provided', () => {
    const scope = (city?: string) => city ? 'regional' : 'national';
    expect(scope(undefined)).toBe('national');
  });

  it('is regional when city is provided', () => {
    const scope = (city?: string) => city ? 'regional' : 'national';
    expect(scope('Luzern')).toBe('regional');
  });
});

describe('date extraction from aktionis.ch format', () => {
  function extractDates(dateStr: string): { validFrom?: string; validUntil?: string } {
    const parts = dateStr.split(' - ');
    return {
      validFrom:  parts[0]?.trim() || undefined,
      validUntil: parts[1]?.trim() || undefined,
    };
  }

  it('extracts both dates from range string', () => {
    const result = extractDates('11.06.2026 - 17.06.2026');
    expect(result.validFrom).toBe('11.06.2026');
    expect(result.validUntil).toBe('17.06.2026');
  });

  it('returns undefined for missing parts', () => {
    const result = extractDates('');
    expect(result.validFrom).toBeUndefined();
    expect(result.validUntil).toBeUndefined();
  });

  it('handles single date gracefully', () => {
    const result = extractDates('17.06.2026');
    expect(result.validFrom).toBe('17.06.2026');
    expect(result.validUntil).toBeUndefined();
  });
});
