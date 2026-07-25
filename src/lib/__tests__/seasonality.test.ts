import { describe, it, expect } from 'vitest';
import { suggestWeek, isSeasonAppropriate, isWeatherOpposite } from '../suggestions';
import { getSeasonTypicalWeather } from '../utils';
import type { Recipe } from '@/types';

function makeRecipe(overrides: Partial<Recipe> & { id: string; name: string }): Recipe {
  return {
    category: 'Gemüsegerichte',
    timeMinutes: 30,
    tags: [],
    ingredients: [],
    weatherType: 'neutral',
    source: 'Test',
    basePortions: 4,
    description: '',
    dietCategory: 'vegetarian',
    ...overrides,
  };
}

/** Älplermagronen-Doppel: kalt + Herbst/Winter, in einer eigenen Kategorie. */
const WINTER_DISH = makeRecipe({
  id: 'winter-1',
  name: 'Älplermagronen',
  category: 'Aufläufe & Gratins',
  weatherType: 'kalt',
  tags: ['Herbst', 'Winter'],
});

/**
 * Sommergerichte bewusst ALLE in derselben Kategorie: ab dem 2. Tag greift der
 * Kategorie-Malus (-30, eskalierend) — genau die Konstellation, in der das
 * Saison-/Wetter-Signal (max. +25) früher überstimmt wurde.
 */
const SUMMER_DISHES: Recipe[] = Array.from({ length: 8 }, (_, i) =>
  makeRecipe({
    id: `sommer-${i}`,
    name: `Sommersalat ${i}`,
    category: 'Salate & Bowls',
    weatherType: 'warm',
    tags: ['Sommer'],
  }),
);

const ALL_WARM_DAYS = Object.fromEntries(
  Array.from({ length: 7 }, (_, i) => [i + 1, 'warm' as const]),
);

describe('isSeasonAppropriate', () => {
  it('behandelt Rezepte ohne Saison-Tag als immer passend', () => {
    expect(isSeasonAppropriate(makeRecipe({ id: 'a', name: 'A' }), 'Sommer')).toBe(true);
  });

  it('behandelt "Ganzjährig" als immer passend', () => {
    const r = makeRecipe({ id: 'b', name: 'B', tags: ['Ganzjährig', 'Winter'] });
    expect(isSeasonAppropriate(r, 'Sommer')).toBe(true);
  });

  it('erkennt die passende Saison', () => {
    expect(isSeasonAppropriate(SUMMER_DISHES[0], 'Sommer')).toBe(true);
  });

  it('erkennt Rezepte ausserhalb der Saison', () => {
    expect(isSeasonAppropriate(WINTER_DISH, 'Sommer')).toBe(false);
    expect(isSeasonAppropriate(WINTER_DISH, 'Winter')).toBe(true);
  });
});

describe('isWeatherOpposite', () => {
  it('erkennt kalt-Gericht am Hitzetag', () => {
    expect(isWeatherOpposite(WINTER_DISH, 'warm')).toBe(true);
  });

  it('wertet gleiches Wetter nicht als Konflikt', () => {
    expect(isWeatherOpposite(WINTER_DISH, 'kalt')).toBe(false);
  });

  it('wertet neutral (Rezept oder Tag) nie als Konflikt', () => {
    expect(isWeatherOpposite(makeRecipe({ id: 'n', name: 'N' }), 'warm')).toBe(false);
    expect(isWeatherOpposite(WINTER_DISH, 'neutral')).toBe(false);
    expect(isWeatherOpposite(WINTER_DISH, undefined)).toBe(false);
  });
});

describe('getSeasonTypicalWeather', () => {
  it('liefert saison-typische Werte als Prognose-Fallback', () => {
    expect(getSeasonTypicalWeather('Sommer')).toBe('warm');
    expect(getSeasonTypicalWeather('Winter')).toBe('kalt');
    expect(getSeasonTypicalWeather('Frühling')).toBe('neutral');
    expect(getSeasonTypicalWeather('Herbst')).toBe('neutral');
  });
});

describe('suggestWeek — Saison/Wetter schlägt Abwechslungs-Malus', () => {
  /**
   * Regression für den gemeldeten Bug: Älplermagronen (kalt, Herbst/Winter) wurde
   * im Hochsommer vorgeschlagen. Ursache war, dass der Kategorie-Malus (-30) das
   * gesamte Saison+Wetter-Signal (+25) überstimmte — sichtbar nur bei kleinem
   * Rezept-Pool (Produktion filtert auf approved === true).
   */
  it('schlägt an heissen Sommertagen NIE ein kaltes Winter-Gericht vor, solange Alternativen existieren', () => {
    const pool = [WINTER_DISH, ...SUMMER_DISHES];
    for (let run = 0; run < 200; run++) {
      const result = suggestWeek(pool, [], ALL_WARM_DAYS, 'Sommer', { showDinner: true });
      const picked = Object.values(result).map((d) => d.dinner?.recipeId);
      expect(picked).not.toContain(WINTER_DISH.id);
    }
  });

  it('füllt trotz strikter Saison-/Wetterfilter alle 7 Tage', () => {
    const pool = [WINTER_DISH, ...SUMMER_DISHES];
    const result = suggestWeek(pool, [], ALL_WARM_DAYS, 'Sommer', { showDinner: true });
    expect(Object.values(result).filter((d) => d.dinner?.recipeId).length).toBe(7);
  });

  it('wählt das Winter-Gericht im Winter durchaus aus', () => {
    const coldDays = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, 'kalt' as const]));
    let seen = false;
    for (let run = 0; run < 50 && !seen; run++) {
      const result = suggestWeek([WINTER_DISH, ...SUMMER_DISHES], [], coldDays, 'Winter', { showDinner: true });
      if (Object.values(result).some((d) => d.dinner?.recipeId === WINTER_DISH.id)) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('lässt unpassende Gerichte zu, wenn es KEINE passenden gibt (kein leerer Tag)', () => {
    // Nur ausser-saisonale Rezepte im Pool → Fallback-Leiter muss trotzdem füllen.
    const onlyWinter = Array.from({ length: 8 }, (_, i) =>
      makeRecipe({
        id: `w${i}`, name: `Wintergericht ${i}`,
        category: 'Suppen, Eintöpfe & Currys', weatherType: 'kalt', tags: ['Winter'],
      }),
    );
    const result = suggestWeek(onlyWinter, [], ALL_WARM_DAYS, 'Sommer', { showDinner: true });
    expect(Object.values(result).filter((d) => d.dinner?.recipeId).length).toBe(7);
  });
});
