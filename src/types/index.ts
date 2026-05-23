export type WeatherType = 'warm' | 'kalt' | 'neutral';
export type Season = 'Frühling' | 'Sommer' | 'Herbst' | 'Winter' | 'ganzjährig';
export type TimeLabel = 'schnell' | 'mittel' | 'aufwändig';
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
  imageUrl?: string;
}

export interface MealSlot {
  recipeId: string | null;
  customName?: string;
  portionOverride?: number;
  isLeftovers?: boolean;
  notes?: string;
}

export interface DayPlan {
  lunch?: MealSlot;
  dinner: MealSlot;
  showLunch: boolean;
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
  defaultView: 'dinnerOnly' | 'lunchAndDinner';
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
