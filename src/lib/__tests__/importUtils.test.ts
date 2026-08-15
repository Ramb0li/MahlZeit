import { describe, it, expect } from 'vitest';
import {
  normalizeImportUnit, normalizeImportAmount, stripMarkupTail, extractStepKeywords, extractTimes, extractTemperatures,
  resolveDietCategory, validateTags, mainIngredientHash, mainIngredientTokens,
  ingredientSimilarity, findDuplicate, slugify,
  buildIngredients, isValidCategory, assertValidRecipe,
  normalizeInstructions, parseJsonLdLoose,
} from '../../../scripts/import-utils';

describe('normalizeImportUnit', () => {
  it('laesst erlaubte Einheiten unveraendert', () => {
    expect(normalizeImportUnit('g')).toBe('g');
    expect(normalizeImportUnit('EL')).toBe('EL');
    expect(normalizeImportUnit('Zweig')).toBe('Zweig');
  });

  it('bildet Plurale und Synonyme ab', () => {
    expect(normalizeImportUnit('Zehen')).toBe('Zehe');
    expect(normalizeImportUnit('Prisen')).toBe('Prise');
    expect(normalizeImportUnit('Zweige')).toBe('Zweig');
    expect(normalizeImportUnit('Esslöffel')).toBe('EL');
    expect(normalizeImportUnit('gramm')).toBe('g');
  });

  it('rechnet Liter in dl um und zieht die Menge mit', () => {
    // Regression: "Liter" liess den Spargelrisotto-Import scheitern. Eine reine
    // Umbenennung waere falsch — aus 1 Liter muessen 10 dl werden.
    expect(normalizeImportAmount(1, 'Liter')).toEqual({ amount: 10, unit: 'dl' });
    expect(normalizeImportAmount(1.5, 'l')).toEqual({ amount: 15, unit: 'dl' });
    expect(normalizeImportAmount(50, 'cl')).toEqual({ amount: 500, unit: 'ml' });
  });

  it('bildet stueckartige Einheiten auf Stk ab, ohne die Menge zu aendern', () => {
    // "Stängel" (Zitronengras) liess zwei Thai-Currys scheitern.
    expect(normalizeImportAmount(3, 'Stängel')).toEqual({ amount: 3, unit: 'Stk' });
    expect(normalizeImportAmount(2, 'Scheiben')).toEqual({ amount: 2, unit: 'Stk' });
    expect(normalizeImportAmount(1, 'Kopf')).toEqual({ amount: 1, unit: 'Stk' });
    expect(normalizeImportAmount(1, 'Msp')).toEqual({ amount: 1, unit: 'Prise' });
  });

  it('laesst erlaubte Einheiten und Mengen unveraendert', () => {
    expect(normalizeImportAmount(400, 'g')).toEqual({ amount: 400, unit: 'g' });
    expect(normalizeImportAmount(2, 'Zehen')).toEqual({ amount: 2, unit: 'Zehe' });
  });

  it('wirft bei nicht abbildbaren Einheiten statt sie durchzulassen', () => {
    // "Dose" laesst sich ohne Fuellmenge nicht verlustfrei umrechnen —
    // ein harter Fehler ist besser als eine falsche Einkaufsmenge.
    expect(() => normalizeImportUnit('Dose')).toThrow(/nicht erlaubt/);
    expect(() => normalizeImportUnit('Handvoll')).toThrow();
    expect(() => normalizeImportUnit('')).toThrow();
  });
});

describe('extractStepKeywords', () => {
  it('nimmt ein Leitverb pro Schritt und behaelt die Reihenfolge', () => {
    const steps = [
      'Das Gemüse in feine Würfel schneiden.',
      'Die Zwiebeln in der Pfanne anbraten.',
      'Alles im Backofen backen.',
      'Zum Schluss mit Käse gratinieren.',
    ];
    expect(extractStepKeywords(steps)).toEqual(['schneiden', 'anbraten', 'backen', 'gratinieren']);
  });

  it('verwechselt "anbraten" nicht mit "braten"', () => {
    expect(extractStepKeywords(['Die Zwiebeln anbraten.'])).toEqual(['anbraten']);
  });

  it('laesst den letzten Schritt nicht durch den Cap herausfallen', () => {
    // Regression: ein frueherer Ansatz sammelte die ersten 8 Treffer ueber ALLE
    // Schritte hinweg — dabei fiel ausgerechnet der Backschritt heraus.
    const steps = [
      'schneiden', 'hacken', 'schälen', 'reiben', 'mischen', 'würzen', 'kochen', 'backen',
    ].map(v => `Jetzt alles ${v}.`);
    const out = extractStepKeywords(steps);
    expect(out).toHaveLength(8);
    expect(out[out.length - 1]).toBe('backen');
  });

  it('begrenzt auf max Schritte', () => {
    const steps = Array.from({ length: 20 }, (_, i) => `Schritt ${i} zum kochen.`);
    expect(extractStepKeywords(steps).length).toBeLessThanOrEqual(8);
  });

  it('kommt mit leeren Eingaben zurecht', () => {
    expect(extractStepKeywords([])).toEqual([]);
    expect(extractStepKeywords(['Nichts Verwertbares hier.'])).toEqual([]);
  });
});

describe('extractTimes / extractTemperatures', () => {
  it('findet Zeitangaben und entfernt Duplikate', () => {
    const out = extractTimes(['30 Min. backen.', 'Weitere 30 Min. ruhen.', '2 Stunden marinieren.']);
    expect(out).toContain('30 Min.');
    expect(out).toContain('2 Stunden');
    expect(out.filter(t => t === '30 Min.')).toHaveLength(1);
  });

  it('findet Temperaturen in beiden Schreibweisen', () => {
    const out = extractTemperatures(['Bei 220 °C backen.', 'Auf 180 Grad reduzieren.']);
    expect(out.join(' ')).toMatch(/220/);
    expect(out.join(' ')).toMatch(/180/);
  });
});

describe('resolveDietCategory', () => {
  it('erkennt Fleisch und ueberstimmt das Modell', () => {
    expect(resolveDietCategory(['Hackfleisch', 'Tomaten'], 'vegetarian')).toBe('meat');
    expect(resolveDietCategory(['Pouletbrüstli'], 'vegan')).toBe('meat');
    expect(resolveDietCategory(['Speckwürfeli'], 'vegetarian')).toBe('meat');
  });

  it('erkennt Fisch und Meeresfruechte', () => {
    expect(resolveDietCategory(['Lachsfilet', 'Zitrone'], 'vegetarian')).toBe('fish');
    expect(resolveDietCategory(['Crevetten'], 'vegetarian')).toBe('fish');
  });

  it('laesst Fleisch vor Fisch gewinnen', () => {
    expect(resolveDietCategory(['Lachs', 'Speck'])).toBe('meat');
  });

  it('haelt "gehackte Tomaten" nicht fuer Fleisch', () => {
    // Regression: ein blosser Teilstring-Abgleich auf "hack" stufte im echten
    // Bestand 5 vegane bzw. vegetarische Gerichte als Fleischgericht ein.
    expect(resolveDietCategory(['Gehackte Tomaten (Dose)', 'Linsen'], 'vegan')).toBe('vegan');
    expect(resolveDietCategory(['gehackte Tomaten', 'Spaghetti'], 'vegan')).toBe('vegan');
  });

  it('haelt vegane Fleischersatzprodukte nicht fuer Fleisch', () => {
    expect(resolveDietCategory(['Sonnenblumen-Hack', 'Kidneybohnen'], 'vegan')).toBe('vegan');
  });

  it('laesst sich nicht von aehnlich klingenden Woertern taeuschen', () => {
    expect(resolveDietCategory(['Tamarindenpaste', 'Reis'], 'vegan')).toBe('vegan');
    expect(resolveDietCategory(['Wildkräuter', 'Blattsalat'], 'vegan')).toBe('vegan');
    expect(resolveDietCategory(['Polenta', 'Tomaten'], 'vegetarian')).toBe('vegetarian');
  });

  it('uebernimmt vegan nur vom Modell', () => {
    expect(resolveDietCategory(['Tomaten', 'Basilikum'], 'vegan')).toBe('vegan');
    expect(resolveDietCategory(['Tomaten', 'Basilikum'], 'vegetarian')).toBe('vegetarian');
    expect(resolveDietCategory(['Tomaten'])).toBe('vegetarian');
  });
});

describe('validateTags', () => {
  it('akzeptiert gueltige Tags und entfernt Duplikate', () => {
    const { tags } = validateTags(['Abendessen', 'Abendessen', 'Ofengericht', 'Winter', 'Italienisch']);
    expect(tags).toEqual(['Abendessen', 'Ofengericht', 'Winter', 'Italienisch']);
  });

  it('wirft bei unbekannten Tags statt sie zu filtern', () => {
    expect(() => validateTags(['Abendessen', 'Erfunden'])).toThrow(/Unbekannte Tags/);
  });

  it('wirft, wenn tags kein Array ist', () => {
    expect(() => validateTags('Abendessen')).toThrow();
    expect(() => validateTags(undefined)).toThrow();
  });

  it('meldet fehlende Pflichtgruppen als Warnung, nicht als Fehler', () => {
    const { warnings } = validateTags(['Italienisch']);
    expect(warnings.join(' ')).toMatch(/Mahlzeit/);
    expect(warnings.join(' ')).toMatch(/Zubereitung/);
    expect(warnings.join(' ')).toMatch(/Saison/);
  });

  it('warnt bei mehr als einem Kuechen-Tag', () => {
    const { warnings } = validateTags(['Abendessen', 'Ofengericht', 'Winter', 'Italienisch', 'Griechisch']);
    expect(warnings.join(' ')).toMatch(/Küchen-Tags/);
  });
});

describe('mainIngredientHash', () => {
  it('ist unabhaengig von der Reihenfolge', () => {
    const a = mainIngredientHash(['Lasagneblätter', 'Hackfleisch', 'Tomaten']);
    const b = mainIngredientHash(['Tomaten', 'Lasagneblätter', 'Hackfleisch']);
    expect(a).toBe(b);
  });

  it('ignoriert Grundzutaten wie Salz, Pfeffer und Öl', () => {
    const ohne = mainIngredientHash(['Hackfleisch', 'Tomaten']);
    const mit  = mainIngredientHash(['Hackfleisch', 'Salz', 'Pfeffer', 'Olivenöl', 'Tomaten', 'Wasser']);
    expect(ohne).toBe(mit);
  });

  it('unterscheidet verschiedene Gerichte', () => {
    expect(mainIngredientHash(['Hackfleisch', 'Tomaten']))
      .not.toBe(mainIngredientHash(['Lachs', 'Zitrone']));
  });

  it('ignoriert Vorbereitungshinweise in Klammern', () => {
    expect(mainIngredientHash(['Zwiebel (fein gehackt)'])).toBe(mainIngredientHash(['Zwiebel']));
  });

  it('behandelt Singular und Plural als dieselbe Zutat', () => {
    expect(mainIngredientHash(['Bio-Zitrone'])).toBe(mainIngredientHash(['Bio-Zitronen']));
    expect(mainIngredientHash(['Tomate'])).toBe(mainIngredientHash(['Tomaten']));
  });
});

describe('findDuplicate — Regression aus dem Testlauf', () => {
  /**
   * Beim ersten Testlauf wurden zwei echte Duplikate NICHT erkannt, weil ein
   * exakter Hash-Vergleich Mengengleichheit verlangte. Beide Fälle sind hier
   * mit den realen Zutatenlisten festgehalten.
   */
  it('erkennt sal-61 "Pastasalat" trotz Singular/Plural-Abweichung', () => {
    const alt = ['Teigwaren', 'Pinienkerne', 'Bio-Zitrone (Schale abgerieben)', 'Rucola',
      'Mozzarella-Perlen', 'Grillgemüse in Öl (Glas)', 'Getrocknete Tomaten in Öl',
      'Entsteinte schwarze Oliven', 'Aceto balsamico bianco', 'Olivenöl', 'Salz', 'Pfeffer'];
    const neu = ['Teigwaren', 'Salz', 'Aceto balsamico bianco', 'Olivenöl', 'Bio-Zitronen',
      'Salz', 'Pfeffer', 'Pinienkerne', 'Rucola', 'Mozzarella-Perlen', 'Grillgemüse in Öl',
      'getrocknete Tomaten in Öl', 'entsteinte schwarze Oliven'];

    const hit = findDuplicate(mainIngredientTokens(neu), [
      { id: 'sal-61', name: 'Pastasalat', tokens: mainIngredientTokens(alt) },
    ]);
    expect(hit).not.toBeNull();
    expect(hit!.match.id).toBe('sal-61');
  });

  it('erkennt son-98 "Buntes Grillgemüse" trotz aufgeteilter Zutat', () => {
    const alt = ['Cherry-Tomaten (verschiedenfarbig)', 'Rosmarin', 'Olivenöl', 'Fleur de Sel',
      'Rote Zwiebeln (in Scheiben geschnitten)', 'Holzspiesschen', 'Honig', 'Cayennepfeffer',
      'Pfeffer', 'Festkochende Kartoffeln', 'Süsskartoffeln', 'Olivenöl', 'Salz', 'Thymian',
      'Hornpeperoni', 'Frischkäse', 'Schnittlauch (fein geschnitten)', 'Olivenöl', 'Pfeffer', 'Salz'];
    const neu = ['Holzspiesschen', 'Cherry-Tomaten', 'verschiedenfarbig', 'rote Zwiebeln',
      'festkochende Kartoffeln', 'Süsskartoffeln', 'Hornpeperoni', 'Rosmarin', 'Thymian',
      'Honig', 'Salz', 'Olivenöl', 'Pfeffer', 'Frischkäse', 'Schnittlauch', 'Fleur de Sel',
      'Cayennepfeffer', 'Olivenöl'];

    const hit = findDuplicate(mainIngredientTokens(neu), [
      { id: 'son-98', name: 'Buntes Grillgemüse', tokens: mainIngredientTokens(alt) },
    ]);
    expect(hit).not.toBeNull();
    expect(hit!.match.id).toBe('son-98');
  });

  it('haelt Risotti mit gleicher Basis auseinander', () => {
    // Regression fuer den 45er-Batch: vier Risotti teilen Reis, Zwiebel, Bouillon,
    // Weisswein und Parmesan und kommen untereinander auf 71 %. Bei der alten
    // Schwelle 0.7 haetten sich drei von vier gegenseitig verdraengt.
    const basis = ['Risottoreis', 'Zwiebel', 'Gemuesebouillon', 'Weisswein', 'Parmesan', 'Butter', 'Salz', 'Pfeffer'];
    const safran    = mainIngredientTokens([...basis, 'Safran']);
    const steinpilz = mainIngredientTokens([...basis, 'Steinpilze']);
    const spargel   = mainIngredientTokens([...basis, 'Spargeln']);

    expect(findDuplicate(safran,    [{ id: 'r1', name: 'Steinpilzrisotto', tokens: steinpilz }])).toBeNull();
    expect(findDuplicate(safran,    [{ id: 'r2', name: 'Spargelrisotto',   tokens: spargel   }])).toBeNull();
    expect(findDuplicate(steinpilz, [{ id: 'r3', name: 'Spargelrisotto',   tokens: spargel   }])).toBeNull();
  });

  it('erkennt echte Duplikate auch bei der schaerferen Schwelle weiter', () => {
    // Die beiden realen Treffer aus dem Testlauf lagen bei 100 % und 86 %.
    const alt = ['Teigwaren', 'Pinienkerne', 'Bio-Zitrone (Schale abgerieben)', 'Rucola',
      'Mozzarella-Perlen', 'Grillgemüse in Öl (Glas)', 'Getrocknete Tomaten in Öl',
      'Entsteinte schwarze Oliven', 'Aceto balsamico bianco', 'Olivenöl', 'Salz', 'Pfeffer'];
    const neu = ['Teigwaren', 'Salz', 'Aceto balsamico bianco', 'Olivenöl', 'Bio-Zitronen',
      'Salz', 'Pfeffer', 'Pinienkerne', 'Rucola', 'Mozzarella-Perlen', 'Grillgemüse in Öl',
      'getrocknete Tomaten in Öl', 'entsteinte schwarze Oliven'];
    expect(findDuplicate(mainIngredientTokens(neu), [
      { id: 'sal-61', name: 'Pastasalat', tokens: mainIngredientTokens(alt) },
    ])).not.toBeNull();
  });

  it('hält verschiedene Gerichte auseinander', () => {
    const lasagne = mainIngredientTokens(['Lasagneblätter', 'Hackfleisch', 'Tomaten', 'Béchamel']);
    const salat   = mainIngredientTokens(['Rucola', 'Mozzarella', 'Pinienkerne', 'Teigwaren']);
    expect(findDuplicate(lasagne, [{ id: 'sal-64', name: 'Salat', tokens: salat }])).toBeNull();
  });

  it('wählt bei mehreren Treffern den ähnlichsten', () => {
    const kandidat = mainIngredientTokens(['Tomaten', 'Mozzarella', 'Basilikum', 'Teigwaren']);
    const hit = findDuplicate(kandidat, [
      { id: 'a', name: 'Teilweise', tokens: mainIngredientTokens(['Tomaten', 'Mozzarella', 'Basilikum', 'Reis']) },
      { id: 'b', name: 'Identisch', tokens: kandidat },
    ]);
    expect(hit!.match.id).toBe('b');
    expect(hit!.similarity).toBe(1);
  });
});

describe('ingredientSimilarity', () => {
  it('liefert 1 bei identischen und 0 bei disjunkten Mengen', () => {
    expect(ingredientSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(ingredientSimilarity(['a'], ['b'])).toBe(0);
    expect(ingredientSimilarity([], ['a'])).toBe(0);
  });

  it('rechnet Jaccard korrekt', () => {
    // Schnittmenge 2, Vereinigung 4 -> 0.5
    expect(ingredientSimilarity(['a', 'b', 'c'], ['a', 'b', 'd'])).toBeCloseTo(0.5, 5);
  });
});

describe('slugify', () => {
  it('loest Umlaute auf und erzeugt Bindestriche', () => {
    expect(slugify('Spiegeleier mit Rahmspinat und Bratkartoffeln'))
      .toBe('spiegeleier-mit-rahmspinat-und-bratkartoffeln');
    expect(slugify('Grillierte Auberginen mit Küchenkräutern'))
      .toBe('grillierte-auberginen-mit-kuechenkraeutern');
  });

  it('haengt keine Bindestriche an die Raender', () => {
    expect(slugify('  Rüebli!  ')).toBe('rueebli');
  });
});

describe('buildIngredients', () => {
  const groups = [
    { name: 'Zutaten für die Sauce', ingredients: [
      { name: 'Tomaten', amount: 400, unit: 'g' },
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
    ]},
    { name: 'Zutaten für die Béchamel', ingredients: [
      { name: 'Milch', amount: 5, unit: 'dl' },
      { name: 'Olivenöl', amount: 1, unit: 'EL' },
    ]},
  ];

  it('baut das flache Array als Konkatenation inklusive Wiederholungen', () => {
    const { ingredients } = buildIngredients(groups, 4);
    expect(ingredients.map(i => i.name)).toEqual(['Tomaten', 'Olivenöl', 'Milch', 'Olivenöl']);
    expect(ingredients.filter(i => i.name === 'Olivenöl')).toHaveLength(2);
  });

  it('setzt perPortions auf basePortions', () => {
    const { ingredients } = buildIngredients(groups, 6);
    expect(ingredients.every(i => i.perPortions === 6)).toBe(true);
  });

  it('normalisiert die Einheiten', () => {
    const { ingredients } = buildIngredients(
      [{ name: 'Zutaten für X', ingredients: [{ name: 'Knoblauch', amount: 2, unit: 'Zehen' }] }], 4,
    );
    expect(ingredients[0].unit).toBe('Zehe');
  });

  it('wirft bei leeren Gruppen oder ungueltigen Mengen', () => {
    expect(() => buildIngredients([], 4)).toThrow(/leer/);
    expect(() => buildIngredients([{ name: 'Zutaten für X', ingredients: [] }], 4)).toThrow(/leer/);
    expect(() => buildIngredients(
      [{ name: 'Zutaten für X', ingredients: [{ name: 'Y', amount: 0, unit: 'g' }] }], 4,
    )).toThrow(/Menge/);
  });
});

describe('isValidCategory', () => {
  it('erkennt gueltige und ungueltige Kategorien', () => {
    expect(isValidCategory('Pasta & Teigwaren')).toBe(true);
    expect(isValidCategory('Grillgerichte')).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });
});

describe('assertValidRecipe', () => {
  function valid(): Record<string, unknown> {
    const { ingredientGroups, ingredients } = buildIngredients(
      [{ name: 'Zutaten für X', ingredients: [{ name: 'Tomaten', amount: 400, unit: 'g' }] }], 4,
    );
    return {
      id: 'pas-99', name: 'Testgericht', category: 'Pasta & Teigwaren',
      weatherType: 'kalt', dietCategory: 'vegetarian', licenseStatus: 'adapted',
      timeMinutes: 45, basePortions: 4, description: 'Eine Beschreibung.',
      steps: ['Die Tomaten schneiden.'], ingredients, ingredientGroups,
      approved: false, imageUrl: null,
    };
  }

  it('laesst einen vollstaendigen Datensatz durch', () => {
    expect(() => assertValidRecipe(valid())).not.toThrow();
  });

  it('blockt nummerierte Schritte', () => {
    expect(() => assertValidRecipe({ ...valid(), steps: ['1. Die Tomaten schneiden.'] }))
      .toThrow(/Nummerierungspräfix/);
    expect(() => assertValidRecipe({ ...valid(), steps: ['Schritt 1: Schneiden.'] }))
      .toThrow(/Nummerierungspräfix/);
  });

  it('erzwingt approved false und imageUrl null', () => {
    expect(() => assertValidRecipe({ ...valid(), approved: true })).toThrow(/approved/);
    expect(() => assertValidRecipe({ ...valid(), imageUrl: 'https://fooby.ch/x.jpg' })).toThrow(/imageUrl/);
  });

  it('blockt ungueltige Enum-Werte', () => {
    expect(() => assertValidRecipe({ ...valid(), weatherType: 'heiss' })).toThrow(/weatherType/);
    expect(() => assertValidRecipe({ ...valid(), licenseStatus: 'egal' })).toThrow(/licenseStatus/);
    expect(() => assertValidRecipe({ ...valid(), category: 'Grillgerichte' })).toThrow(/category/);
  });

  it('blockt durchgeschlagene Tool-Syntax in Textfeldern', () => {
    // Real beobachtet: die description endete mit
    // "...am Tisch sitzt.</description>\n<parameter name="category">Pasta & Teigwaren"
    const kaputt = 'Eine schoene Lasagne.</description>\n<parameter name="category">Pasta & Teigwaren';
    expect(() => assertValidRecipe({ ...valid(), description: kaputt })).toThrow(/Tool-Serialisierung/);
    expect(() => assertValidRecipe({ ...valid(), name: 'Lasagne</name>' })).toThrow(/Tool-Serialisierung/);
    expect(() => assertValidRecipe({ ...valid(), steps: ['Schneiden.</steps>'] })).toThrow(/Tool-Serialisierung/);
  });

  it('stripMarkupTail rettet den sauberen Teil vor dem Artefakt', () => {
    const kaputt = 'Eine klassische Lasagne, aber ohne Tomatensauce.</description>\n<parameter name="category">Pasta';
    expect(stripMarkupTail(kaputt)).toBe('Eine klassische Lasagne, aber ohne Tomatensauce.');
  });

  it('stripMarkupTail laesst sauberen Text unveraendert', () => {
    const ok = 'Ein herzhafter Klassiker fuer kalte Abende.';
    expect(stripMarkupTail(ok)).toBe(ok);
  });

  it('stripMarkupTail gibt null zurueck, wenn nur ein Halbsatz bleibt', () => {
    // Kein vollstaendiger Satz -> lieber harter Fehler als Fragment in der DB
    expect(stripMarkupTail('Eine klassische</description><parameter name="x">y')).toBeNull();
    expect(stripMarkupTail('</description>nur Muell')).toBeNull();
    expect(stripMarkupTail('')).toBeNull();
  });

  it('laesst harmlose Sonderzeichen durch', () => {
    expect(() => assertValidRecipe({
      ...valid(), description: 'Tomaten & Mozzarella — bei 220 °C, 3/4 TL Salz.',
    })).not.toThrow();
  });

  it('erkennt, wenn ingredients nicht zur Gruppensumme passt', () => {
    const r = valid();
    (r.ingredients as unknown[]).push({ name: 'Extra', amount: 1, unit: 'g', perPortions: 4 });
    expect(() => assertValidRecipe(r)).toThrow(/Konkatenation/);
  });
});

// ---------------------------------------------------------------------------
// normalizeInstructions — die vier Formen, die in freier Wildbahn vorkommen
// ---------------------------------------------------------------------------

describe('normalizeInstructions', () => {
  it('nimmt HowToStep[] (fooby.ch)', () => {
    expect(normalizeInstructions([
      { '@type': 'HowToStep', name: 'Sauce', text: 'Zwiebeln andünsten.' },
      { '@type': 'HowToStep', name: 'Backen', text: 'Im Ofen backen.' },
    ])).toEqual(['Zwiebeln andünsten.', 'Im Ofen backen.']);
  });

  it('nimmt string[] (gutekueche.at)', () => {
    expect(normalizeInstructions(['Fisch würfeln.', 'Spiesse grillieren.']))
      .toEqual(['Fisch würfeln.', 'Spiesse grillieren.']);
  });

  it('flacht HowToSection[] auf die enthaltenen Schritte ab (emmikochteinfach.de)', () => {
    expect(normalizeInstructions([
      {
        '@type': 'HowToSection',
        name: 'Vorbereitung',
        itemListElement: [
          { '@type': 'HowToStep', text: 'Ofen vorheizen.' },
          { '@type': 'HowToStep', text: 'Flügel trocken tupfen.' },
        ],
      },
      {
        '@type': 'HowToSection',
        name: 'Backen',
        itemListElement: [{ '@type': 'HowToStep', text: '45 Minuten backen.' }],
      },
    ])).toEqual(['Ofen vorheizen.', 'Flügel trocken tupfen.', '45 Minuten backen.']);
  });

  it('zerlegt einen einzelnen Fliesstext in Saetze (hennesfinest.com)', () => {
    expect(normalizeInstructions('Muscheln putzen. Grill vorheizen. Zwei Minuten grillieren.'))
      .toEqual(['Muscheln putzen.', 'Grill vorheizen.', 'Zwei Minuten grillieren.']);
  });

  it('faellt auf name zurueck, wenn text fehlt', () => {
    expect(normalizeInstructions([{ '@type': 'HowToStep', name: 'Anbraten' }])).toEqual(['Anbraten']);
  });

  it('liefert eine leere Liste statt zu werfen', () => {
    expect(normalizeInstructions(undefined)).toEqual([]);
    expect(normalizeInstructions(null)).toEqual([]);
    expect(normalizeInstructions(42)).toEqual([]);
    expect(normalizeInstructions([])).toEqual([]);
  });

  it('das Ergebnis taugt weiterhin als Eingabe fuer extractStepKeywords', () => {
    const steps = normalizeInstructions([
      { '@type': 'HowToSection', itemListElement: [{ text: 'Zwiebeln andünsten.' }] },
      { '@type': 'HowToSection', itemListElement: [{ text: 'Im Ofen backen bei 200 Grad.' }] },
    ]);
    expect(extractStepKeywords(steps).length).toBeGreaterThan(0);
    expect(extractTemperatures(steps)).toContain('200 Grad');
  });
});

// ---------------------------------------------------------------------------
// parseJsonLdLoose
// ---------------------------------------------------------------------------

describe('parseJsonLdLoose', () => {
  it('parst gueltiges JSON unveraendert', () => {
    expect(parseJsonLdLoose('{"@type":"Recipe","name":"Test"}'))
      .toEqual({ '@type': 'Recipe', name: 'Test' });
  });

  it('repariert rohe Wagenrueckläufe im String-Literal (amgrillplatz.de)', () => {
    // Genau die Form, an der JSON.parse dort scheitert.
    const kaputt = '{"recipeIngredient":["700g Hähnchenbrust\r","1 rote Paprika\r"]}';
    const parsed = parseJsonLdLoose(kaputt) as { recipeIngredient: string[] };
    expect(parsed.recipeIngredient).toHaveLength(2);
    expect(parsed.recipeIngredient[0]).toContain('Hähnchenbrust');
  });

  it('repariert Zeilenumbrueche und Tabs im String-Literal', () => {
    const parsed = parseJsonLdLoose('{"text":"Zeile1\nZeile2\tEnde"}') as { text: string };
    expect(parsed.text).toBe('Zeile1\nZeile2\tEnde');
  });

  it('laesst Steuerzeichen ausserhalb von Strings unangetastet', () => {
    expect(parseJsonLdLoose('{\n  "a": 1,\n  "b": 2\n}')).toEqual({ a: 1, b: 2 });
  });

  it('gibt null zurueck, wenn das Dokument wirklich kaputt ist', () => {
    expect(parseJsonLdLoose('{"a": ')).toBeNull();
    expect(parseJsonLdLoose('kein json')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveDietCategory — der Scan darf nur verschaerfen
// ---------------------------------------------------------------------------

describe('resolveDietCategory — Regression: kein Abschwaechen', () => {
  it('behaelt "meat" des Modells, wenn der Scan die Zutat nicht kennt', () => {
    // Der echte Fall: 1 kg "Chicken Wings" landete als vegetarisch in der Datenbank,
    // weil die Wortliste nur "Poulet" und "Hähnchen" kannte und der Scan das
    // korrekte 'meat' des Modells auf 'vegetarian' zurueckgesetzt hat.
    expect(resolveDietCategory(['Irgendein Fleisch ohne Stichwort', 'Salz'], 'meat')).toBe('meat');
    expect(resolveDietCategory(['Salz', 'Pfeffer'], 'meat')).toBe('meat');
  });

  it('behaelt "fish" des Modells, wenn der Scan nichts findet', () => {
    expect(resolveDietCategory(['Salz', 'Pfeffer'], 'fish')).toBe('fish');
  });

  it('verschaerft weiterhin gegen das Modell', () => {
    expect(resolveDietCategory(['Speckwürfeli'], 'vegan')).toBe('meat');
    expect(resolveDietCategory(['Lachsfilet'], 'vegetarian')).toBe('fish');
    expect(resolveDietCategory(['Lachs', 'Speck'], 'vegan')).toBe('meat');
  });

  it('laesst Fleisch vor Fisch gewinnen, auch wenn das Modell fish sagt', () => {
    expect(resolveDietCategory(['Speck', 'Lachs'], 'fish')).toBe('meat');
  });
});

describe('resolveDietCategory — deutsche und englische Gefluegel-Begriffe', () => {
  it('erkennt Chicken Wings', () => {
    expect(resolveDietCategory(['Chicken Wings', 'Paprikapulver'], 'vegetarian')).toBe('meat');
  });

  it('erkennt weitere Bezeichnungen', () => {
    for (const zutat of ['Hähnchenbrustfilet', 'Hühnchenschenkel', 'Geflügelbouillon',
                         'Putenbrust', 'Gyrosgewürz', 'Kalbsschnitzel']) {
      expect(resolveDietCategory([zutat, 'Salz'], 'vegan')).toBe('meat');
    }
  });

  it('haelt "Computer" nicht fuer Pute', () => {
    // "pute" steht deshalb in der Wortkanten-Liste und nicht in der Teilstring-Liste.
    expect(resolveDietCategory(['Computerpapier', 'Tomaten'], 'vegan')).toBe('vegan');
  });

  it('bleibt bei harmlosen Zutaten vegan', () => {
    expect(resolveDietCategory(['Kichererbsen', 'Kokosmilch', 'Rüebli'], 'vegan')).toBe('vegan');
  });
});
