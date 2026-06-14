import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  startOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  addDays,
  subWeeks,
  parseISO,
  getISOWeek,
  getYear,
} from 'date-fns';
import { de } from 'date-fns/locale';
import type { Child, HouseholdSettings, PortionInfo, WeatherType } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWeekId(date: Date): string {
  const week = getISOWeek(date);
  const year = getYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getWeekDays(date: Date, startDay: 0|1|2|3|4|5|6 = 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn: startDay });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDayLabel(date: Date): string {
  return format(date, 'EEE dd.MM.', { locale: de });
}

export function formatDayShort(date: Date): string {
  return format(date, 'EEE', { locale: de });
}

export function nextWeek(date: Date): Date {
  return addWeeks(date, 1);
}

export function prevWeek(date: Date): Date {
  return subWeeks(date, 1);
}

/**
 * Returns today as the initial display date.
 * getWeekDays(date, startDay) automatically computes the correct 7-day window
 * based on the configured start day.
 */
export function getInitialDisplayWeek(_startDay = 1): Date {
  return new Date();
}

export function getChildPortionFactor(age: number): number {
  if (age < 3) return 0.25;
  if (age <= 6) return 0.5;
  if (age <= 12) return 0.75;
  return 1.0;
}

export function calculatePortions(household: HouseholdSettings): PortionInfo {
  const childPortions = household.children.reduce(
    (sum, child) => sum + getChildPortionFactor(child.age),
    0
  );
  return {
    adults: household.adults,
    childPortions,
    totalPortions: household.adults + childPortions,
  };
}

export function scaleIngredientAmount(
  baseAmount: number,
  basePortions: number,
  targetPortions: number
): number {
  const scaled = (baseAmount / basePortions) * targetPortions;
  if (scaled < 1) return Math.round(scaled * 4) / 4;
  if (scaled < 10) return Math.round(scaled * 2) / 2;
  return Math.round(scaled);
}

export function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Frühling';
  if (month >= 6 && month <= 8) return 'Sommer';
  if (month >= 9 && month <= 11) return 'Herbst';
  return 'Winter';
}

export function getWeatherTypeFromTemp(temp: number): WeatherType {
  if (temp < 12) return 'kalt';
  if (temp > 20) return 'warm';
  return 'neutral';
}

export const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  // Specific categories first — prevents substring conflicts with broader keywords below
  'Gewürze & Kräuter': [
    // Spice-specific keywords before generic 'paprika' or 'mais' can match in vegetables
    'paprikapulver', 'paprikagewürz', 'paprikagewürz', 'geräuchertes paprikapulver',
    // Classic spices & herbs
    'salz', 'pfeffer', 'pfefferkörner', 'muskatnuss', 'muskat',
    'kreuzkümmel', 'kümmel', 'kurkuma', 'currypulver', 'currypaste',
    'chiliflocken', 'chili', 'chilischote', 'chilipulver',
    'majoran', 'oregano', 'salbei', 'koriander', 'petersilie', 'peterli',
    'basilikum', 'minze', 'pfefferminze', 'kräuter', 'thymian', 'dill',
    'rosmarin', 'lorbeerblatt', 'lorbeerblätter', 'lorbeer',
    'nelke', 'nelken', 'nelkenpulver', 'kardamom', 'zimt',
    'ras el hanout', 'ras el-hanout', 'garam masala',
    'peperoncino', 'peperoncini', 'cayennepfeffer',
    'fajita-gewürz', 'gewürzmischung', 'pad thai sauce', 'pouletgewürz',
    'curryblätter', 'kala namak', 'zitronengras',
    'dijonsenf', 'senf', 'senfkörner',
    'zitronensaft', 'limettensaft', 'limette', 'zitrone',
    'zitronenschale', 'limettenblätter',
    'vanille', 'vanilleextrakt', 'vanillezucker', 'vanillinzucker', 'bourbon-vanille',
    'backpulver', 'natron',
    'fleur de sel', 'kräutersalz', 'knoblauchgranulat',
    'sesamöl', 'essig',
    'sambal oelek', 'worcestershire',
    'curry', 'tikka masala', 'tex mex', 'kakaopulver', 'kakao',
    'arrabbiata', 'béchamel', 'pad thai kochsauce',
  ],
  'Fleisch & Geflügel': [
    'poulet', 'hähnchen', 'hähnchenbrustfilet',
    'hackfleisch', 'rindshackfleisch', 'rinderfleisch', 'rindsfleisch', 'rindsfilet',
    'kalbsfleisch', 'kalbshackfleisch', 'kalbsgeschnetzeltes', 'kalbsnierstück', 'kalbsbratwurst',
    'lammrücken', 'lammfilet',
    'schweinefleisch', 'schweinsplätzchen',
    'speck', 'bauchspeck', 'speckwürfel',
    'schinken', 'rohschinken', 'toastschinken', 'katenschinkenwürfel', 'prosciutto',
    'bündnerfleisch', 'mortadella',
    'wurst', 'bratwurst', 'cervelat', 'cabanossi', 'chorizo', 'mettend',
    'leberkäse', 'brühwürstchen', 'bockwürste',
    'burger',
  ],
  'Fisch & Meeresfrüchte': [
    'fisch', 'lachs', 'fischfilets', 'seelachs', 'seelachsfilet',
    'thunfisch', 'thun (', 'thun (dose', 'makrele', 'makrelen',
    'crevetten', 'riesencrevetten', 'garnelen', 'shrimps',
    'anchovis', 'anchovisfilets', 'sardellen', 'sardellenfilets',
    'räucherlachs',
  ],
  'Getreide & Stärke': [
    // Specific starch keywords before 'mais' hits vegetables
    'maisstärke', 'maizena', 'speisestärke', 'stärke',
    // Grains & pasta
    'couscous', 'hirse', 'hirseflocken',
    'pasta', 'nudeln', 'spaghetti', 'penne', 'farfalle', 'tagliatelle', 'fusilli',
    'hörnli', 'lasagne', 'spätzli', 'reisnudeln', 'sobanudeln', 'ramen',
    'reis', 'risottoreis', 'basmatireis', 'jasminreis', 'vollkornreis',
    'quinoa', 'bulgur', 'polenta', 'ebly', 'urdinkelkerne', 'rollgerste',
    'weizentortillas', 'taco-shells', 'pitabrot', 'vollkornnudeln',
    'hartweizennudeln', 'hartweizengrieß', 'hartweizengrieß',
    'dinkelvollkornmehl', 'dinkelmehl', 'weizenmehl', 'kichererbsenmehl',
    'semmelbrösel', 'haferflocken', 'grieß', 'tortillas', 'wraps',
    'gnocchi', 'naan', 'baguette', 'brot', 'toast', 'mehl',
    'brötchen', 'weggil', 'weggli', 'fladenbrot',
    'tortiglioni', 'fregola', 'semola', 'hartweizengriess', 'panko', 'müesli', 'teigwaren',
    'blätterteig', 'pizzateig', 'croûton', 'tortilla', 'spätzle', 'rosinen', 'sultaninen',
    'älplermagronen', 'pastetli',
  ],
  'Hülsenfrüchte': [
    'linsen', 'kichererbsen', 'bohnen', 'erbsen (trocken)', 'gelbe erbsen',
    'schwarze bohnen', 'weisse bohnen', 'mungobohnen', 'mungbohnensprossen', 'sojasprossen',
  ],
  'Milchprodukte & Eier': [
    // Specific dairy names before generic 'milch' / 'käse' / 'rahm'
    'joghurt', 'jogurt', 'kefir',
    'mascarpone', 'philadelphia', 'frischkäse',
    'emmentaler', 'greyerzer', 'sbrinz', 'cheddar', 'appenzeller',
    'quark', 'speisequark', 'hüttenkäse',
    'brie', 'camembert', 'parmigiano', 'belper', 'fourme',
    'eigelb', 'crème', 'hafer',
    // Existing
    'eier', 'butter', 'rahm', 'milch', 'käse', 'parmesan', 'gruyère', 'feta', 'mozzarella',
    'ricotta', 'sauerrahm', 'ghee', 'tzatziki', 'sojajoghurt', 'sojaquark', 'sojadrink',
  ],
  'Nüsse & Samen': [
    'walnüsse', 'baumnüsse', 'pinienkerne', 'erdnüsse', 'cashew', 'mandeln', 'mandelmus',
    'sesammus', 'cashewmus', 'chiasamen',
    'haselnüsse', 'pecannüsse', 'pekannüsse',
    'sesam', 'sesamkörner', 'sesamsamen',
    'hanfsamen', 'leinsamen', 'sonnenblumenkerne', 'kürbiskerne', 'kokosflocken',
    'walnuss', 'mandel', 'saaten', 'datteln', 'marroni', 'erdnuss',
  ],
  'Tofu & Veganes': [
    'tofu', 'räuchertofu', 'falafel', 'naturtofu', 'sonnenblumen-hack',
  ],
  'Obst & Gemüse': [
    // Gemüse
    'spinat', 'blumenkohl', 'broccoli', 'brokkoli', 'lauch', 'kohlrabi', 'zucchini', 'zucchetti',
    'karotten', 'karotte', 'möhre', 'möhren', 'rüebli',
    'sellerie', 'staudensellerie', 'knollensellerie', 'stangensellerie',
    'paprika', 'peperoni', 'tomaten', 'tomate', 'kirschtomaten',
    'gurke', 'salatgurke', 'schlangengurke', 'salat', 'rucola',
    'erbsen', 'mais', 'kürbis', 'hokkaido', 'butternusskürbis', 'butternut',
    'süsskartoffel', 'kartoffel', 'avocado', 'pilz', 'champignon',
    'frühlingszwiebeln', 'bundzwiebeln', 'lauchzwiebeln',
    'zwiebel', 'schalotte', 'knoblauch', 'ingwer',
    'gemischtes gemüse', 'gemüse',
    'fenchel', 'pastinake', 'baby-spinat', 'babyspinat',
    'rotkohl', 'rotkabis', 'rotchabis', 'rosenkohl', 'mangold',
    'randen', 'rote bete', 'spargel', 'zuckerschote',
    'aubergine', 'federkohl', 'grünkohl', 'wirz', 'chicorée', 'pak-choi', 'radieschen', 'pfifferling',
    'schnittlauch', 'bärlauch', 'kresse', 'feldsalat',
    // Obst
    'apfel', 'äpfel', 'birne', 'banane', 'bananen', 'erdbeere', 'erdbeeren',
    'himbeere', 'himbeeren', 'heidelbeere', 'heidelbeeren', 'blaubeere', 'blaubeeren',
    'kirsche', 'kirschen', 'zwetschge', 'zwetschgen', 'pflaume', 'pflaumen',
    'orange', 'orangen', 'mandarine', 'mandarinen', 'clementine', 'clementinen',
    'trauben', 'weintrauben', 'melone', 'wassermelone', 'honigmelone',
    'ananas', 'mango', 'mangos', 'pfirsich', 'nektarine', 'grapefruit',
    'kiwi', 'feige', 'feigen', 'obst', 'beeren', 'aprikose', 'aprikosen',
    'mirabelle', 'granatapfel', 'passionsfrucht', 'litschi', 'papaya',
  ],
  'Spirituosen': [
    'cognac', 'whisky', 'prosecco', 'champagner', 'sherry', 'noilly',
    'rum', 'gin', 'vodka', 'brandy', 'wermut', 'likör', 'schnaps', 'bier',
  ],
  'Süsses & Backen': [
    'schokolade', 'kuvertüre', 'guetzli', 'kekse', 'puderzucker',
    'karamell', 'konfitüre', 'marmelade',
  ],
  'Haltbare Produkte': [
    'passierte tomaten', 'tomatenwürfel', 'tomaten (dose)', 'kokosmilch', 'gemüsebrühe',
    'bohnen (dose)', 'kichererbsen (dose)', 'mais (dose)', 'zuckermais', 'oliven', 'pesto',
    'tahini', 'weisswein', 'balsamico', 'olivenöl', 'rapsöl', 'salsa', 'guacamole',
    'sauerkraut', 'tomatenmark', 'hefeflocken', 'kokosöl',
    'sojasauce', 'kapern', 'ketchup', 'mayonnaise', 'hummus',
    'honig', 'ahornsirup', 'agavensirup', 'agavendicksaft',
    'öl', 'bouillon', 'brühe', 'fond', 'jus', 'rotwein', 'pelati', 'zucker', 'rohrzucker',
    'hefe', 'trockenhefe', 'remoulade', 'tamarinden', 'bratensauce',
    'kaffee',
  ],
};

export function categorizeIngredient(name: string): string {
  // Pattern-based rules applied before generic keyword matching.
  // 'Ei' / 'Ei (Grösse M)' = Ei als Zutat → Milchprodukte & Eier.
  // Trifft nicht auf 'Eigelb', 'Eier', 'Eis' etc., da diese per Keyword abgedeckt sind.
  if (/^Ei(\s|$|\()/.test(name.trim())) return 'Milchprodukte & Eier';
  // 'Vegi-Burger' / 'Veggie Burger' bleibt in Sonstiges, 'Burger' geht zu Fleisch.
  if (/vegi.?burger/i.test(name)) return 'Sonstiges';

  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return 'Sonstiges';
}

export function formatAmount(amount: number, unit: string): string {
  const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(1);
  return `${formatted} ${unit}`;
}

// ─── Einheiten & Mengen-Constraints ──────────────────────────────────────────

export const COMMON_UNITS = [
  'g', 'kg',
  'ml', 'dl', 'l',
  'Stk', 'Stk.',
  'EL', 'TL',
  'Prise',
  'Tasse',
  'Blatt', 'Bund', 'Dose', 'Handvoll', 'Kopf',
  'Leib', 'Msp', 'Pkg', 'Portion', 'Scheibe',
  'Stange', 'Würfel', 'Zehe', 'Zweig',
];

export interface AmountConstraints { min: number; max: number; step: number; }

export function getAmountConstraints(unit: string): AmountConstraints {
  switch (unit.toLowerCase().trim()) {
    case 'g':                                      return { min: 0, max: 999,  step: 1    };
    case 'kg':                                     return { min: 0, max: 100,  step: 0.1  };
    case 'ml':                                     return { min: 0, max: 999,  step: 1    };
    case 'dl':                                     return { min: 0, max: 99,   step: 0.25 };
    case 'l':                                      return { min: 0, max: 100,  step: 0.1  };
    case 'stk': case 'stk.': case 'stück':        return { min: 0, max: 1000, step: 0.25 };
    case 'prise': case 'prisen':                   return { min: 0, max: 10,   step: 1    };
    case 'el': case 'el.':                         return { min: 0, max: 20,   step: 0.25 };
    case 'tl': case 'tl.':                         return { min: 0, max: 20,   step: 0.25 };
    case 'tasse':                                  return { min: 0, max: 10,   step: 0.25 };
    default:                                       return { min: 0, max: 100,  step: 0.25 };
  }
}
