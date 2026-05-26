/**
 * Allergen-Keyword-Mapping für Filter & Vorschläge.
 *
 * Jeder Allergen-ID wird eine Liste konkreter Zutatenwörter zugeordnet —
 * z.B. matcht "alkohol" auf "Wein", "Rum", "Bier", da Rezepte nie das
 * abstrakte Wort "Alkohol" verwenden.
 *
 * Wird genutzt von:
 *  - src/components/recipes/RecipeList.tsx  → graut Rezepte aus
 *  - src/lib/suggestions.ts                  → filtert Vorschläge
 */

export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: [
    'gluten', 'weizen', 'roggen', 'gerste', 'dinkel', 'mehl', 'paniermehl',
    'semmelbrösel', 'brot', 'brötchen', 'pasta', 'nudeln', 'spaghetti',
    'penne', 'lasagne', 'tagliatelle', 'couscous', 'bulgur', 'grieß', 'griess',
  ],
  weizen: [
    'weizen', 'weizenmehl', 'mehl', 'paniermehl', 'semmelbrösel',
    'pasta', 'nudeln', 'spaghetti', 'penne', 'lasagne', 'couscous', 'bulgur',
  ],
  laktose: [
    'milch', 'sahne', 'rahm', 'butter', 'käse', 'kaese', 'joghurt', 'jogurt',
    'quark', 'frischkäse', 'molke', 'kondensmilch', 'mascarpone', 'ricotta',
    'feta', 'mozzarella', 'parmesan', 'gorgonzola', 'cheddar', 'gouda',
  ],
  milch: [
    'milch', 'sahne', 'rahm', 'butter', 'käse', 'kaese', 'joghurt', 'jogurt',
    'quark', 'frischkäse', 'molke', 'kondensmilch', 'mascarpone', 'ricotta',
    'feta', 'mozzarella', 'parmesan',
  ],
  ei: [
    'ei', 'eier', 'eigelb', 'eiweiss', 'eiweiß', 'eiklar',
    'mayonnaise', 'mayo', 'aioli',
  ],
  fisch: [
    'fisch', 'lachs', 'thunfisch', 'kabeljau', 'forelle', 'hering', 'makrele',
    'sardine', 'anchovis', 'sardelle', 'dorsch', 'zander', 'barsch',
    'wolfsbarsch', 'seelachs', 'seehecht', 'pangasius',
  ],
  schalentiere: [
    'garnele', 'shrimp', 'krabbe', 'krebs', 'hummer', 'languste',
    'meeresfrüchte', 'tintenfisch', 'calamari', 'muschel', 'venusmuschel',
  ],
  erdnüsse: ['erdnuss', 'erdnüsse', 'erdnussbutter', 'erdnussöl', 'peanut'],
  haselnüsse: ['haselnuss', 'haselnüsse', 'nougat', 'nutella'],
  walnüsse: ['walnuss', 'walnüsse'],
  soja: [
    'soja', 'tofu', 'tempeh', 'edamame', 'sojasauce', 'soja-sauce',
    'sojamilch', 'miso', 'sojaöl', 'sojabohne',
  ],
  sesam: ['sesam', 'tahin', 'tahini', 'gomasio', 'sesamöl'],
  sellerie: ['sellerie', 'staudensellerie', 'knollensellerie', 'selleriesalz'],
  senf: ['senf', 'dijon', 'mostrich', 'senfkörner'],
  lupinen: ['lupine', 'lupinen', 'lupinenmehl'],
  alkohol: [
    'wein', 'rotwein', 'weisswein', 'weißwein', 'bier', 'rum', 'whisky',
    'whiskey', 'cognac', 'sekt', 'champagner', 'wodka', 'gin', 'schnaps',
    'likör', 'likoer', 'liqueur', 'alkohol', 'martini', 'wermut', 'amaretto',
    'kirsch', 'grappa', 'portwein', 'sherry',
  ],
  fruktose: [
    'apfel', 'birne', 'mango', 'honig', 'agavendicksaft', 'fruchtzucker',
    'agaven', 'apfelsaft', 'birnensaft',
  ],
  sorbit: [
    'sorbit', 'sorbitol', 'trockenobst', 'pflaume', 'kirsche', 'aprikose',
    'pfirsich', 'trockenpflaume',
  ],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Prüft, ob `haystack` den Term enthält.
 *
 * Kurze Terme (≤ 3 Zeichen) müssen am Wortanfang stehen — sonst matcht "Ei" auf "Eintopf".
 * Längere Terme matchen per einfachem Substring (gut für Komposita wie "Vollmilchschokolade").
 */
export function matchesTerm(haystack: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  const h = haystack.toLowerCase();
  if (t.length <= 3) {
    return new RegExp(`\\b${escapeRegex(t)}`, 'iu').test(h);
  }
  return h.includes(t);
}

/** Prüft, ob ein Rezept aufgrund von Allergien/Abneigungen ausgeschlossen ist. */
export function isRecipeExcluded(
  recipe: { name: string; ingredients: { name: string }[] },
  excludedIds: string[],
): boolean {
  if (!excludedIds?.length) return false;
  return excludedIds.some(id => {
    // Bekannter Allergen-Code → Synonymliste; sonst (freier Aversionstext) den Text selbst
    const keywords = ALLERGEN_KEYWORDS[id] ?? [id];
    return keywords.some(kw => {
      if (matchesTerm(recipe.name, kw)) return true;
      return recipe.ingredients.some(ing => matchesTerm(ing.name, kw));
    });
  });
}
