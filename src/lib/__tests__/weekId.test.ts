import { describe, it, expect } from 'vitest';
import { getWeekId, getWeekIdForWindow } from '../utils';

/**
 * Regression für den Wochenstarttag-Bug: Bei einem Wochenstart ≠ Montag umspannt
 * das Anzeigefenster zwei ISO-Wochen. Der Storage-Key muss über alle 7 Referenztage
 * desselben Fensters stabil bleiben (verankert am Donnerstag = angezeigte KW),
 * sonst wandern die Menüs beim Wochenwechsel in die Nachbar-KW.
 */
describe('getWeekIdForWindow — stabile weekId für Nicht-Montag-Wochenstart', () => {
  // Samstag-Start-Fenster: Sa 4. Juli – Fr 10. Juli 2026 (Donnerstag 9. Juli → KW 28).
  // Sa/So liegen ISO in KW27, Mo–Fr in KW28 — genau die Bruchstelle des Bugs.
  const windowJul4to10 = [
    new Date(2026, 6, 4),  // Sa
    new Date(2026, 6, 5),  // So
    new Date(2026, 6, 6),  // Mo
    new Date(2026, 6, 7),  // Di
    new Date(2026, 6, 8),  // Mi
    new Date(2026, 6, 9),  // Do
    new Date(2026, 6, 10), // Fr
  ];

  it('liefert dieselbe id für jeden Referenztag desselben Sa-Start-Fensters', () => {
    const ids = windowJul4to10.map((d) => getWeekIdForWindow(d, 6));
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('2026-W28');
    expect(ids[0]).toBe(getWeekId(new Date(2026, 6, 9))); // ISO-Woche des Donnerstags
  });

  it('verankert am Donnerstag des Fensters, nicht am Referenztag', () => {
    // Sa 4. Juli liegt ISO in KW27, das Sa-Start-Fenster wird aber als KW28 geführt.
    expect(getWeekId(new Date(2026, 6, 4))).toBe('2026-W27');
    expect(getWeekIdForWindow(new Date(2026, 6, 4), 6)).toBe('2026-W28');
  });

  it('unterscheidet benachbarte Sa-Start-Fenster (keine Kollision)', () => {
    const prev = getWeekIdForWindow(new Date(2026, 5, 27), 6); // Sa 27. Juni – Fr 3. Juli
    const curr = getWeekIdForWindow(new Date(2026, 6, 4), 6);  // Sa 4. – Fr 10. Juli
    expect(prev).toBe('2026-W27');
    expect(curr).toBe('2026-W28');
    expect(prev).not.toBe(curr);
  });

  it('ist bei Montag-Start identisch zu getWeekId (rückwärtskompatibel)', () => {
    for (let i = 0; i < 21; i++) {
      const d = new Date(2026, 5, 20 + i); // 20. Juni – 10. Juli, quer über mehrere Wochen
      expect(getWeekIdForWindow(d, 1)).toBe(getWeekId(d));
    }
  });
});
