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
  onOpenMeal?: (ctx: { recipe: Recipe; weekId: string; dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner'; slot: MealSlot }) => void;
}

export function DayColumn({
  date, dayIndex, dayPlan, recipes, constraints, disabledConstraintIds,
  weather, settings, weekId, onUpdate, onToggleConstraint, onViewRecipe, onOpenMeal,
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
            onOpenMeal={breakfastRecipe && breakfastSlot ? () => onOpenMeal?.({ recipe: breakfastRecipe, weekId, dayIndex, mealType: 'breakfast', slot: breakfastSlot }) : undefined}
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
            onOpenMeal={lunchRecipe && lunchSlot ? () => onOpenMeal?.({ recipe: lunchRecipe, weekId, dayIndex, mealType: 'lunch', slot: lunchSlot }) : undefined}
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
            onOpenMeal={dinnerRecipe && dinnerSlot ? () => onOpenMeal?.({ recipe: dinnerRecipe, weekId, dayIndex, mealType: 'dinner', slot: dinnerSlot }) : undefined}
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
  onOpenMeal?: () => void;
}

function MealSlotCard({
  label, recipe, isLeftovers, sideRecipe, sideIsLeftovers,
  suggesting, defaultPortions, sidePortionOverride,
  onPick, onSuggest, onClear, onPickSide, onClearSide, onSidePortionChange, mealType, onViewRecipe, onOpenMeal,
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
        {/* Bildsektion — feste Höhe, alle absolut positionierten Kinder bleiben hier */}
        <div style={{ position: 'relative', height: 132, flexShrink: 0, borderRadius: 'inherit', overflow: 'hidden' }}>
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
              onClick={() => (onOpenMeal ? onOpenMeal() : onViewRecipe?.(recipe))}
              style={{ cursor: (onOpenMeal || onViewRecipe) ? 'pointer' : 'default' }}
            >
              {recipe.name}
            </p>
            <div className="mz-magslot-meta">
              <span>{recipe.timeMinutes} min</span>
            </div>
          </div>
          {/* + Button für Beilage — nur wenn keine Beilage gesetzt */}
          {!hasSide && (
            <button
              onClick={(e) => { e.stopPropagation(); onPickSide(); }}
              className="mz-slot-del on-img"
              style={{ bottom: 8, top: 'auto', right: 8, opacity: 0.65, width: 20, height: 20, borderRadius: '50%' }}
              title="Zusätzliches Menü erstellen"
            >
              <Plus size={10} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="mz-slot-del on-img"><Trash2 size={12} /></button>
        </div>

        {/* Beilage-Strip — natürlicher Fluss unterhalb der Bildsektion, expandiert die Karte */}
        {hasSide && (
          <div className="mz-side-strip">
            <Plus size={9} style={{ color: 'var(--muted)', flexShrink: 0, opacity: 0.55 }} />
            <span
              className="mz-side-strip-name"
              onClick={sideRecipe ? (e) => { e.stopPropagation(); onViewRecipe?.(sideRecipe); } : undefined}
              style={{ cursor: sideRecipe && onViewRecipe ? 'pointer' : 'default' }}
              title={sideRecipe ? 'Rezept ansehen' : undefined}
            >{sideName}</span>
            <button
              className="mz-side-strip-btn"
              onClick={(e) => { e.stopPropagation(); onSidePortionChange(Math.max(1, (sidePortionOverride ?? defaultPortions) - 1)); }}
            >−</button>
            <span className="mz-side-strip-count">{sidePortionOverride ?? defaultPortions}P</span>
            <button
              className="mz-side-strip-btn"
              onClick={(e) => { e.stopPropagation(); onSidePortionChange(Math.min(20, (sidePortionOverride ?? defaultPortions) + 1)); }}
            >+</button>
            <button
              onClick={(e) => { e.stopPropagation(); onClearSide(); }}
              style={{ color: 'var(--ink-2)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            ><X size={10} /></button>
          </div>
        )}
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
