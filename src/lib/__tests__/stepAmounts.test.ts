import { describe, it, expect } from 'vitest';
import { scaleAmountsInStep, ingredientsForStep } from '../stepAmounts';
import type { Ingredient } from '@/types';

function ing(name: string, amount: number, unit: string): Ingredient {
  return { name, amount, unit, perPortions: 4 };
}

/**
 * Die echten Daten aus rei-58 (Safranrisotto). Das Rezept führt bewusst ZWEI
 * Butter-Posten: 1 EL zum Andämpfen, 20 g zum Verfeinern. Genau daran ist die
 * alte Anzeige gescheitert.
 */
const RISOTTO: Ingredient[] = [
  ing('Zwiebeln', 1, 'Stk'),
  ing('Knoblauchzehen', 2, 'Zehe'),
  ing('Safran', 2, 'Prise'),
  ing('Safranfäden', 1, 'Prise'),
  ing('Salz', 1, 'Prise'),
  ing('Pfeffer', 1, 'Prise'),
  ing('Butter', 1, 'EL'),
  ing('Parmesan am Stück', 80, 'g'),
  ing('Butter', 20, 'g'),
  ing('Gemüsebouillon', 9, 'dl'),
  ing('Risottoreis', 300, 'g'),
  ing('Weisswein', 2, 'dl'),
];

const SCHRITT_3  = 'In einer grossen Pfanne 1 EL Butter erhitzen und die gehackten Zwiebeln sowie den Knoblauch darin glasig andämpfen.';
const SCHRITT_8  = 'Den Reis insgesamt rund 20 Minuten köcheln lassen, bis er cremig, aber noch bissfest (al dente) ist.';
const SCHRITT_10 = 'Die Pfanne von der Hitze nehmen und die 20 g Butter sowie den geriebenen Parmesan unter das Risotto rühren, bis es schön cremig ist.';

describe('scaleAmountsInStep', () => {
  it('laesst den Text bei unveraenderter Portionenzahl unangetastet', () => {
    expect(scaleAmountsInStep(SCHRITT_3, RISOTTO, 4, 4)).toBe(SCHRITT_3);
  });

  it('verdoppelt die Mengen bei doppelter Portionenzahl', () => {
    expect(scaleAmountsInStep(SCHRITT_3, RISOTTO, 4, 8)).toContain('2 EL Butter');
    expect(scaleAmountsInStep(SCHRITT_10, RISOTTO, 4, 8)).toContain('40 g Butter');
  });

  it('halbiert bei halber Portionenzahl', () => {
    expect(scaleAmountsInStep(SCHRITT_10, RISOTTO, 4, 2)).toContain('10 g Butter');
  });

  it('laesst Garzeiten unangetastet', () => {
    // Der eigentliche Grund fuer den Entwurf: skaliert wird nur, was in der
    // Zutatenliste steht. "20 Minuten" ist keine Zutatenmenge.
    const out = scaleAmountsInStep(SCHRITT_8, RISOTTO, 4, 8);
    expect(out).toContain('rund 20 Minuten');
    expect(out).toBe(SCHRITT_8);
  });

  it('laesst Ofentemperaturen unangetastet', () => {
    const zutaten = [ing('Mehl', 200, 'g')];
    const s = 'Den Ofen auf 200 °C vorheizen und 200 g Mehl abwiegen.';
    const out = scaleAmountsInStep(s, zutaten, 4, 8);
    expect(out).toContain('200 °C');
    expect(out).toContain('400 g Mehl');
  });

  it('laesst Teilmengen ohne Entsprechung stehen', () => {
    // "6 EL Kochwasser" ist keine Zutat — die Angabe richtet sich nicht nach
    // der Portionenzahl und darf deshalb nicht mitwachsen.
    const s = 'Ca. 6 EL Kochwasser beiseitestellen und 1 EL Butter erhitzen.';
    const out = scaleAmountsInStep(s, RISOTTO, 4, 8);
    expect(out).toContain('6 EL Kochwasser');
    expect(out).toContain('2 EL Butter');
  });

  it('skaliert eine bereits ersetzte Menge nicht ein zweites Mal', () => {
    // 1 EL -> 2 EL. Gaebe es einen zweiten Durchgang, wuerde daraus 4 EL.
    const zutaten = [ing('Butter', 1, 'EL'), ing('Öl', 2, 'EL')];
    const out = scaleAmountsInStep('1 EL Butter und 2 EL Öl erhitzen.', zutaten, 4, 8);
    expect(out).toBe('2 EL Butter und 4 EL Öl erhitzen.');
  });

  it('verwechselt eine Teilzahl nicht mit einer laengeren Zahl', () => {
    const zutaten = [ing('Bouillon', 2, 'dl')];
    expect(scaleAmountsInStep('12 dl Wasser aufkochen.', zutaten, 4, 8)).toBe('12 dl Wasser aufkochen.');
  });

  it('erkennt ausgeschriebene Einheiten', () => {
    const zutaten = [ing('Butter', 20, 'g')];
    expect(scaleAmountsInStep('Die 20 Gramm Butter beigeben.', zutaten, 4, 8))
      .toBe('Die 40 Gramm Butter beigeben.');
  });

  it('kommt mit Dezimalzahlen und Komma zurecht', () => {
    const zutaten = [ing('Rahm', 0.5, 'dl')];
    expect(scaleAmountsInStep('0,5 dl Rahm dazugeben.', zutaten, 4, 8)).toBe('1 dl Rahm dazugeben.');
  });

  it('faellt bei leerem Text oder fehlenden Portionen nicht um', () => {
    expect(scaleAmountsInStep('', RISOTTO, 4, 8)).toBe('');
    expect(scaleAmountsInStep(SCHRITT_3, RISOTTO, 0, 8)).toBe(SCHRITT_3);
    expect(scaleAmountsInStep(SCHRITT_3, [], 4, 8)).toBe(SCHRITT_3);
  });
});

describe('ingredientsForStep', () => {
  it('waehlt bei doppeltem Namen den Posten, dessen Menge im Text steht', () => {
    // Der gemeldete Fehler: Schritt 10 nennt 20 g Butter, angezeigt wurde 1 EL.
    const out = ingredientsForStep(SCHRITT_10, RISOTTO);
    const butter = out.filter(i => i.name === 'Butter');
    expect(butter).toHaveLength(1);
    expect(butter[0]).toMatchObject({ amount: 20, unit: 'g' });
  });

  it('waehlt im Andaempf-Schritt die andere Butter', () => {
    const butter = ingredientsForStep(SCHRITT_3, RISOTTO).filter(i => i.name === 'Butter');
    expect(butter).toHaveLength(1);
    expect(butter[0]).toMatchObject({ amount: 1, unit: 'EL' });
  });

  it('zieht "Risottoreis" nicht in einen Schritt, der nur "Risotto" sagt', () => {
    // Der alte 5-Zeichen-Praefixvergleich ohne Wortgrenze tat genau das.
    expect(ingredientsForStep(SCHRITT_10, RISOTTO).map(i => i.name)).not.toContain('Risottoreis');
  });

  it('findet die im Schritt genannten Zutaten', () => {
    const namen = ingredientsForStep(SCHRITT_3, RISOTTO).map(i => i.name);
    expect(namen).toContain('Zwiebeln');
    expect(namen).toContain('Butter');
  });

  it('behaelt die Reihenfolge der Zutatenliste', () => {
    const out = ingredientsForStep(SCHRITT_10, RISOTTO);
    const idx = out.map(i => RISOTTO.indexOf(i));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('zeigt bei mehrdeutiger Lage alle Posten, statt still einen zu verschlucken', () => {
    const zutaten = [ing('Butter', 1, 'EL'), ing('Butter', 20, 'g')];
    // Keine Menge im Text → beide anzeigen, damit nichts unterschlagen wird.
    expect(ingredientsForStep('Die Butter aufschäumen lassen.', zutaten)).toHaveLength(2);
  });

  it('ignoriert Klammerzusaetze im Namen', () => {
    const zutaten = [ing('Zucchetti (fein gerieben)', 2, 'Stk')];
    expect(ingredientsForStep('Die Zucchetti reiben.', zutaten)).toHaveLength(1);
  });

  it('liefert eine leere Liste, wenn nichts passt', () => {
    expect(ingredientsForStep('Den Ofen vorheizen.', RISOTTO)).toEqual([]);
  });
});
