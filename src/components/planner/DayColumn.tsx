'use client';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { formatDate, calculatePortions, COMMON_UNITS } from '@/lib/utils';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { Badge } from '@/components/ui/Badge';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { RecipePickerModal, LEFTOVERS_ID } from './RecipePickerModal';
import { type DayPlan, type Recipe, type WeatherDay, type DayConstraint, type MealSlot, type AppSettings, type SideIngredient, computeTimeTags } from '@/types';

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
  onSaveNote?: (note: string) => void;
  onSaveSideIngredient?: (mealType: 'breakfast' | 'lunch' | 'dinner', ing: SideIngredient, slot: MealSlot) => void;
  onRemoveSideIngredient?: (mealType: 'breakfast' | 'lunch' | 'dinner', idx: number, slot: MealSlot) => void;
  locked?: boolean;
  onLockedAction?: () => void;
}

export function DayColumn({
  date, dayIndex, dayPlan, recipes, constraints, disabledConstraintIds,
  weather, settings, weekId, onUpdate, onToggleConstraint, onViewRecipe, onOpenMeal,
  onSaveNote, onSaveSideIngredient, onRemoveSideIngredient,
  locked = false, onLockedAction,
}: DayColumnProps) {
  const [pickerOpen, setPickerOpen]         = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [pickerOpenSide, setPickerOpenSide] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [suggesting, setSuggesting]         = useState<'lunch' | 'dinner' | null>(null);

  // Day note state
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote]     = useState(dayPlan?.note ?? '');
  useEffect(() => { setDraftNote(dayPlan?.note ?? ''); }, [dayPlan?.note]);

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
    if (locked) { onLockedAction?.(); return; }
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

  const handleSaveNote = () => {
    setEditingNote(false);
    onSaveNote?.(draftNote);
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

      {/* Day note */}
      <div
        style={{ padding: '3px 8px 4px', minHeight: 20, cursor: editingNote ? 'default' : 'text' }}
        onClick={() => { if (!editingNote) setEditingNote(true); }}
      >
        {editingNote ? (
          <textarea
            value={draftNote}
            onChange={e => setDraftNote(e.target.value)}
            onBlur={handleSaveNote}
            autoFocus
            rows={2}
            style={{
              width: '100%', fontSize: 11, lineHeight: 1.4, resize: 'none',
              border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px',
              background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span style={{
            fontSize: 11, color: draftNote ? 'var(--ink-2)' : 'var(--muted)',
            fontStyle: draftNote ? 'normal' : 'italic',
            display: 'block', lineHeight: 1.35,
          }}>
            {draftNote || '+ Notiz'}
          </span>
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
            sideIngredients={breakfastSlot?.sideIngredients}
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
            onSaveSideIngredient={onSaveSideIngredient ? (ing) => onSaveSideIngredient('breakfast', ing, breakfastSlot ?? { recipeId: null }) : undefined}
            onRemoveSideIngredient={onRemoveSideIngredient ? (idx) => onRemoveSideIngredient('breakfast', idx, breakfastSlot ?? { recipeId: null }) : undefined}
          />
        )}

        {showLunch && (
          <MealSlotCard
            label="Mittag"
            recipe={lunchRecipe}
            isLeftovers={lunchSlot?.isLeftovers}
            sideRecipe={lunchSideRecipe}
            sideIsLeftovers={lunchSlot?.sideIsLeftovers}
            sideIngredients={lunchSlot?.sideIngredients}
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
            onSaveSideIngredient={onSaveSideIngredient ? (ing) => onSaveSideIngredient('lunch', ing, lunchSlot ?? { recipeId: null }) : undefined}
            onRemoveSideIngredient={onRemoveSideIngredient ? (idx) => onRemoveSideIngredient('lunch', idx, lunchSlot ?? { recipeId: null }) : undefined}
          />
        )}

        {showDinner && (
          <MealSlotCard
            label="Abendessen"
            recipe={dinnerRecipe}
            isLeftovers={dinnerSlot?.isLeftovers}
            sideRecipe={dinnerSideRecipe}
            sideIsLeftovers={dinnerSlot?.sideIsLeftovers}
            sideIngredients={dinnerSlot?.sideIngredients}
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
            onSaveSideIngredient={onSaveSideIngredient ? (ing) => onSaveSideIngredient('dinner', ing, dinnerSlot ?? { recipeId: null }) : undefined}
            onRemoveSideIngredient={onRemoveSideIngredient ? (idx) => onRemoveSideIngredient('dinner', idx, dinnerSlot ?? { recipeId: null }) : undefined}
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
          locked={locked}
        />
      )}

      {pickerOpenSide && (
        <RecipePickerModal
          recipes={recipes}
          mealType={pickerOpenSide}
          dietPreference={settings.dietPreference}
          onSelect={(recipeId) => handlePickerSelectSide(pickerOpenSide, recipeId)}
          onClose={() => setPickerOpenSide(null)}
          locked={locked}
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
  sideIngredients?: SideIngredient[];
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
  onSaveSideIngredient?: (ing: SideIngredient) => void;
  onRemoveSideIngredient?: (idx: number) => void;
}

const SIDE_UNITS = ['Stk', 'g', 'kg', 'ml', 'dl', 'l', 'EL', 'TL', 'Bund', 'Dose', 'Pkg', 'Handvoll'];

function MealSlotCard({
  label, recipe, isLeftovers, sideRecipe, sideIsLeftovers, sideIngredients,
  suggesting, defaultPortions, sidePortionOverride,
  onPick, onSuggest, onClear, onPickSide, onClearSide, onSidePortionChange, mealType,
  onViewRecipe, onOpenMeal, onSaveSideIngredient, onRemoveSideIngredient,
}: MealSlotCardProps) {
  const hasSide = !!(sideRecipe || sideIsLeftovers);
  const hasAnyIngredients = !!(sideIngredients?.length);
  const sideName = sideIsLeftovers ? 'Reste essen' : sideRecipe?.name ?? '';

  // Side menu + ingredient form state
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [sideIngForm, setSideIngForm]   = useState(false);
  const [ingName, setIngName]           = useState('');
  const [ingAmount, setIngAmount]       = useState('1');
  const [ingUnit, setIngUnit]           = useState('Stk');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showSideMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSideMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSideMenu]);

  const handleSaveSideIng = () => {
    const amt = parseFloat(ingAmount.replace(',', '.'));
    if (!ingName.trim() || isNaN(amt) || amt <= 0) return;
    onSaveSideIngredient?.({ name: ingName.trim(), amount: amt, unit: ingUnit });
    setIngName('');
    setIngAmount('1');
    setIngUnit('Stk');
    setSideIngForm(false);
  };

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
        {/* Bildsektion */}
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

          {/* + Button — zeigt Menü für Beilage oder Zutat */}
          {!hasSide && !hasAnyIngredients && (
            <div ref={menuRef} style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSideMenu(v => !v); }}
                className="mz-slot-del on-img"
                style={{ position: 'static', opacity: 0.65, width: 20, height: 20, borderRadius: '50%' }}
                title="Beilage hinzufügen"
              >
                <Plus size={10} />
              </button>
              {showSideMenu && (
                <div
                  style={{
                    position: 'absolute', bottom: 24, right: 0, zIndex: 20,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: 'var(--shadow-lg)',
                    minWidth: 150, overflow: 'hidden',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-tint)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    onClick={() => { setShowSideMenu(false); onPickSide(); }}
                  >
                    Rezept als Beilage
                  </button>
                  <button
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-tint)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    onClick={() => { setShowSideMenu(false); setSideIngForm(true); }}
                  >
                    Zutat hinzufügen
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="mz-slot-del on-img"><Trash2 size={12} /></button>
        </div>

        {/* Beilage-Strip (Rezept) */}
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

        {/* Manuelle Beilage-Zutaten */}
        {hasAnyIngredients && sideIngredients!.map((ing, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px 3px 8px',
              borderTop: idx === 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Plus size={9} style={{ color: 'var(--muted)', flexShrink: 0, opacity: 0.55 }} />
            <span style={{ flex: 1, fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ing.name} {ing.amount} {ing.unit}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveSideIngredient?.(idx); }}
              style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            ><X size={10} /></button>
          </div>
        ))}

        {/* Zutat-Hinzufügen-Schaltfläche wenn bereits Zutaten oder Rezept-Beilage vorhanden */}
        {(hasAnyIngredients || hasSide) && !sideIngForm && (
          <button
            onClick={() => setSideIngForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer',
              borderTop: '1px solid var(--border)', width: '100%', textAlign: 'left',
            }}
          >
            <Plus size={9} />
            Zutat hinzufügen
          </button>
        )}

        {/* Mini Zutat-Formular */}
        {sideIngForm && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              placeholder="Zutat (z.B. Broccoli)"
              value={ingName}
              onChange={e => setIngName(e.target.value)}
              autoFocus
              style={{
                width: '100%', fontSize: 11, padding: '4px 7px', border: '1px solid var(--border)',
                borderRadius: 5, background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveSideIng(); if (e.key === 'Escape') { setSideIngForm(false); } }}
            />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="number"
                value={ingAmount}
                onChange={e => setIngAmount(e.target.value)}
                min={0.1}
                step={0.5}
                style={{
                  width: 52, fontSize: 11, padding: '4px 5px', border: '1px solid var(--border)',
                  borderRadius: 5, background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <select
                value={ingUnit}
                onChange={e => setIngUnit(e.target.value)}
                style={{
                  flex: 1, fontSize: 11, padding: '4px 5px', border: '1px solid var(--border)',
                  borderRadius: 5, background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
                }}
              >
                {SIDE_UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <button
                onClick={handleSaveSideIng}
                style={{
                  padding: '4px 9px', fontSize: 11, background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600,
                }}
              >+</button>
              <button
                onClick={() => setSideIngForm(false)}
                style={{
                  padding: '4px 7px', fontSize: 11, background: 'none', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer',
                }}
              >×</button>
            </div>
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
