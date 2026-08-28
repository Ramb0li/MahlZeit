import { describe, it, expect } from 'vitest';
import { normalizeUnit } from '../unitConversion';
import { scaleIngredientAmount } from '../utils';

/**
 * Regression zum Aggregationsschlüssel der Einkaufsliste.
 *
 * In /api/shopping-list/route.ts wird pro Zutat ein Schlüssel aus Name UND Einheit
 * gebildet. Der Rezeptpfad normalisierte die Einheit über normalizeUnit, der Pfad
 * für manuell erfasste Beilagen-Zutaten nahm die rohe Einheit. Dieselbe Zutat
 * landete dadurch zweimal auf der Liste: "30 ml Olivenöl" aus dem Rezept und
 * "1 EL Olivenöl" aus der Beilage.
 *
 * Der Test bildet die Schlüsselbildung beider Pfade nach. Er prüft damit nicht die
 * Route selbst (die braucht Redis und eine Session), sondern die Eigenschaft, auf
 * der sie beruht: gleiche Zutat, gleicher Schlüssel.
 */
const key = (name: string, unit: string) => `${name.toLowerCase()}_${unit}`;

/** So bildet der Rezeptpfad den Schlüssel. */
function keyAusRezept(name: string, amount: number, unit: string, basePortions: number, portions: number) {
  const skaliert = scaleIngredientAmount(amount, basePortions, portions);
  const norm = normalizeUnit(name, skaliert, unit);
  return { key: key(name, norm.unit), amount: norm.amount };
}

/** So bildet der Beilagenpfad den Schlüssel — Menge 1:1, aber gleiche Normalisierung. */
function keyAusBeilage(name: string, amount: number, unit: string) {
  const norm = normalizeUnit(name, amount, unit);
  return { key: key(name, norm.unit), amount: norm.amount };
}

describe('Einkaufsliste: Rezept und Beilage landen im selben Eintrag', () => {
  it('Olivenöl aus Rezept und Beilage teilen den Schlüssel', () => {
    const rezept  = keyAusRezept('Olivenöl', 2, 'EL', 4, 4);   // 2 EL -> 30 ml
    const beilage = keyAusBeilage('Olivenöl', 1, 'EL');         // 1 EL -> 15 ml
    expect(beilage.key).toBe(rezept.key);
    expect(rezept.amount + beilage.amount).toBe(45);
  });

  it('gilt für alle Zutaten der Konversionstabelle', () => {
    for (const [name, erwartet] of [['Butter', 'g'], ['Honig', 'g'], ['Mehl', 'g'], ['Sojasauce', 'ml'], ['Balsamico', 'ml']] as const) {
      const rezept  = keyAusRezept(name, 2, 'EL', 4, 4);
      const beilage = keyAusBeilage(name, 1, 'TL');
      expect(rezept.key).toBe(key(name, erwartet));
      expect(beilage.key).toBe(rezept.key);
    }
  });

  it('mischt eine bereits in Gramm erfasste Beilage korrekt dazu', () => {
    const rezept  = keyAusRezept('Butter', 1, 'EL', 4, 4);   // 14 g
    const beilage = keyAusBeilage('Butter', 20, 'g');        // bleibt 20 g
    expect(beilage.key).toBe(rezept.key);
    expect(rezept.amount + beilage.amount).toBe(34);
  });

  it('lässt Einheiten ohne Konversion unverändert', () => {
    // Stk, Zehe, Prise und Unbekanntes werden nicht umgerechnet — dort ist der
    // rohe Schlüssel richtig und beide Pfade stimmen ohnehin überein.
    for (const unit of ['Stk', 'Zehe', 'Prise', 'Bund']) {
      expect(keyAusBeilage('Zwiebeln', 2, unit).key).toBe(key('Zwiebeln', unit));
    }
  });

  it('konvertiert eine unbekannte Zutat mit EL nicht', () => {
    const b = keyAusBeilage('Irgendwas Exotisches', 2, 'EL');
    expect(b.key).toBe(key('Irgendwas Exotisches', 'EL'));
    expect(b.amount).toBe(2);
  });
});
