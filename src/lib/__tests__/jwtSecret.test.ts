import { describe, it, expect, vi } from 'vitest';
import {
  resolveJwtSecret, DEV_FALLBACK_SECRET, MIN_SECRET_LENGTH, MissingJwtSecretError,
} from '../jwtSecret';

const ECHT = 'a'.repeat(64);

describe('resolveJwtSecret — Produktion scheitert laut statt leise unsicher zu laufen', () => {
  it('wirft, wenn die Variable fehlt', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(MissingJwtSecretError);
  });

  it('wirft beim leeren String', () => {
    // Der Fall aus der Praxis: "JWT_SECRET=" in der Env-Datei.
    expect(() => resolveJwtSecret('', 'production')).toThrow(MissingJwtSecretError);
    expect(() => resolveJwtSecret('   ', 'production')).toThrow(MissingJwtSecretError);
  });

  it('wirft, wenn jemand den Entwicklungs-Rückfallwert einträgt', () => {
    // Genauso unsicher wie gar keiner — der Wert steht öffentlich im Repository.
    expect(() => resolveJwtSecret(DEV_FALLBACK_SECRET, 'production')).toThrow(MissingJwtSecretError);
  });

  it('nennt in der Meldung, wie man einen Schlüssel erzeugt', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(/openssl rand -hex 32/);
  });

  it('akzeptiert einen echten Schlüssel', () => {
    expect(resolveJwtSecret(ECHT, 'production')).toBe(ECHT);
  });

  it('entfernt umgebende Leerzeichen', () => {
    expect(resolveJwtSecret(`  ${ECHT}  `, 'production')).toBe(ECHT);
  });
});

describe('resolveJwtSecret — Entwicklung bleibt bequem', () => {
  it('fällt ohne Variable auf den Entwicklungswert zurück', () => {
    expect(resolveJwtSecret(undefined, 'development')).toBe(DEV_FALLBACK_SECRET);
    expect(resolveJwtSecret('', 'test')).toBe(DEV_FALLBACK_SECRET);
    expect(resolveJwtSecret('', undefined)).toBe(DEV_FALLBACK_SECRET);
  });

  it('wirft lokal auch dann nicht, wenn der Rückfallwert explizit gesetzt ist', () => {
    expect(resolveJwtSecret(DEV_FALLBACK_SECRET, 'development')).toBe(DEV_FALLBACK_SECRET);
  });
});

describe('resolveJwtSecret — kurzer Schlüssel warnt, schaltet aber nichts ab', () => {
  it('warnt unterhalb der Mindestlänge', () => {
    const warn = vi.fn();
    const kurz = 'kurz-aber-eigen';
    expect(resolveJwtSecret(kurz, 'production', warn)).toBe(kurz);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(new RegExp(String(MIN_SECRET_LENGTH)));
  });

  it('warnt nicht bei ausreichender Länge', () => {
    const warn = vi.fn();
    resolveJwtSecret(ECHT, 'production', warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it('laesst eine laufende Installation mit kurzem eigenem Schlüssel weiterlaufen', () => {
    // Bewusst kein Abbruch: das waere eine Abschaltung fuer etwas, das immerhin
    // nicht oeffentlich bekannt ist.
    expect(() => resolveJwtSecret('zu-kurz', 'production')).not.toThrow();
  });
});
