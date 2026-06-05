export type WeatherType = 'warm' | 'kalt' | 'neutral';
// DietType is kept for AppSettings.dietPreference (user household filter)
export type DietType = 'vegan' | 'vegetarisch' | 'pescetarisch' | 'fleischhaltig' | 'flexitarisch';

export type Category =
  | 'Frühstück'
  | 'Snacks & Vorspeisen'
  | 'Suppen, Eintöpfe & Currys'
  | 'Salate & Bowls'
  | 'Pasta'
  | 'Reis & Getreide'
  | 'Kartoffelgerichte'
  | 'Fleisch & Geflügel'
  | 'Fisch & Meeresfrüchte'
  | 'Vegetarische Hauptgerichte'
  | 'Aufläufe & Gratins'
  | 'Wraps & Sandwiches'
  | 'Desserts & Süsses';

export const TAG_GROUPS = {
  Ernährung: ['Vegetarisch', 'Vegan'],
  Planung:   ['Mealprep-geeignet', 'Kinderfreundlich'],
  Saison:    ['Frühling', 'Sommer', 'Herbst', 'Winter'],
  Methode:   ['Grillgericht', 'Ofengericht', 'Mittagsgericht', 'Abendgericht'],
  Küche:     ['Schweizer', 'Italienisch', 'Asiatisch', 'Mexikanisch', 'Orientalisch'],
} as const;

export type Tag = typeof TAG_GROUPS[keyof typeof TAG_GROUPS][number];

export function computeTimeTags(minutes: number): string[] {
  const t: string[] = [];
  if (minutes < 20) t.push('Schnell (<20min)');
  if (minutes < 30) t.push('Einfach (<30min)');
  return t;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  perPortions: number;
}

/** Zutaten-Gruppe fuer strukturierte Mise-en-Place-Ansicht */
export interface IngredientGroup {
  name: string;
  ingredients: Ingredient[];
}

/** Nutzerbewertung fuer ein Rezept (global sichtbar) */
export interface RecipeRating {
  userId: string;       // email als stabiler Identifier
  userEmail: string;
  rating: number;       // 1-5
  comment: string;
  createdAt: string;    // ISO string
}

export type DietCategory = 'meat' | 'fish' | 'vegetarian' | 'vegan';

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  timeMinutes: number;
  tags: string[];
  ingredients: Ingredient[];
  weatherType: WeatherType;
  source: string;
  basePortions: number;
  description: string;
  steps?: string[];
  tips?: string;
  ingredientGroups?: IngredientGroup[];
  imageUrl?: string | null;
  imageZutaten?: string | null;
  imageKochen?: string | null;
  archived?: boolean;
  dietCategory?: DietCategory;
}

export interface MealSlot {
  recipeId: string | null;
  customName?: string;
  portionOverride?: number;
  isLeftovers?: boolean;
  notes?: string;
  sideRecipeId?: string | null;    // Beilage / Dessert / zweites Gericht
  sideIsLeftovers?: boolean;
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
  disabledConstraintIds?: string[];  // constraints crossed out for this specific week
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
  showBreakfast: boolean;   // Frühstück im Wochenplaner anzeigen
  showLunch: boolean;       // Mittagessen im Wochenplaner anzeigen
  showDinner: boolean;      // Abendessen im Wochenplaner anzeigen
  dietPreference?: DietType | 'alle';  // Globaler Diät-Filter für Picker & Vorschläge
  onboardingDone?: boolean;            // Onboarding-Fragebogen abgeschlossen
  theme?: import('@/lib/themes').ThemeId;
  promotions: PromotionSettings;
  weekSwitchDay?: number;   // 0=Sonntag (default), 1=Mo, ..., 6=Sa — ab diesem Tag nächste Woche anzeigen
  allergiesAndAversions?: string[];  // Allergene & Abneigungen — Rezepte mit diesen Zutaten ausblenden
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
  rawQuery?: string;  // Ursprüngliche User-Eingabe für Location-Change-Detection
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

/** Gruppiert Tage (1=Mo … 7=So) einer Woche auf Einkaufslisten */
export interface ShoppingGroup {
  id: string;          // z.B. "sg-1"
  label?: string;      // optionaler Name
  dayIndices: number[]; // 1–7 (Mo–So)
}

export type ShoppingGroups = ShoppingGroup[];

export interface ShoppingItem {
  name: string;
  totalAmount: number;
  unit: string;
  category: string;
  recipeNames: string[];
  promotions: Promotion[];
  checked: boolean;
  inPantry?: boolean;
}

export type ShoppingList = Record<string, ShoppingItem[]>;

export interface PantryItem {
  id: string;
  name: string;
  addedAt: string;
}

export interface PortionInfo {
  adults: number;
  childPortions: number;
  totalPortions: number;
}
