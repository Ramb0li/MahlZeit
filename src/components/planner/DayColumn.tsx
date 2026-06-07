'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { formatDate, calculatePortions } from '@/lib/utils';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { Badge } from '@/components/ui/Badge';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { RecipePickerModal, LEFTOVERS_ID } from './RecipePickerModal';
import { type DayPlan, type Recipe, type WeatherDay, type DayConstraint, type MealSlot, type AppSettings, computeTimeTags } from '@/types';

interface DayColumnProps {
  date: Date;
  dayIndex: number;
  dayPlan: DayPlan | null;
  recipes: Recipe[];
  constraints: DayConstraint[];
  disabledConstraintIds: string[];
  weather: WeatherDay | null;
  settings: AppSettings;
  weekId: string;
  onUpdate: (dayIndex: number, mealType: 'breakfast' | 'lunch' | 'dinner' | 'showLunch', slot: unknown) => void;
  onToggleConstraint: (constraintId: string) => void;
  onViewRecipe?: (recipe: Recipe) => void;
}

export function DayColumn({
  date, dayIndex, dayPlan, recipes, constraints, disabledConstraintIds,
  weather, settings, weekId, onUpdate, onToggleConstraint, onViewRecipe,
}: DayColumnProps) {
  const [pickerOpen, setPickerOpen]         = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [pickerOpenSide, setPickerOpenSide] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [suggesting, setSuggesting]         = useState<'lunch' | 'dinner' | null>(null);

  const isToday = formatDate(date) === formatDate(new Date());

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

  const defaultPortions = Math.max(1, Math.round(calculatePortions(settings.household).totalPortions));

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

  const handlePickerSelect = (mealType: 'breakfast' | 'lunch' | 'dinner', recipeId: string) => {
    if (recipeId === LEFTOVERS_ID) {
      onUpdate(dayIndex, mealType, { recipeId: null, isLeftovers: true });
    } else {
      onUpdate(dayIndex, mealType, { recipeId, isLeftovers: false });
    }
    setPickerOpen(null);
  };

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

  const handleClearSide = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
    const current =
      mealType === 'breakfast' ? (dayPlan?.breakfast ?? { recipeId: null }) :
      mealType === 'lunch'     ? (dayPlan?.lunch     ?? { recipeId: null }) :
      (dayPlan?.dinner ?? { recipeId: null });
    onUpdate(dayIndex, mealType, { ...current, sideRecipeId: null, sideIsLeftovers: false, sidePortionOverride: undefined });
  };

  const handleSidePortionChange = (mealType: 'breakfast' | 'lunch' | 'dinner', portions: number) => {
    const current =
      mealType === 'breakfast' ? (dayPlan?.breakfast ?? { recipeId: null }) :
      mealType === 'lunch'     ? (dayPlan?.lunch     ?? { recipeId: null }) :
      (dayPlan?.dinner ?? { recipeId: null });
    onUpdate(dayIndex, mealType, { ...current, sidePortionOverride: portions });
  };

  return (
    <div className={`mz-magday${isToday ? ' today' : ''}`}>
      {/* Day header */}
      <div className="mz-magday-head">
        <div>
          <div className="mz-magday-dow">
            {dayShort}
            {isToday && <span className="mz-magday-todaydot" />}
          </div>
          <div className="mz-magday-date">{dayNum}. {monthShort}</div>
        </div>
        {weather && (
          <div className="mz-magday-weather">
            <WeatherIcon condition={weather.condition} size={14} />
            <span>{weather.tempMax}°</span>
          </div>
        )}
      </div>

      {/* Constraints — immer rendern (auch leer), min-height hält alle Slots auf gleicher Linie */}
      <div className="mz-magday-constraints">
        {constraints.map((c) => {
          const disabled = disabledConstraintIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggleConstraint(c.id)}
              title={disabled ? 'Wiederherstellen' : 'Für diese Woche deaktivieren'}
              style={{ opacity: disabled ? 0.4 : 1, textDecoration: disabled ? 'line-through' : 'none' }}
            >
              <Badge label={c.label} color={c.color} />
            </button>
          );
        })}
      </div>

      {/* Meal slots */}
      <div className="mz-magday-slots">
        {showBreakfast && (
          <MealSlotCard
            label="Frühstück"
            recipe={breakfastRecipe}
            isLeftovers={breakfastSlot?.isLeftovers}
            sideRecipe={breakfastSideRecipe}
            sideIsLeftovers={breakfastSlot?.sideIsLeftovers}
            mealType="breakfast"
            suggesting={false}
            defaultPortions={defaultPortions}
            sidePortionOverride={breakfastSlot?.sidePortionOverride}
            onPick={() => setPickerOpen('breakfast')}
            onSuggest={() => {}}
            onClear={() => onUpdate(dayIndex, 'breakfast', { recipeId: null, isLeftovers: false })}
            onPickSide={() => setPickerOpenSide('breakfast')}
            onClearSide={() => handleClearSide('breakfast')}
            onSidePortionChange={(p) => handleSidePortionChange('breakfast', p)}
            onViewRecipe={onViewRecipe}
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
            defaultPortions={defaultPortions}
            sidePortionOverride={lunchSlot?.sidePortionOverride}
            onPick={() => setPickerOpen('lunch')}
            onSuggest={() => handleSuggest('lunch')}
            onClear={() => onUpdate(dayIndex, 'lunch', { recipeId: null, isLeftovers: false })}
            onPickSide={() => setPickerOpenSide('lunch')}
            onClearSide={() => handleClearSide('lunch')}
            onSidePortionChange={(p) => handleSidePortionChange('lunch', p)}
            onViewRecipe={onViewRecipe}
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
            defaultPortions={defaultPortions}
            sidePortionOverride={dinnerSlot?.sidePortionOverride}
            onPick={() => setPickerOpen('dinner')}
            onSuggest={() => handleSuggest('dinner')}
            onClear={() => onUpdate(dayIndex, 'dinner', { recipeId: null, isLeftovers: false })}
            onPickSide={() => setPickerOpenSide('dinner')}
            onClearSide={() => handleClearSide('dinner')}
            onSidePortionChange={(p) => handleSidePortionChange('dinner', p)}
            onViewRecipe={onViewRecipe}
          />
        )}
      </div>

      {pickerOpen && (
        <RecipePickerModal
          recipes={recipes}
          mealType={pickerOpen}
          dietPreference={settings.dietPreference}
          onSelect={(recipeId) => handlePickerSelect(pickerOpen, recipeId)}
          onClose={() => setPickerOpen(null)}
        />
      )}

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
  defaultPortions: number;
  sidePortionOverride?: number;
  onPick: () => void;
  onSuggest: () => void;
  onClear: () => void;
  onPickSide: () => void;
  onClearSide: () => void;
  onSidePortionChange: (portions: number) => void;
  onViewRecipe?: (recipe: Recipe) => void;
}

function MealSlotCard({
  label, recipe, isLeftovers, sideRecipe, sideIsLeftovers,
  suggesting, defaultPortions, sidePortionOverride,
  onPick, onSuggest, onClear, onPickSide, onClearSide, onSidePortionChange, mealType, onViewRecipe,
}: MealSlotCardProps) {
  const hasSide = !!(sideRecipe || sideIsLeftovers);
  const sideName = sideIsLeftovers ? 'Reste essen' : sideRecipe?.name ?? '';

  // ── Reste essen ──────────────────────────────────────────────────────────
  if (isLeftovers && !recipe) {
    return (
      <div className="mz-magslot leftovers group">
        <span className="mz-slot-label">{label}</span>
        <div className="mz-leftovers-body">
          <UtensilsCrossed size={14} />
          <span>Reste essen</span>
        </div>
        {hasSide && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4, borderTop: '1px solid var(--accent-tint)' }}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--accent-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              + {sideName}
            </span>
            <button onClick={onClearSide} style={{ color: 'var(--muted)', padding: 2 }}><X size={10} /></button>
          </div>
        )}
        <button onClick={onClear} className="mz-slot-del" style={{ opacity: 1 }}><Trash2 size={12} /></button>
      </div>
    );
  }

  // ── Rezept ausgewählt ─────────────────────────────────────────────────────
  if (recipe) {
    return (
      <div className="mz-magslot filled group">
        <div className="mz-magslot-img">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.imageUrl} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <PhotoSlot category={recipe.category} />
          )}
        </div>
        <div className="mz-magslot-grad" />
        <span className="mz-slot-label on-img">{label}</span>
        <div className="mz-magslot-info">
          <p
            className="mz-magslot-name mz-clamp2"
            onClick={() => onViewRecipe?.(recipe)}
            style={{ cursor: onViewRecipe ? 'pointer' : 'default' }}
          >
            {recipe.name}
          </p>
          <div className="mz-magslot-meta">
            <span>{recipe.timeMinutes} min</span>
          </div>
        </div>

        {hasSide && (
          <div style={{ position: 'absolute', bottom: 36, left: 11, right: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.82)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              + {sideName}
            </span>
            {/* Portionen-Override für Beilage */}
            <button
              onClick={(e) => { e.stopPropagation(); onSidePortionChange(Math.max(1, (sidePortionOverride ?? defaultPortions) - 1)); }}
              style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.65)', flexShrink: 0, padding: '0 2px', lineHeight: 1 }}
            >−</button>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.9)', flexShrink: 0, minWidth: 18, textAlign: 'center' }}>
              {sidePortionOverride ?? defaultPortions}P
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onSidePortionChange(Math.min(20, (sidePortionOverride ?? defaultPortions) + 1)); }}
              style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.65)', flexShrink: 0, padding: '0 2px', lineHeight: 1 }}
            >+</button>
            <button onClick={(e) => { e.stopPropagation(); onClearSide(); }} style={{ color: 'rgba(255,255,255,.6)', flexShrink: 0 }}><X size={9} /></button>
          </div>
        )}
        {!hasSide && (
          <button
            onClick={(e) => { e.stopPropagation(); onPickSide(); }}
            className="mz-slot-del on-img"
            style={{ bottom: 8, top: 'auto', right: 36, opacity: 0.65, width: 20, height: 20, borderRadius: '50%' }}
            title="Beilage / zweites Gericht hinzufügen"
          >
            <Plus size={10} />
          </button>
        )}
        <button onClick={onClear} className="mz-slot-del on-img"><Trash2 size={12} /></button>
      </div>
    );
  }

  // ── Leer ─────────────────────────────────────────────────────────────────
  return (
    <div className="mz-magslot empty">
      <span className="mz-slot-label">{label}</span>
      <div className="mz-empty-actions">
        <button onClick={onPick} className="mz-empty-pick">
          <Plus size={12} />
          Wählen
        </button>
        {mealType !== 'breakfast' && (
          <button
            onClick={onSuggest}
            disabled={suggesting}
            className="mz-empty-ai"
            title="KI-Vorschlag"
            style={{ opacity: suggesting ? 0.5 : 1 }}
          >
            <Sparkles size={14} className={suggesting ? 'mz-pulse' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
