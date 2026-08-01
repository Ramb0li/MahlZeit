import { describe, it, expect } from 'vitest';
import { canApprove, isOwnImageUrl } from '../approvalGate';
import type { Recipe } from '@/types';

/** Ein Rezept, das alle Gate-Bedingungen erfuellt. */
function approvable(over: Partial<Recipe> = {}): Recipe {
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

describe('canApprove — Lizenzstatus', () => {
  it('blockt, wenn licenseStatus fehlt', () => {
    const r = approvable();
    delete r.licenseStatus;
    const res = canApprove(r);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Lizenzstatus/);
  });

  it('blockt bei "unclear"', () => {
    const res = canApprove(approvable({ licenseStatus: 'unclear' }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/unclear/);
  });

  it('akzeptiert die uebrigen Werte', () => {
    for (const s of ['own', 'licensed', 'public-domain', 'adapted'] as const) {
      expect(canApprove(approvable({ licenseStatus: s })).ok).toBe(true);
    }
  });
});

describe('canApprove — Bildherkunft', () => {
  it('blockt ein Bild auf fremder Domain', () => {
    const res = canApprove(approvable({ imageUrl: 'https://fooby.ch/media/lasagne.jpg' }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/fremden Domain/);
  });

  it('erlaubt null und eigene Domains', () => {
    expect(canApprove(approvable({ imageUrl: null })).ok).toBe(true);
    expect(canApprove(approvable({ imageUrl: '/images/recipes/x.jpg' })).ok).toBe(true);
  });
});

describe('canApprove — Neufassung bei Import', () => {
  it('blockt ein importiertes Rezept ohne rewrittenAt', () => {
    const res = canApprove(approvable({ sourceType: 'imported', licenseStatus: 'adapted' }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/rewrittenAt/);
  });

  it('laesst ein importiertes Rezept mit rewrittenAt durch', () => {
    const res = canApprove(approvable({
      sourceType: 'imported', licenseStatus: 'adapted', rewrittenAt: '2026-08-01T10:00:00.000Z',
    }));
    expect(res.ok).toBe(true);
  });

  it('verlangt rewrittenAt nur bei sourceType "imported"', () => {
    expect(canApprove(approvable({ sourceType: 'mahlzyt' })).ok).toBe(true);
  });
});

describe('canApprove — Regression: frisch importierter Entwurf', () => {
  /**
   * Genau die Konstellation, die die Pipeline erzeugt. Sie muss das Gate
   * bestehen, sobald ein eigenes Foto gesetzt ist — vorher nicht, weil ohne
   * Redaktion und Eigenfoto nicht freigegeben werden soll.
   */
  const frischImportiert = approvable({
    source: 'fooby.ch',
    sourceUrl: 'https://fooby.ch/de/rezepte/14229/lasagne-al-forno',
    sourceType: 'imported',
    licenseStatus: 'adapted',
    rewrittenAt: '2026-08-01T10:00:00.000Z',
    imageUrl: null,
  });

  it('besteht das Gate formal (Bild folgt manuell)', () => {
    expect(canApprove(frischImportiert).ok).toBe(true);
  });

  it('wird blockiert, sobald jemand das Quellbild einträgt', () => {
    const mitFremdbild = { ...frischImportiert, imageUrl: 'https://fooby.ch/media/lasagne.jpg' };
    expect(canApprove(mitFremdbild).ok).toBe(false);
  });
});
