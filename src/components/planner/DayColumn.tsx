'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getTheme } from '@/lib/themes';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { Badge } from '@/components/ui/Badge';
import { RecipePickerModal, LEFTOVERS_ID } from './RecipePickerModal';
import type { DayPlan, Recipe, WeatherDay, DayConstraint, MealSlot, AppSettings } from '@/types';
import type { AppTheme } from '@/lib/themes';

interface DayColumnProps {
  date: Date;
  dayIndex: number;
  dayPlan: DayPlan | null;
  recipes: Recipe[];
  constraints: DayConstraint[];
  weather: WeatherDay | null;
  settings: AppSettings;
  weekId: string;
  onUpdate: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner' | 'showLunch', slot: unknown) => void;
}

export function DayColumn({
  date, dayIndex, dayPlan, recipes, constraints, weather, settings, weekId, onUpdate,
}: DayColumnProps) {
  const [pickerOpen, setPickerOpen]         = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [pickerOpenSide, setPickerOpenSide] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [suggesting, setSuggesting]         = useState<'lunch' | 'dinner' | null>(null);

  const theme = getTheme(settings.theme);
  const dayColor = theme.dayCards[(dayIndex - 1) % 7];
  const isToday = formatDate(date) === formatDate(new Date());

  // Mahlzeiten-Sichtbarkeit aus globalem Setting
  const showBreakfast = settings.showBreakfast ?? false;
  const showLunch     = settings.showLunch     ?? false;
  const showDinner    = settings.showDinner    ?? true;

  const dayShort   = format(date, 'EEE', { locale: de });
  const dayNum     = format(date, 'd');
  const monthShort = format(date, 'MMM', { locale: de });

  const getRecipe = (slot: MealSlot | null | undefined) => {
    if (!slot?.recipeId) return null;
    return recipes.find((r) => r.id === slot.recipeId) ?? null;
  };

  const getSideRecipe = (slot: MealSlot | null | undefined) => {
    if (!slot?.sideRecipeId) return null;
    return recipes.find((r) => r.id === slot.sideRecipeId) ?? null;
  };

  const dinnerSlot    = dayPlan?.dinner    ?? null;
  const lunchSlot     = dayPlan?.lunch     ?? null;
  const breakfastSlot = dayPlan?.breakfast ?? null;

  const dinnerRecipe    = getRecipe(dinnerSlot);
  const lunchRecipe     = getRecipe(lunchSlot);
  const breakfastRecipe = getRecipe(breakfastSlot);

  const dinnerSideRecipe    = getSideRecipe(dinnerSlot);
  const lunchSideRecipe     = getSideRecipe(lunchSlot);
  const breakfastSideRecipe = getSideRecipe(breakfastSlot);

  const handleSuggest = async (mealType: 'lunch' | 'dinner') => {
    setSuggesting(mealType);
    try {
      const res = await fetch('/api/weekplan/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, dayIndex, mealType }),
      });
      const data = await res.json();
      if (data.recipeId) onUpdate(dayIndex, mealType, { recipeId: data.recipeId, isLeftovers: false });
    } finally {
      setSuggesting(null);
    }
  };

  // Haupt-Gericht auswählen
  const handlePickerSelect = (mealType: 'breakfast' | 'lunch' | 'dinner', recipeId: string) => {
    if (recipeId === LEFTOVERS_ID) {
      onUpdate(dayIndex, mealType, { recipeId: null, isLeftovers: true });
    } else {
      onUpdate(dayIndex, mealType, { recipeId, isLeftovers: false });
    }
    setPickerOpen(null);
  };

  // Beilage / zweites Gericht auswählen
  const handlePickerSelectSide = (mealType: 'breakfast' | 'lunch' | 'dinner', recipeId: string) => {
    const current =
      mealType === 'breakfast' ? (dayPlan?.breakfast ?? { recipeId: null }) :
      mealType === 'lunch'     ? (dayPlan?.lunch     ?? { recipeId: null }) :
      (dayPlan?.dinner ?? { recipeId: null });

    const update = recipeId === LEFTOVERS_ID
      ? { ...current, sideRecipeId: null,     sideIsLeftovers: true  }
      : { ...current, sideRecipeId: recipeId, sideIsLeftovers: false };

    onUpdate(dayIndex, mealType, update);
    setPickerOpenSide(null);
  };

  // Beilage entfernen
  const handleClearSide = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
    const current =
      mealType === 'breakfast' ? (dayPlan?.breakfast ?? { recipeId: null }) :
      mealType === 'lunch'     ? (dayPlan?.lunch     ?? { recipeId: null }) :
      (dayPlan?.dinner ?? { recipeId: null });
    onUpdate(dayIndex, mealType, { ...current, sideRecipeId: null, sideIsLeftovers: false });
  };

  return (
    <div
      className="flex flex-col w-full md:flex-1 md:min-w-36 rounded-2xl overflow-hidden transition-all"
      style={{
        backgroundColor: dayColor.bg,
        boxShadow: isToday
          ? `0 0 0 2px ${theme.todayRing}, 0 4px 12px rgba(0,0,0,0.12)`
          : '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      {isToday && (
        <div className="h-1 w-full" style={{ backgroundColor: theme.todayAccent }} />
      )}

      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: dayColor.textSecondary }}>
              {dayShort}
            </p>
            <p className="text-3xl font-black leading-none mt-0.5" style={{ color: dayColor.textPrimary }}>
              {dayNum}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: dayColor.textSecondary }}>
              {monthShort}
            </p>
          </div>

          {weather && (
            <div className="flex items-center gap-1 pt-0.5">
              <WeatherIcon condition={weather.condition} size={14} />
              <span className="text-xs font-semibold" style={{ color: dayColor.textSecondary }}>
                {weather.tempMax}°
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-2 min-h-[26px] content-start">
          {constraints.map((c) => (
            <Badge key={c.id} label={c.label} color={c.color} />
          ))}
        </div>
      </div>

      {/* Meal slots */}
      <div className="flex flex-col gap-2 p-2 pb-3 flex-1">
        {showBreakfast && (
          <MealSlotCard
            label="Frühstück"
            recipe={breakfastRecipe}
            isLeftovers={breakfastSlot?.isLeftovers}
            sideRecipe={breakfastSideRecipe}
            sideIsLeftovers={breakfastSlot?.sideIsLeftovers}
            mealType="breakfast"
            suggesting={false}
            theme={theme}
            dayColor={dayColor}
            onPick={() => setPickerOpen('breakfast')}
            onSuggest={() => {}}
            onClear={() => onUpdate(dayIndex, 'breakfast', { recipeId: null, isLeftovers: false })}
            onPickSide={() => setPickerOpenSide('breakfast')}
            onClearSide={() => handleClearSide('breakfast')}
          />
        )}

        {showLunch && (
          <MealSlotCard
            label="Mittag"
            recipe={lunchRecipe}
            isLeftovers={lunchSlot?.isLeftovers}
            sideRecipe={lunchSideRecipe}
            sideIsLeftovers={lunchSlot?.sideIsLeftovers}
            mealType="lunch"
            suggesting={suggesting === 'lunch'}
            theme={theme}
            dayColor={dayColor}
            onPick={() => setPickerOpen('lunch')}
            onSuggest={() => handleSuggest('lunch')}
            onClear={() => onUpdate(dayIndex, 'lunch', { recipeId: null, isLeftovers: false })}
            onPickSide={() => setPickerOpenSide('lunch')}
            onClearSide={() => handleClearSide('lunch')}
          />
        )}

        {showDinner && (
          <MealSlotCard
            label="Abendessen"
            recipe={dinnerRecipe}
            isLeftovers={dinnerSlot?.isLeftovers}
            sideRecipe={dinnerSideRecipe}
            sideIsLeftovers={dinnerSlot?.sideIsLeftovers}
            mealType="dinner"
            suggesting={suggesting === 'dinner'}
            theme={theme}
            dayColor={dayColor}
            onPick={() => setPickerOpen('dinner')}
            onSuggest={() => handleSuggest('dinner')}
            onClear={() => onUpdate(dayIndex, 'dinner', { recipeId: null, isLeftovers: false })}
            onPickSide={() => setPickerOpenSide('dinner')}
            onClearSide={() => handleClearSide('dinner')}
          />
        )}
      </div>

      {/* Picker für Haupt-Gericht */}
      {pickerOpen && (
        <RecipePickerModal
          recipes={recipes}
          mealType={pickerOpen}
          dietPreference={settings.dietPreference}
          onSelect={(recipeId) => handlePickerSelect(pickerOpen, recipeId)}
          onClose={() => setPickerOpen(null)}
        />
      )}

      {/* Picker für Beilage / zweites Gericht */}
      {pickerOpenSide && (
        <RecipePickerModal
          recipes={recipes}
          mealType={pickerOpenSide}
          dietPreference={settings.dietPreference}
          onSelect={(recipeId) => handlePickerSelectSide(pickerOpenSide, recipeId)}
          onClose={() => setPickerOpenSide(null)}
        />
      )}
    </div>
  );
}

// ─── MealSlotCard ────────────────────────────────────────────────────────────

interface MealSlotCardProps {
  label: string;
  recipe: Recipe | null;
  isLeftovers?: boolean;
  sideRecipe?: Recipe | null;
  sideIsLeftovers?: boolean;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  suggesting: boolean;
  theme: AppTheme;
  dayColor: AppTheme['dayCards'][number];
  onPick: () => void;
  onSuggest: () => void;
  onClear: () => void;
  onPickSide: () => void;
  onClearSide: () => void;
}

function MealSlotCard({
  label, recipe, isLeftovers, sideRecipe, sideIsLeftovers,
  suggesting, theme, dayColor, onPick, onSuggest, onClear,
  onPickSide, onClearSide, mealType,
}: MealSlotCardProps) {
  const hasSide = !!(sideRecipe || sideIsLeftovers);
  const sideName = sideIsLeftovers ? 'Reste essen' : sideRecipe?.name ?? '';

  // ── Reste essen ──────────────────────────────────────────────────────────
  if (isLeftovers && !recipe) {
    return (
      <div
        className="group relative rounded-xl p-2.5 min-h-[80px]"
        style={{ backgroundColor: '#FEF3C7', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide mb-1 text-amber-600">
          {label}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <UtensilsCrossed size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Reste essen</p>
        </div>

        {/* Beilage */}
        {hasSide ? (
          <div className="mt-2 pt-1.5 border-t border-amber-200 flex items-center gap-1">
            <p className="text-[10px] text-amber-600 line-clamp-1 flex-1">+ {sideName}</p>
            <button onClick={onClearSide} className="shrink-0 p-0.5 rounded hover:bg-red-50 text-amber-300 hover:text-red-400 transition-colors">
              <X size={9} />
            </button>
          </div>
        ) : (
          <button
            onClick={onPickSide}
            className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-amber-200/60 hover:bg-amber-400 hover:text-white text-amber-500 transition-all"
            title="Beilage / Dessert hinzufügen"
          >
            <Plus size={9} />
          </button>
        )}

        <button
          onClick={onClear}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-red-400 transition-all"
        >
          <Trash2 size={11} />
        </button>
      </div>
    );
  }

  // ── Rezept ausgewählt ─────────────────────────────────────────────────────
  if (recipe) {
    return (
      <div
        className="group relative rounded-xl p-2.5 min-h-[80px]"
        style={{ backgroundColor: theme.mealFilledBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: theme.mealLabelText }}>
          {label}
        </p>
        <p className="text-xs font-semibold leading-snug line-clamp-3" style={{ color: theme.mealFilledText }}>
          {recipe.name}
        </p>
        <div className="flex items-center gap-1 mt-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            recipe.timeLabel === 'schnell' ? 'bg-green-100 text-green-700' :
            recipe.timeLabel === 'mittel'  ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {recipe.timeMinutes} min
          </span>
        </div>

        {/* Beilage */}
        {hasSide ? (
          <div className="mt-2 pt-1.5 border-t border-black/5 flex items-center gap-1">
            <p className="text-[10px] line-clamp-1 flex-1" style={{ color: theme.mealLabelText, opacity: 0.8 }}>
              + {sideName}
            </p>
            <button onClick={onClearSide} className="shrink-0 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
              <X size={9} />
            </button>
          </div>
        ) : (
          <button
            onClick={onPickSide}
            className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-black/5 hover:bg-brand-green hover:text-white text-gray-400 transition-all"
            title="Beilage / Dessert hinzufügen"
          >
            <Plus size={9} />
          </button>
        )}

        <button
          onClick={onClear}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-red-400 transition-all"
        >
          <Trash2 size={11} />
        </button>
      </div>
    );
  }

  // ── Leer — Auswahl anbieten ───────────────────────────────────────────────
  return (
    <div
      className="rounded-xl min-h-[80px] flex flex-col"
      style={{ backgroundColor: theme.mealEmptyBg, border: `1px dashed ${theme.mealEmptyBorder}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide px-2.5 pt-2.5" style={{ color: theme.mealLabelText }}>
        {label}
      </p>
      <div className="flex-1 flex items-center justify-center gap-1.5 pb-2">
        <button
          onClick={onPick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{ backgroundColor: theme.mealBtnBg, color: theme.mealBtnText }}
        >
          <Plus size={11} />
          Wählen
        </button>
        {mealType !== 'breakfast' && (
          <button
            onClick={onSuggest}
            disabled={suggesting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: theme.mealBtnBg, color: theme.mealBtnText }}
            title="KI-Vorschlag"
          >
            <Sparkles size={11} className={suggesting ? 'animate-pulse' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
