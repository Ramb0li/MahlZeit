'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Sparkles, Trash2, ToggleLeft, ToggleRight, UtensilsCrossed } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getTheme } from '@/lib/themes';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { Badge } from '@/components/ui/Badge';
import { RecipePickerModal } from './RecipePickerModal';
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
  onUpdate: (dayIndex: number, mealType: 'lunch' | 'dinner' | 'showLunch', slot: unknown) => void;
}

export function DayColumn({
  date, dayIndex, dayPlan, recipes, constraints, weather, settings, weekId, onUpdate,
}: DayColumnProps) {
  const [pickerOpen, setPickerOpen] = useState<'lunch' | 'dinner' | null>(null);
  const [suggesting, setSuggesting] = useState<'lunch' | 'dinner' | null>(null);

  const theme = getTheme(settings.theme);
  const dayColor = theme.dayCards[(dayIndex - 1) % 7];
  const showLunch = dayPlan?.showLunch ?? false;
  const isToday = formatDate(date) === formatDate(new Date());

  const dayShort   = format(date, 'EEE', { locale: de });
  const dayNum     = format(date, 'd');
  const monthShort = format(date, 'MMM', { locale: de });

  const getRecipe = (slot: MealSlot | null | undefined) => {
    if (!slot?.recipeId) return null;
    return recipes.find((r) => r.id === slot.recipeId) ?? null;
  };

  const dinnerRecipe = getRecipe(dayPlan?.dinner);
  const lunchRecipe  = getRecipe(dayPlan?.lunch ?? null);
  const leftoversConstraint = constraints.find((c) => c.constraint === 'leftovers');

  const handleSuggest = async (mealType: 'lunch' | 'dinner') => {
    setSuggesting(mealType);
    try {
      const res = await fetch('/api/weekplan/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, dayIndex, mealType }),
      });
      const data = await res.json();
      if (data.recipeId) onUpdate(dayIndex, mealType, { recipeId: data.recipeId });
    } finally {
      setSuggesting(null);
    }
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

          <div className="flex flex-col items-end gap-1.5 pt-0.5">
            {weather && (
              <div className="flex items-center gap-1">
                <WeatherIcon condition={weather.condition} size={14} />
                <span className="text-xs font-semibold" style={{ color: dayColor.textSecondary }}>
                  {weather.tempMax}°
                </span>
              </div>
            )}
            <button
              onClick={() => onUpdate(dayIndex, 'showLunch', !showLunch)}
              className="flex items-center gap-0.5 text-[10px] font-medium transition-opacity hover:opacity-60"
              style={{ color: dayColor.textSecondary }}
              title={showLunch ? 'Mittag ausblenden' : 'Mittag anzeigen'}
            >
              {showLunch
                ? <ToggleRight size={13} style={{ color: theme.todayAccent }} />
                : <ToggleLeft size={13} />}
              <span>Mittag</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2 min-h-[26px] content-start">
          {constraints.map((c) => (
            <Badge key={c.id} label={c.label} color={c.color} />
          ))}
        </div>
      </div>

      {/* Meal slots */}
      <div className="flex flex-col gap-2 p-2 pb-3 flex-1">
        {showLunch && (
          <MealSlotCard
            label="Mittag"
            recipe={lunchRecipe}
            mealType="lunch"
            suggesting={suggesting === 'lunch'}
            theme={theme}
            onPick={() => setPickerOpen('lunch')}
            onSuggest={() => handleSuggest('lunch')}
            onClear={() => onUpdate(dayIndex, 'lunch', { recipeId: null })}
          />
        )}

        {leftoversConstraint ? (
          <div
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl min-h-[80px]"
            style={{ backgroundColor: theme.mealEmptyBg, border: `1px dashed ${theme.mealEmptyBorder}` }}
          >
            <UtensilsCrossed size={18} style={{ color: dayColor.textSecondary, opacity: 0.5 }} />
            <span className="text-xs text-center" style={{ color: dayColor.textSecondary }}>Reste essen</span>
          </div>
        ) : (
          <MealSlotCard
            label="Abendessen"
            recipe={dinnerRecipe}
            mealType="dinner"
            suggesting={suggesting === 'dinner'}
            theme={theme}
            onPick={() => setPickerOpen('dinner')}
            onSuggest={() => handleSuggest('dinner')}
            onClear={() => onUpdate(dayIndex, 'dinner', { recipeId: null })}
          />
        )}
      </div>

      {pickerOpen && (
        <RecipePickerModal
          recipes={recipes}
          mealType={pickerOpen}
          onSelect={(recipeId) => {
            onUpdate(dayIndex, pickerOpen, { recipeId });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </div>
  );
}

interface MealSlotCardProps {
  label: string;
  recipe: Recipe | null;
  mealType: 'lunch' | 'dinner';
  suggesting: boolean;
  theme: AppTheme;
  onPick: () => void;
  onSuggest: () => void;
  onClear: () => void;
}

function MealSlotCard({ label, recipe, suggesting, theme, onPick, onSuggest, onClear }: MealSlotCardProps) {
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
        <button
          onClick={onClear}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-red-400 transition-all"
        >
          <Trash2 size={11} />
        </button>
      </div>
    );
  }

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
        <button
          onClick={onSuggest}
          disabled={suggesting}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ backgroundColor: theme.mealBtnBg, color: theme.mealBtnText }}
          title="KI-Vorschlag"
        >
          <Sparkles size={11} className={suggesting ? 'animate-pulse' : ''} />
        </button>
      </div>
    </div>
  );
}
