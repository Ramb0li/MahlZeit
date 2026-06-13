export type WeatherType = 'warm' | 'kalt' | 'neutral';
// DietType is kept for AppSettings.dietPreference (user household filter)
export type DietType = 'vegan' | 'vegetarisch' | 'pescetarisch' | 'fleischhaltig' | 'flexitarisch';

export type Category =
  | 'Snacks & Vorspeisen'
  | 'Suppen, Eintöpfe & Currys'
  | 'Salate & Bowls'
  | 'Pasta & Teigwaren'
  | 'Reis, Getreide & Hülsenfrüchte'
  | 'Kartoffelgerichte'
  | 'Eiergerichte'
  | 'Fleisch & Geflügel'
  | 'Fisch & Meeresfrüchte'
  | 'Gemüsegerichte'
  | 'Aufläufe & Gratins'
  | 'Wraps, Sandwiches & Burger'
  | 'Pizza, Flammkuchen, Wähen & Quiches'
  | 'Beilagen, Saucen & Dips'
  | 'Desserts & Süsses'
  | 'Brot & Gebäck'
  | 'Müesli, Porridge & Frühstücksschalen'
  | 'Getränke & Smoothies';

export const TAG_GROUPS = {
  Mahlzeit:    ['Frühstück', 'Brunch', 'Mittagessen', 'Abendessen', 'Snack', 'Dessert'],
  Planung:     ['Mealprep-geeignet', 'Kinderfreundlich', 'Einfrierbar', 'Resteverwertung', 'Budgetfreundlich', 'Für Gäste', 'Gut zum Mitnehmen'],
  Zubereitung: ['Pfannengericht', 'Ofengericht', 'Grillgericht', 'One-Pot-Gericht', 'Airfryer', 'Ohne Kochen'],
  Saison:      ['Frühling', 'Sommer', 'Herbst', 'Winter', 'Ganzjährig'],
  Küche:       ['Schweizerisch', 'Italienisch', 'Mediterran', 'Französisch', 'Griechisch', 'Mexikanisch', 'Amerikanisch', 'Indisch', 'Thai', 'Chinesisch', 'Japanisch', 'Türkisch', 'Nahöstlich'],
} as const;

export type Tag = typeof TAG_GROUPS[keyof typeof TAG_GROUPS][number];

export type SourceType = 'mahlzyt' | 'user_created' | 'imported' | 'ai_generated';

/** Schnell-Schwelle in Minuten — zentral konfigurierbar */
export const QUICK_THRESHOLD_MINUTES = 30;

export function computeTimeTags(minutes: number): string[] {
  return minutes <= QUICK_THRESHOLD_MINUTES ? ['Schnell'] : [];
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
  userId:    string;       // email als stabiler Identifier
  userEmail: string;
  userName?: string;       // Vorname Nachname — kann bei aelteren Ratings fehlen
  rating:    number;       // 1-5
  comment:   string;
  createdAt: string;       // ISO string
}

export type DietCategory = 'meat' | 'fish' | 'vegetarian' | 'vegan';

/** Die 14 offiziellen EU-Pflichtallergene */
export type EuAllergen =
  | 'gluten'
  | 'krebstiere'
  | 'ei'
  | 'fisch'
  | 'erdnuesse'
  | 'soja'
  | 'milch'
  | 'schalenfruechte'
  | 'sellerie'
  | 'senf'
  | 'sesam'
  | 'sulfite'
  | 'lupinen'
  | 'weichtiere';

/** Nährwerte pro Portion (KI-Schätzwerte) */
export interface Nutrition {
  kcal:    number;  // pro Portion, ganze Zahl
  protein: number;  // g, 1 Dezimalstelle
  fat:     number;  // g, 1 Dezimalstelle
  carbs:   number;  // g, 1 Dezimalstelle
  fiber:   number;  // g, 1 Dezimalstelle
}

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
  allergens?: EuAllergen[];   // Vorberechnete EU-Pflichtallergene aus Zutaten
  nutrition?: Nutrition;      // KI-geschätzte Nährwerte pro Portion
  sourceType?: SourceType;    // Herkunft des Rezepts
}

/** Einfache Beilage-Zutat (ohne Rezept), direkt im Tagesplan gespeichert. */
export interface SideIngredient {
  name: string;
  amount: number;
  unit: string;
}

export interface MealSlot {
  recipeId: string | null;
  customName?: string;
  portionOverride?: number;
  isLeftovers?: boolean;
  notes?: string;
  sideRecipeId?: string | null;    // Beilage / Dessert / zweites Gericht
  sideIsLeftovers?: boolean;
  sidePortionOverride?: number;   // Portionen-Override nur für Beilage (z.B. Gäste)
  sideIngredients?: SideIngredient[]; // Manuelle Beilage-Zutaten (z.B. Broccoli 1 Stk.)
}

export interface DayPlan {
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner: MealSlot;
  showLunch: boolean; // kept for backwards-compat; display is now driven by AppSettings.defaultView
  note?: string;      // Tagesnotiz / Hinweis
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
  enabledStores: StoreId[];   // Welche Läden sind aktiviert (Schweiz)
  // Altfelder für Rückwärtskompatibilität:
  manualMigros?: string[];
  manualCoop?:   string[];
  manualLidl?:   string[];
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

export type StoreId = 'migros' | 'coop' | 'denner' | 'aldi' | 'lidl' | 'volg';

export interface Promotion {
  store: StoreId;
  product: string;
  discount?: string;
  validUntil?: string;
}

export interface PromotionsCache {
  lastUpdated: string | null;
  migros:  Promotion[];
  coop:    Promotion[];
  denner:  Promotion[];
  aldi:    Promotion[];
  lidl:    Promotion[];
  volg:    Promotion[];
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
  approx?: boolean;   // true wenn Menge durch Einheiten-Konversion ermittelt wurde (z.B. EL → g)
}

export type ShoppingList = Record<string, ShoppingItem[]>;

/** Manuell hinzugefügte Zutat in der Einkaufsliste */
export interface CustomShoppingItem {
  id:       string;
  name:     string;
  amount:   string;
  unit:     string;
  category: string;
  checked:  boolean;
}

/** Server-seitiger State der Einkaufsliste (pro Gruppe + Woche, shared zwischen allen Haushaltsmitgliedern) */
export interface ShoppingListState {
  checked:     string[];                   // item-Keys "name_unit" die abgehakt sind
  userPantry:  string[];                   // item-Keys die User als "bereits vorhanden" markiert haben
  overrides:   Record<string, number>;     // item-Key → benutzerdefinierte Menge
  customItems: CustomShoppingItem[];       // manuell hinzugefügte Zutaten
  updatedAt:   string;                     // ISO-Timestamp, für Polling-Vergleich
}

export interface PantryItem {
  id: string;
  name: string;
  addedAt: string;
  wantToUse?: boolean;
}

export interface PortionInfo {
  adults: number;
  childPortions: number;
  totalPortions: number;
}
