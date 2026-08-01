import { describe, it, expect } from 'vitest';
import { approvalWarnings, isOwnImageUrl } from '../approvalWarnings';
import type { Recipe } from '@/types';

/** Ein Rezept ohne offene Punkte. */
function clean(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'tst-01',
    name: 'Testgericht',
    category: 'Pasta & Teigwaren',
    timeMinutes: 30,
    tags: ['Abendessen'],
    ingredients: [],
    weatherType: 'neutral',
    source: 'MahlZyt',
    basePortions: 4,
    description: 'Beschreibung.',
    licenseStatus: 'own',
    imageUrl: null,
    approved: true,
    ...over,
  };
}

describe('isOwnImageUrl', () => {
  it('akzeptiert repo-eigene Pfade und den Blob-Store', () => {
    expect(isOwnImageUrl('/images/recipes/foo.jpg')).toBe(true);
    expect(isOwnImageUrl('https://abtskdasumjdq0i1.public.blob.vercel-storage.com/recipes/x.jpg')).toBe(true);
  });

  it('behandelt einen leeren Wert als unbedenklich', () => {
    expect(isOwnImageUrl('')).toBe(true);
    expect(isOwnImageUrl('   ')).toBe(true);
  });

  it('lehnt fremde Domains ab', () => {
    expect(isOwnImageUrl('https://herrbuettner.de/bild.jpg')).toBe(false);
    expect(isOwnImageUrl('https://fooby.ch/media/x.jpg')).toBe(false);
  });

  it('laesst sich nicht durch einen aehnlich aussehenden Host taeuschen', () => {
    expect(isOwnImageUrl('https://public.blob.vercel-storage.com.angreifer.ch/x.jpg')).toBe(false);
  });

  it('verlangt https', () => {
    expect(isOwnImageUrl('http://abtskdasumjdq0i1.public.blob.vercel-storage.com/x.jpg')).toBe(false);
  });
});

describe('approvalWarnings — Lizenzstatus', () => {
  it('meldet einen fehlenden licenseStatus', () => {
    const r = clean();
    delete r.licenseStatus;
    expect(approvalWarnings(r)).toEqual([expect.stringMatching(/Lizenzstatus/)]);
  });

  it('meldet "unclear"', () => {
    expect(approvalWarnings(clean({ licenseStatus: 'unclear' }))).toEqual([
      expect.stringMatching(/unclear/),
    ]);
  });

  it('schweigt bei den uebrigen Werten', () => {
    for (const s of ['own', 'licensed', 'public-domain', 'adapted'] as const) {
      expect(approvalWarnings(clean({ licenseStatus: s }))).toEqual([]);
    }
  });
});

describe('approvalWarnings — Bildherkunft', () => {
  it('meldet ein Bild auf fremder Domain', () => {
    expect(approvalWarnings(clean({ imageUrl: 'https://fooby.ch/media/lasagne.jpg' }))).toEqual([
      expect.stringMatching(/fremden Domain/),
    ]);
  });

  it('schweigt bei null und eigenen Domains', () => {
    expect(approvalWarnings(clean({ imageUrl: null }))).toEqual([]);
    expect(approvalWarnings(clean({ imageUrl: '/images/recipes/x.jpg' }))).toEqual([]);
  });
});

describe('approvalWarnings — Neufassung bei Import', () => {
  it('meldet ein importiertes Rezept ohne rewrittenAt', () => {
    expect(approvalWarnings(clean({ sourceType: 'imported', licenseStatus: 'adapted' }))).toEqual([
      expect.stringMatching(/rewrittenAt/),
    ]);
  });

  it('schweigt bei einem importierten Rezept mit rewrittenAt', () => {
    expect(approvalWarnings(clean({
      sourceType: 'imported', licenseStatus: 'adapted', rewrittenAt: '2026-08-01T10:00:00.000Z',
    }))).toEqual([]);
  });

  it('verlangt rewrittenAt nur bei sourceType "imported"', () => {
    expect(approvalWarnings(clean({ sourceType: 'mahlzyt' }))).toEqual([]);
  });
});

describe('approvalWarnings — mehrere offene Punkte', () => {
  /**
   * Die Funktion sammelt alle Treffer statt nur des ersten, damit die Redaktion
   * nach jeder Korrektur nicht den naechsten Punkt einzeln nachgereicht bekommt.
   */
  it('meldet Lizenz, Fremdbild und fehlende Neufassung gleichzeitig', () => {
    const r = clean({ sourceType: 'imported', imageUrl: 'https://fooby.ch/media/x.jpg' });
    delete r.licenseStatus;
    const w = approvalWarnings(r);
    expect(w).toHaveLength(3);
    expect(w.join(' ')).toMatch(/Lizenzstatus/);
    expect(w.join(' ')).toMatch(/fremden Domain/);
    expect(w.join(' ')).toMatch(/rewrittenAt/);
  });
});

describe('approvalWarnings — kein Bild ist kein Mangel', () => {
  /**
   * Regression: Rezepte ohne Foto muessen sich freigeben lassen. Frueher stand im
   * UI "Gesperrt", was den Eindruck erweckte, ein fehlendes Bild blockiere die
   * Freigabe — geprueft wird ausschliesslich ein Bild auf fremder Domain.
   */
  const frischImportiert = clean({
    source: 'fooby.ch',
    sourceUrl: 'https://fooby.ch/de/rezepte/14229/lasagne-al-forno',
    sourceType: 'imported',
    licenseStatus: 'adapted',
    rewrittenAt: '2026-08-01T10:00:00.000Z',
    imageUrl: null,
  });

  it('ein frisch importierter Entwurf ohne Foto ist unbeanstandet', () => {
    expect(approvalWarnings(frischImportiert)).toEqual([]);
  });

  it('erst das eingetragene Quellbild erzeugt einen Hinweis', () => {
    expect(approvalWarnings({ ...frischImportiert, imageUrl: 'https://fooby.ch/media/lasagne.jpg' }))
      .toEqual([expect.stringMatching(/fremden Domain/)]);
  });
});
