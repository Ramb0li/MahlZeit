import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
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

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
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
 * Returns the week to display based on today and the configured switch day.
 * switchDay: 0=Sunday, 1=Monday, ..., 6=Saturday (day on which we jump to next week)
 * Default: 0 (Sunday) — show next week from Sunday onwards
 */
export function getInitialDisplayWeek(switchDay = 0): Date {
  const today = new Date();
  // Normalize: Mon=1 … Sat=6, Sun=7
  const d = today.getDay() === 0 ? 7 : today.getDay();
  const sw = switchDay === 0 ? 7 : switchDay;
  return d >= sw ? nextWeek(today) : today;
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
  'Obst & Gemüse': [
    // Gemüse
    'spinat', 'blumenkohl', 'broccoli', 'lauch', 'kohlrabi', 'zucchini', 'karotten', 'karotte',
    'sellerie', 'paprika', 'tomaten', 'tomate', 'gurke', 'salat', 'rucola', 'erbsen',
    'mais', 'kürbis', 'süsskartoffel', 'kartoffel', 'avocado', 'pilz', 'champignon',
    'frühlingszwiebeln', 'zwiebel', 'knoblauch', 'ingwer', 'gemischtes gemüse',
    'gemüse', 'kirschtomaten', 'brokkoli', 'fenchel', 'pastinake', 'hokkaido',
    'baby-spinat', 'süsskartoffel', 'rotkohl', 'rotkabis', 'rosenkohl', 'mangold',
    'randen', 'rüebli', 'peperoni', 'artischocke', 'spargel', 'zuckerschote',
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
  'Hülsenfrüchte': [
    'linsen', 'kichererbsen', 'bohnen', 'erbsen (trocken)', 'gelbe erbsen',
    'schwarze bohnen', 'weisse bohnen',
  ],
  'Getreide & Stärke': [
    'pasta', 'spaghetti', 'hörnli', 'lasagne', 'spätzli', 'reis', 'risottoreis', 'basmatireis',
    'quinoa', 'bulgur', 'polenta', 'ebly', 'urdinkelkerne', 'rollgerste', 'reisnudeln',
    'weizentortillas', 'taco-shells', 'pitabrot', 'vollkornnudeln', 'vollkornreis',
    'hartweizennudeln', 'hartweizengrieß', 'dinkelvollkornmehl', 'dinkelmehl', 'weizenmehl',
    'kichererbsenmehl', 'semmelbrösel', 'haferflocken', 'grieß', 'tortillas',
  ],
  'Milchprodukte & Eier': [
    'eier', 'butter', 'rahm', 'milch', 'käse', 'parmesan', 'gruyère', 'feta', 'mozzarella',
    'ricotta', 'sauerrahm', 'ghee', 'tzatziki', 'sojajoghurt', 'sojaquark', 'sojadrink',
  ],
  'Haltbare Produkte': [
    'passierte tomaten', 'tomatenwürfel', 'tomaten (dose)', 'kokosmilch', 'gemüsebrühe',
    'bohnen (dose)', 'kichererbsen (dose)', 'mais (dose)', 'zuckermais', 'oliven', 'pesto',
    'tahini', 'weisswein', 'balsamico', 'olivenöl', 'rapsöl', 'salsa', 'guacamole',
    'sauerkraut', 'tomatenmark', 'hefeflocken', 'kokosöl',
  ],
  'Tofu & Veganes': [
    'tofu', 'räuchertofu', 'falafel', 'naturtofu',
  ],
  'Gewürze & Kräuter': [
    'salz', 'pfeffer', 'muskatnuss', 'kreuzkümmel', 'kurkuma', 'currypulver', 'currypaste',
    'chiliflocken', 'majoran', 'oregano', 'salbei', 'koriander', 'petersilie', 'peterli',
    'basilikum', 'minze', 'kräuter', 'fajita-gewürz', 'gewürzmischung', 'pad thai sauce',
    'dijonsenf', 'senf', 'zitronensaft', 'limettensaft', 'limette', 'zitrone',
    'thymian', 'paprikapulver', 'garam masala', 'zimt', 'backpulver', 'dill',
  ],
  'Nüsse & Samen': [
    'walnüsse', 'baumnüsse', 'pinienkerne', 'erdnüsse', 'cashew', 'mandeln', 'mandelmus',
    'sesammus', 'cashewmus', 'chiasamen',
  ],
  'Fisch & Meeresfrüchte': [
    'fisch', 'lachs', 'fischfilets',
  ],
};

export function categorizeIngredient(name: string): string {
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
