export type WeatherType = 'warm' | 'kalt' | 'neutral';
export type Season = 'Frühling' | 'Sommer' | 'Herbst' | 'Winter' | 'ganzjährig';
export type TimeLabel = 'schnell' | 'mittel' | 'aufwändig';
export type DietType = 'vegan' | 'vegetarisch' | 'pescetarisch' | 'omnivor';
export type Category =
  | 'Eier'
  | 'Reis'
  | 'Pasta'
  | 'Eintopf/Gratin'
  | 'Fisch'
  | 'Sonstige'
  | 'Asiatisch'
  | 'Ofen'
  | 'Suppen'
  | 'Salat/Bowl';

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  perPortions: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  timeMinutes: number;
  timeLabel: TimeLabel;
  ingredients: Ingredient[];
  season: Season[];
  weatherType: WeatherType;
  isMealprep: boolean;
  isSuitableForLunch: boolean;
  source: string;
  basePortions: number;
  description: string;
  // Für spätere Detailansicht
  steps?: string[];        // Nummerierte Zubereitungsschritte
  tips?: string;           // Tipps & Varianten
  imageUrl?: string | null; // Rezeptbild-URL (lokal oder extern)
  archived?: boolean;       // Archiviert – nicht vorschlagen, nicht im Picker zeigen
  dietType?: DietType;      // Ernährungsweise
}

export interface MealSlot {
  recipeId: string | null;
  customName?: string;
  portionOverride?: number;
  isLeftovers?: boolean;
  notes?: string;
}

export interface DayPlan {
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner: MealSlot;
  showLunch: boolean; // kept for backwards-compat; display is now driven by AppSettings.defaultView
}

export interface WeekPlan {
  weekId: string;
  startDate: string;
  days: {
    [dayIndex: number]: DayPlan;
  };
}

export interface Child {
  id: string;
  age: number;
}

export interface HouseholdSettings {
  adults: number;
  children: Child[];
}

export interface WeatherSettings {
  location: string;
}

export interface PromotionSettings {
  manualMigros: string[];
  manualCoop: string[];
  manualLidl: string[];
}

export interface AppSettings {
  household: HouseholdSettings;
  weather: WeatherSettings;
  defaultView: 'dinnerOnly' | 'lunchAndDinner' | 'breakfastLunchDinner';
  dietPreference?: DietType | 'alle';  // Globaler Diät-Filter für Picker & Vorschläge
  theme?: import('@/lib/themes').ThemeId;
  promotions: PromotionSettings;
}

export interface WeatherDay {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy';
  conditionLabel: string;
  weatherType: WeatherType;
}

export interface WeatherCache {
  lastUpdated: string | null;
  location: string;
  days: WeatherDay[];
}

export interface Promotion {
  store: 'migros' | 'coop' | 'lidl';
  product: string;
  discount?: string;
  validUntil?: string;
}

export interface PromotionsCache {
  lastUpdated: string | null;
  migros: Promotion[];
  coop: Promotion[];
  lidl: Promotion[];
}

export interface DayConstraint {
  id: string;
  dayOfWeek: number;
  label: string;
  color: string;
  mealType: 'lunch' | 'dinner';
  constraint: 'maxTime' | 'mealprep' | 'leftovers' | 'custom';
  maxTimeMinutes?: number;
  mealprepLunchDays?: number[];
  notes?: string;
}

export interface ShoppingItem {
  name: string;
  totalAmount: number;
  unit: string;
  category: string;
  recipeNames: string[];
  promotions: Promotion[];
  checked: boolean;
}

export type ShoppingList = Record<string, ShoppingItem[]>;

export interface PortionInfo {
  adults: number;
  childPortions: number;
  totalPortions: number;
}
