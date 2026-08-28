import { describe, it, expect } from 'vitest';
import { ALLERGEN_KEYWORDS, matchesTerm, isRecipeExcluded, stripFalseFriends } from '../allergens';
import { ALLERGENS } from '../allergens-config';
import { EU_ALLERGEN_MAP, computeAllergens } from '../../../scripts/allergen-utils';

function rezept(...zutaten: string[]) {
  return {
    id: 'tst', name: 'Testgericht', basePortions: 4,
    ingredients: zutaten.map(name => ({ name, amount: 1, unit: 'Stk', perPortions: 4 })),
  };
}

describe('Schalenfruechte sind ueberhaupt waehlbar', () => {
  it('steht als Option in den Einstellungen', () => {
    // Vorher gab es nur Haselnuesse und Walnuesse. 55 Rezepte trugen das
    // EU-Allergen schalenfruechte, waehlbar war es nicht — Mandel- und
    // Cashewrezepte wurden Nussallergikern weiter vorgeschlagen.
    expect(ALLERGENS.map(a => a.id)).toContain('schalenfrüchte');
  });

  it('schliesst Mandeln, Cashew und Pistazien aus', () => {
    for (const n of ['Mandeln', 'Mandelmus', 'Cashewkerne', 'Pistazien', 'Pekannüsse', 'Baumnüsse']) {
      expect(isRecipeExcluded(rezept(n), ['schalenfrüchte'])).toBe(true);
    }
  });

  it('deckt Haselnuesse und Walnuesse mit ab', () => {
    expect(isRecipeExcluded(rezept('Haselnüsse'), ['schalenfrüchte'])).toBe(true);
    expect(isRecipeExcluded(rezept('Walnüsse'), ['schalenfrüchte'])).toBe(true);
  });

  it('greift nicht bei harmlosen Zutaten', () => {
    expect(isRecipeExcluded(rezept('Tomaten', 'Basilikum'), ['schalenfrüchte'])).toBe(false);
  });

  it('Filter und gespeichertes Allergen stimmen ueberein', () => {
    // Der eigentliche Fehler war die Asymmetrie zwischen beiden Wegen.
    for (const n of ['Mandeln', 'Cashewkerne', 'Pistazien']) {
      expect(computeAllergens(rezept(n))).toContain('schalenfruechte');
      expect(isRecipeExcluded(rezept(n), ['schalenfrüchte'])).toBe(true);
    }
  });

  it('die EU-Tabelle speist sich aus derselben Stichwortliste', () => {
    expect(EU_ALLERGEN_MAP.schalenfruechte).toEqual(ALLERGEN_KEYWORDS['schalenfrüchte']);
  });
});

describe('Weichtiere werden vom Schalentier-Filter erfasst', () => {
  it('erkennt Oktopus, Jakobsmuscheln und Miesmuscheln', () => {
    for (const n of ['Oktopus', 'Jakobsmuscheln', 'Miesmuscheln', 'Tintenfisch']) {
      expect(isRecipeExcluded(rezept(n), ['schalentiere'])).toBe(true);
    }
  });

  it('erkennt weiterhin Krebstiere', () => {
    for (const n of ['Crevetten', 'Gambas', 'Riesencrevetten']) {
      expect(isRecipeExcluded(rezept(n), ['schalentiere'])).toBe(true);
    }
  });
});

describe('Fehlfreunde — gemessene Fehltreffer aus dem Bestand', () => {
  it('Muschelnudeln sind eine Teigware, kein Schalentier', () => {
    // Wurde Schalentier-Allergikern weggefiltert (pas-64, sup-62).
    expect(isRecipeExcluded(rezept('Muschelnudeln'), ['schalentiere'])).toBe(false);
    expect(computeAllergens(rezept('Muschelnudeln'))).not.toContain('weichtiere');
  });

  it('Grillschnecken sind Brot, kein Weichtier', () => {
    expect(computeAllergens(rezept('Grillschnecken'))).not.toContain('weichtiere');
  });

  it('Kirschtomaten enthalten keinen Alkohol', () => {
    expect(isRecipeExcluded(rezept('Kirschtomaten'), ['alkohol'])).toBe(false);
    expect(computeAllergens(rezept('Kirschtomaten'))).not.toContain('sulfite');
  });

  it('"halbiert" enthaelt kein Bier', () => {
    // Trat erst auf, als eine Zutat den Zusatz "(halbiert, Kern entfernt)" bekam.
    expect(isRecipeExcluded(rezept('Avocados (halbiert, Kern entfernt)'), ['alkohol'])).toBe(false);
  });

  it('echte Treffer bleiben erhalten', () => {
    expect(isRecipeExcluded(rezept('Weisswein'), ['alkohol'])).toBe(true);
    expect(isRecipeExcluded(rezept('Venusmuscheln'), ['schalentiere'])).toBe(true);
    expect(isRecipeExcluded(rezept('Kirschwasser'), ['alkohol'])).toBe(true);
  });

  it('stripFalseFriends entfernt nur die bekannten Woerter', () => {
    expect(stripFalseFriends('Muschelnudeln')).not.toContain('muschel');
    expect(stripFalseFriends('Venusmuscheln')).toContain('muschel');
  });
});

describe('matchesTerm — Laengenstufen', () => {
  it('Zwei-Zeichen-Terme nur als ganzes Wort', () => {
    // "ei" traf den Wortanfang von "eingefroren" — sieben Rezepte galten
    // dadurch als eihaltig, ohne ein Ei zu enthalten.
    expect(matchesTerm('Ei', 'ei')).toBe(true);
    expect(matchesTerm('Ei (Grösse M)', 'ei')).toBe(true);
    expect(matchesTerm('Bananen (eingefroren)', 'ei')).toBe(false);
    expect(matchesTerm('Thunfisch im eigenen Saft', 'ei')).toBe(false);
    expect(matchesTerm('Möhren (für Einlage)', 'ei')).toBe(false);
    expect(matchesTerm('Wasser (zum Einweichen)', 'ei')).toBe(false);
  });

  it('Ei-Zusammensetzungen stehen ausgeschrieben in der Liste', () => {
    for (const n of ['Eigelb', 'Eiweiss', 'Spiegelei', 'Eischnee', 'Wachteleier']) {
      expect(isRecipeExcluded(rezept(n), ['ei'])).toBe(true);
    }
  });

  it('Drei-Zeichen-Terme am Wortanfang', () => {
    expect(matchesTerm('Sojasauce', 'soja')).toBe(true);
  });

  it('laengere Terme weiterhin als Teilstring, wegen Komposita', () => {
    expect(matchesTerm('Vollmilchschokolade', 'milch')).toBe(true);
    expect(matchesTerm('Katenschinkenwürfel', 'schinken')).toBe(true);
  });
});
