'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Trash2, Printer, Heart } from 'lucide-react';
import { format, getISOWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { getWeekId, getWeekDays, nextWeek, prevWeek, formatDate, getInitialDisplayWeek } from '@/lib/utils';
import { DayColumn } from './DayColumn';
import { ShoppingGroupsBar } from './ShoppingGroupsBar';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import type { WeekPlan, Recipe, WeatherCache, DayConstraint, AppSettings, MealSlot, ShoppingGroups, SideIngredient } from '@/types';

type MealKind = 'breakfast' | 'lunch' | 'dinner';
interface ActiveDrag { dayIndex: number; mealType: MealKind; recipe: Recipe | null; label: string; }

/** Tauscht zwei gleichnamige Mahlzeit-Slots zwischen zwei Tagen (immutable). Eigene Inverse. */
function swapMealsInPlan(plan: WeekPlan | null, dayA: number, dayB: number, mealType: MealKind): WeekPlan | null {
  if (!plan || dayA === dayB) return plan;
  const days = { ...plan.days };
  const emptyDay = { dinner: { recipeId: null }, showLunch: false };
  const slotA = days[dayA]?.[mealType] ?? { recipeId: null };
  const slotB = days[dayB]?.[mealType] ?? { recipeId: null };
  days[dayA] = { ...(days[dayA] ?? emptyDay), [mealType]: slotB };
  days[dayB] = { ...(days[dayB] ?? emptyDay), [mealType]: slotA };
  return { ...plan, days };
}

const MEAL_LABEL: Record<MealKind, string> = { breakfast: 'Frühstück', lunch: 'Mittag', dinner: 'Abendessen' };

interface WeekPlannerProps {
  recipes: Recipe[];
  settings: AppSettings;
  constraints: DayConstraint[];
  onViewRecipe?: (recipe: Recipe) => void;
  onOpenMeal?: (ctx: { recipe: Recipe; weekId: string; dayIndex: number; mealType: 'breakfast' | 'lunch' | 'dinner'; slot: MealSlot }) => void;
  /** Inkrementiert von aussen (AppShell) nach einem Slot-Update → erzwingt Neuladen des Plans */
  plannerRefreshKey?: number;
  /** Freemium-Sperre: Menüvorschlag + Template-Rezepte gesperrt */
  locked?: boolean;
  /** Öffnet das Upgrade-Modal (AppShell) */
  onLockedAction?: () => void;
}

/** True, wenn irgendein Tages-Slot der Woche ein Rezept (oder Custom-Eintrag) enthält. */
function planHasRecipes(plan: WeekPlan | null): boolean {
  if (!plan?.days) return false;
  const hasMeal = (slot?: MealSlot) =>
    !!slot && (!!slot.recipeId || !!slot.sideRecipeId || !!slot.customName);
  return Object.values(plan.days).some(
    (d) => hasMeal(d.breakfast) || hasMeal(d.lunch) || hasMeal(d.dinner),
  );
}

export function WeekPlanner({ recipes, settings, constraints, onViewRecipe, onOpenMeal, plannerRefreshKey, locked = false, onLockedAction }: WeekPlannerProps) {
  const weekStartDay = (settings.weekSwitchDay ?? 1) as 0|1|2|3|4|5|6;
  const [currentDate, setCurrentDate] = useState(() =>
    getInitialDisplayWeek(weekStartDay)
  );
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [weather, setWeather] = useState<WeatherCache | null>(null);
  const [shoppingGroups, setShoppingGroups] = useState<ShoppingGroups>([{ id: 'sg-1', dayIndices: [1,2,3,4,5,6,7] }]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [confirmSuggest, setConfirmSuggest] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  // Drag-and-Drop Sensoren: Desktop = Maus (8px Schwelle, Klicks bleiben Klicks);
  // Mobile = Touch mit Long-Press (200ms), damit normales Scrollen/Tippen erhalten bleibt.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const weekId = getWeekId(currentDate);
  const weekDays = getWeekDays(currentDate, weekStartDay);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, groupsRes] = await Promise.all([
        fetch(`/api/weekplan?weekId=${weekId}`),
        fetch(`/api/weekplan/shopping-groups?weekId=${weekId}`),
      ]);
      const planData = await planRes.json();
      setWeekPlan(planData);
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setShoppingGroups(groupsData);
      }
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  const loadWeather = useCallback(async () => {
    try {
      const res = await fetch('/api/weather');
      const data = await res.json();
      setWeather(data);
    } catch {}
  }, []);

  const weatherLocation = settings.weather?.location ?? '';

  useEffect(() => { loadPlan(); }, [loadPlan]);
  // Neu laden wenn Standort in Einstellungen geändert wurde
  useEffect(() => { loadWeather(); }, [loadWeather, weatherLocation]);
  // Neu laden wenn von aussen (z.B. Portionen im Rezept-Modal gespeichert) angestossen
  useEffect(() => {
    if (plannerRefreshKey !== undefined) loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerRefreshKey]);

  const runSuggestWeek = async () => {
    setConfirmSuggest(false);
    setIsSuggesting(true);
    try {
      const res = await fetch('/api/weekplan/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, favoritesOnly }),
      });
      const data = await res.json();
      setWeekPlan(data);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSuggestWeek = () => {
    if (locked) { onLockedAction?.(); return; }
    // Bereits gefüllte Woche nicht unbewusst überschreiben
    if (planHasRecipes(weekPlan)) {
      setConfirmSuggest(true);
    } else {
      runSuggestWeek();
    }
  };

  const handleClearWeek = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/weekplan?weekId=${weekId}`, { method: 'DELETE' });
      const data = await res.json();
      setWeekPlan(data);
    } finally {
      setIsClearing(false);
    }
  };

  const handleToggleConstraint = async (constraintId: string) => {
    const res = await fetch('/api/weekplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId, toggleConstraintId: constraintId }),
    });
    const updated = await res.json();
    setWeekPlan(updated);
  };

  const handlePrintPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });

    const showBreakfast = settings.showBreakfast ?? false;
    const showLunch     = settings.showLunch     ?? false;
    const showDinner    = settings.showDinner    ?? true;

    const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const pageW = 297; const pageH = 210;
    const margin = 12;
    const usableW = pageW - margin * 2;

    const C = {
      ink:    [ 39,  31,  26] as [number,number,number],
      ink2:   [ 92,  80,  72] as [number,number,number],
      muted:  [154, 140, 128] as [number,number,number],
      border: [224, 216, 206] as [number,number,number],
      bg:     [250, 247, 242] as [number,number,number],
      accent: [217,  84,  59] as [number,number,number],
      frBar:  [192, 122,  18] as [number,number,number],
      miBar:  [217,  84,  59] as [number,number,number],
      abBar:  [ 62,  44,  34] as [number,number,number],
      frBg:   [255, 252, 240] as [number,number,number],
      miBg:   [255, 255, 255] as [number,number,number],
      abBg:   [250, 247, 243] as [number,number,number],
      dotV:   [111, 154, 106] as [number,number,number],
      dotVg:  [ 90, 138,  79] as [number,number,number],
      dotP:   [ 91, 134, 166] as [number,number,number],
      dotM:   [217,  84,  59] as [number,number,number],
    };

    const CATEGORY_COLORS: Record<string, [number,number,number]> = {
      'Frühstück':                  [240, 204,  88],
      'Salate & Bowls':             [156, 200, 152],
      'Pasta':                      [245, 168, 104],
      'Reis & Getreide':            [232, 216, 128],
      'Suppen, Eintöpfe & Currys':  [245, 200,  72],
      'Vegetarische Hauptgerichte': [156, 200, 152],
      'Desserts & Süsses':          [245, 164, 176],
      'Aufläufe & Gratins':         [245, 176, 136],
      'Fisch & Meeresfrüchte':      [136, 196, 232],
      'Fleisch & Geflügel':         [232, 168, 152],
      'Snacks & Vorspeisen':        [245, 187, 136],
      'Wraps & Sandwiches':         [168, 200, 240],
      'Kartoffelgerichte':          [216, 192, 140],
    };

    const getRecipeName = (slot: MealSlot | null | undefined) => {
      if (!slot) return '';
      if (slot.isLeftovers) return 'Reste essen';
      if (slot.recipeId) {
        const r = recipes.find(x => x.id === slot.recipeId);
        if (r) return r.name;
      }
      return '';
    };

    const getRecipeTime = (slot: MealSlot | null | undefined) => {
      if (!slot?.recipeId) return '';
      const r = recipes.find(x => x.id === slot.recipeId);
      return r ? `${r.timeMinutes} min` : '';
    };

    const getRecipeCategory = (slot: MealSlot | null | undefined): string => {
      if (!slot?.recipeId) return '';
      return recipes.find(x => x.id === slot.recipeId)?.category ?? '';
    };

    const getRecipeDietCategory = (slot: MealSlot | null | undefined): string => {
      if (!slot?.recipeId) return '';
      return recipes.find(x => x.id === slot.recipeId)?.dietCategory ?? '';
    };

    // Header — Wordmark links + KW-Block rechts + Akzentlinie
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.ink);
    doc.text('MahlZyt', margin, 11);

    const pdfAdults   = settings.household.adults;
    const pdfChildren = settings.household.children.length;
    const pdfHousehold = [
      `${pdfAdults} Erw.`,
      pdfChildren > 0 ? `${pdfChildren} Kind${pdfChildren !== 1 ? 'er' : ''}` : null,
    ].filter(Boolean).join(' · ');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(`MENÜPLANER · ${pdfHousehold}`, margin, 16);

    const dateFrom = weekDays[0] ? format(weekDays[0], 'd. MMM', { locale: de }) : '';
    const dateTo   = weekDays[6] ? format(weekDays[6], 'd. MMM yyyy', { locale: de }) : '';
    const kwStr    = String(kwNum);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.ink);
    doc.text(kwStr, pageW - margin, 11, { align: 'right' });
    const kwNumWidth = doc.getTextWidth(kwStr);
    doc.setFontSize(8);
    doc.text('KW ', pageW - margin - kwNumWidth - 1, 11, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.ink2);
    doc.text(`${dateFrom} – ${dateTo}`, pageW - margin, 16, { align: 'right' });

    doc.setFillColor(...C.accent);
    doc.rect(margin, 19, usableW, 0.8, 'F');

    // Meal rows config
    const allMealRows: { key: 'breakfast'|'lunch'|'dinner'; label: string; show: boolean }[] = [
      { key: 'breakfast', label: 'Frühstück',  show: showBreakfast },
      { key: 'lunch',     label: 'Mittagessen', show: showLunch     },
      { key: 'dinner',    label: 'Abendessen',  show: showDinner    },
    ];
    const mealRows = allMealRows.filter(r => r.show);
    const numRows  = mealRows.length || 1;

    const startY     = 23;
    const labelW     = 16;
    const dayColW    = (usableW - labelW) / 7;
    const dayHeaderH = 12;
    const footerH    = 10;
    const gridH      = pageH - margin - startY - footerH;
    const mealH      = (gridH - dayHeaderH) / numRows;

    // Corner + Day-Header-Zeile
    doc.setFillColor(...C.bg);
    doc.rect(margin, startY, labelW, dayHeaderH, 'F');

    for (let di = 0; di < 7; di++) {
      const x = margin + labelW + di * dayColW;
      doc.setFillColor(...C.bg);
      doc.rect(x, startY, dayColW, dayHeaderH, 'F');
      if (di > 0) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(x, startY, x, startY + dayHeaderH);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(DAY_SHORT[di].toUpperCase(), x + dayColW / 2, startY + 4.5, { align: 'center' });
      const dayDate = weekDays[di];
      doc.setFontSize(8.5);
      doc.setTextColor(...C.ink);
      doc.text(dayDate ? format(dayDate, 'd.M.', { locale: de }) : '', x + dayColW / 2, startY + 9.5, { align: 'center' });
    }

    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(margin, startY + dayHeaderH, margin + usableW, startY + dayHeaderH);

    // Meal-Rows
    for (let ri = 0; ri < mealRows.length; ri++) {
      const row  = mealRows[ri];
      const rowY = startY + dayHeaderH + ri * mealH;
      const mealBg       = row.key === 'breakfast' ? C.frBg : row.key === 'lunch' ? C.miBg : C.abBg;
      const mealBarColor = row.key === 'breakfast' ? C.frBar : row.key === 'lunch' ? C.miBar : C.abBar;

      // Row-Label
      doc.setFillColor(...C.bg);
      doc.rect(margin, rowY, labelW, mealH, 'F');
      doc.setFillColor(...mealBarColor);
      doc.rect(margin, rowY, 1, mealH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...mealBarColor);
      doc.text(row.label.toUpperCase(), margin + labelW + 5, rowY + mealH / 2, { angle: 90, align: 'center' });

      // 7 Tageszellen
      for (let di = 0; di < 7; di++) {
        const x    = margin + labelW + di * dayColW;
        const plan = weekPlan?.days?.[di + 1];
        const slot = plan?.[row.key];
        const name = getRecipeName(slot);
        const time = getRecipeTime(slot);
        const cat  = getRecipeCategory(slot);
        const diet = getRecipeDietCategory(slot);

        doc.setFillColor(...mealBg);
        doc.rect(x, rowY, dayColW, mealH, 'F');

        // Kategorie-Farb-Strip (0.8mm)
        const catColor = cat ? CATEGORY_COLORS[cat] : null;
        if (catColor && name) {
          doc.setFillColor(...catColor);
          doc.rect(x, rowY, dayColW, 0.8, 'F');
        }

        if (name) {
          const textY = rowY + mealH * 0.33;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...C.ink);
          const lines = doc.splitTextToSize(name, dayColW - 6);
          doc.text(lines.slice(0, 3), x + dayColW / 2, textY, { align: 'center' });
          if (time) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...C.muted);
            doc.text(time, x + dayColW / 2, textY + lines.slice(0, 3).length * 4.5, { align: 'center' });
          }
          const dotColor =
            diet === 'vegan'      ? C.dotV  :
            diet === 'vegetarian' ? C.dotVg :
            diet === 'fish'       ? C.dotP  :
            diet === 'meat'       ? C.dotM  : null;
          if (dotColor) {
            doc.setFillColor(...dotColor);
            doc.circle(x + dayColW / 2, rowY + mealH - 5, 1.5, 'F');
          }
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...C.border);
          doc.text('—', x + dayColW / 2, rowY + mealH / 2, { align: 'center' });
        }

        if (di > 0) {
          doc.setDrawColor(...C.border);
          doc.setLineWidth(0.2);
          doc.line(x, rowY, x, rowY + mealH);
        }
      }

      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(margin, rowY + mealH, margin + usableW, rowY + mealH);
    }

    // Linke Trennlinie Label | Tage
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(margin + labelW, startY, margin + labelW, startY + dayHeaderH + mealRows.length * mealH);

    // Footer
    const footerY = pageH - 8;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, margin + usableW, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(`Erstellt ${format(new Date(), 'd. MMM yyyy, HH:mm', { locale: de })}`, margin, footerY + 1.5);

    const legend: { label: string; color: [number,number,number] }[] = [
      { label: 'Vegan', color: C.dotV }, { label: 'Vegetarisch', color: C.dotVg },
      { label: 'Pescetarisch', color: C.dotP }, { label: 'Fleisch', color: C.dotM },
    ];
    doc.setFontSize(6.5);
    const legendItemWidths = legend.map(leg => doc.getTextWidth(leg.label) + 9);
    const totalLegendW = legendItemWidths.reduce((a, b) => a + b, 0);
    let lx = (pageW / 2) - (totalLegendW / 2);
    for (const leg of legend) {
      doc.setFillColor(...leg.color);
      doc.circle(lx, footerY + 1, 1.5, 'F');
      doc.setTextColor(...C.muted);
      doc.text(leg.label, lx + 3, footerY + 1.5);
      lx += doc.getTextWidth(leg.label) + 9;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.border);
    doc.text('MAHLZEIT', margin + usableW, footerY + 1.5, { align: 'right' });

    doc.save(`wochenplan-kw${kwNum}.pdf`);
  };

  const handleUpdateSlot = async (
    dayIndex: number,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'showLunch',
    slot: unknown
  ) => {
    const res = await fetch('/api/weekplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId, day: dayIndex, mealType, slot }),
    });
    const updated = await res.json();
    setWeekPlan(updated);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { dayIndex: number; mealType: MealKind } | undefined;
    if (!data) return;
    const slot = weekPlan?.days?.[data.dayIndex]?.[data.mealType];
    const recipe = slot?.recipeId ? recipes.find((r) => r.id === slot.recipeId) ?? null : null;
    setActiveDrag({ ...data, recipe, label: MEAL_LABEL[data.mealType] });
  };

  // Tausch zweier gleichnamiger Slots: optimistisch sofort, dann beide Tage persistieren.
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = active.data.current as { dayIndex: number; mealType: MealKind } | undefined;
    const b = over.data.current   as { dayIndex: number; mealType: MealKind } | undefined;
    if (!a || !b || a.mealType !== b.mealType || a.dayIndex === b.dayIndex) return;

    const slotA = weekPlan?.days?.[a.dayIndex]?.[a.mealType] ?? { recipeId: null };
    const slotB = weekPlan?.days?.[b.dayIndex]?.[b.mealType] ?? { recipeId: null };

    setWeekPlan((prev) => swapMealsInPlan(prev, a.dayIndex, b.dayIndex, a.mealType));

    try {
      await fetch('/api/weekplan', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, day: a.dayIndex, mealType: a.mealType, slot: slotB }),
      });
      const res = await fetch('/api/weekplan', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, day: b.dayIndex, mealType: b.mealType, slot: slotA }),
      });
      setWeekPlan(await res.json());
    } catch {
      // Fehlschlag: optimistischen Tausch rückgängig machen (Swap ist seine eigene Inverse)
      setWeekPlan((prev) => swapMealsInPlan(prev, a.dayIndex, b.dayIndex, a.mealType));
    }
  };

  const handleSaveNote = async (dayIndex: number, note: string) => {
    const res = await fetch('/api/weekplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId, day: dayIndex, mealType: 'note', note }),
    });
    const updated = await res.json();
    setWeekPlan(updated);
  };

  const handleSaveSideIngredient = async (
    dayIndex: number,
    mealType: 'breakfast' | 'lunch' | 'dinner',
    ingredient: SideIngredient,
    currentSlot: MealSlot
  ) => {
    const updatedSlot = {
      ...currentSlot,
      sideIngredients: [...(currentSlot.sideIngredients ?? []), ingredient],
    };
    await handleUpdateSlot(dayIndex, mealType, updatedSlot);
  };

  const handleRemoveSideIngredient = async (
    dayIndex: number,
    mealType: 'breakfast' | 'lunch' | 'dinner',
    idx: number,
    currentSlot: MealSlot
  ) => {
    const updatedSlot = {
      ...currentSlot,
      sideIngredients: (currentSlot.sideIngredients ?? []).filter((_, i) => i !== idx),
    };
    await handleUpdateSlot(dayIndex, mealType, updatedSlot);
  };

  const getWeatherForDay = (date: Date) => {
    if (!weather?.days?.length) return null;
    const dateStr = formatDate(date);
    return weather.days.find((d) => d.date === dateStr) ?? null;
  };

  const thursday = weekDays.find(d => d.getDay() === 4);
  const kwNum = thursday ? String(getISOWeek(thursday)).padStart(2, '0') : weekId.split('-W')[1];
  const dateFrom = weekDays[0] ? format(weekDays[0], 'd. MMM', { locale: de }) : '';
  const dateTo   = weekDays[6] ? format(weekDays[6], 'd. MMM yyyy', { locale: de }) : '';
  const adults   = settings.household.adults;
  const children = settings.household.children.length;
  const householdLabel = [
    `${adults} Erwachsene${adults !== 1 ? '' : 'r'}`,
    children > 0 ? `${children} Kind${children !== 1 ? 'er' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="mz-planner">
      <div className="mz-plbar">
        <div className="mz-plbar-l">
          {/* Seitentitel + Haushalt-Subtitel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', color: '#271f1a' }}>
              Mahlzeit-Planer
            </span>
            <span className="mz-hide-sm" style={{ fontSize: 11, color: '#9a8c80' }}>{householdLabel}</span>
          </div>

          <div className="mz-weeknav">
            <button
              onClick={() => setCurrentDate(prevWeek(currentDate))}
              className="mz-icon-btn ghost"
              title="Vorherige Woche"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="mz-weeklabel">
              <span className="mz-kw">KW {kwNum}</span>
              <span className="mz-range mz-hide-sm">{dateFrom} – {dateTo}</span>
            </div>
            <button
              onClick={() => setCurrentDate(nextWeek(currentDate))}
              className="mz-icon-btn ghost"
              title="Nächste Woche"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="mz-btn-soft"
            style={{ padding: '7px 14px', fontSize: 13 }}
          >
            Heute
          </button>
        </div>

        <div className="mz-plbar-r">
          <button
            onClick={handlePrintPDF}
            className="mz-icon-btn ghost"
            title="Als PDF drucken (A4 Querformat)"
          >
            <Printer size={15} />
          </button>

          <button
            onClick={handleClearWeek}
            disabled={isClearing}
            className="mz-icon-btn ghost"
            title="Woche leeren"
            style={{ opacity: isClearing ? 0.4 : 1 }}
          >
            {isClearing ? <RefreshCw size={15} style={{ animation: 'mzspin 1s linear infinite' }} /> : <Trash2 size={15} />}
          </button>

          {/* Favoriten-Herz + Suggest — ein Pill-Button mit eingebettetem Toggle */}
          <button
            onClick={handleSuggestWeek}
            disabled={isSuggesting}
            className="mz-btn-primary"
            title={locked ? 'Erfordert ein aktives Abo' : undefined}
            style={{ paddingLeft: 5, opacity: isSuggesting ? 0.5 : locked ? 0.45 : 1, filter: locked ? 'grayscale(0.7)' : undefined }}
          >
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setFavoritesOnly(v => !v); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setFavoritesOnly(v => !v); } }}
              title={favoritesOnly ? 'Nur Favoriten aktiv — klicken zum Deaktivieren' : 'Alle Rezepte — klicken für Nur Favoriten'}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,.9)',
                color: favoritesOnly ? '#e53935' : '#c49a6c',
                cursor: 'pointer',
                marginRight: 2,
              }}
            >
              <Heart size={13} fill={favoritesOnly ? 'currentColor' : 'none'} />
            </span>
            {isSuggesting
              ? <RefreshCw size={14} style={{ animation: 'mzspin 1s linear infinite' }} />
              : <Sparkles size={14} />}
            <span className="mz-hide-sm">Woche vorschlagen</span>
          </button>
        </div>
      </div>

      <ShoppingGroupsBar
        weekId={weekId}
        groups={shoppingGroups}
        onChange={setShoppingGroups}
      />

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          Wird geladen…
        </div>
      ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className="mz-mag-grid" style={{ overflowX: 'auto', paddingBottom: 12 }}>
            {weekDays.map((date, i) => {
              const dayIndex = i + 1;
              const jsDay = date.getDay(); // 0=So, 1=Mo ... 6=Sa
              const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mo ... 7=So
              const dayConstraints = constraints.filter((c) => c.dayOfWeek === isoDay);
              const dayWeather = getWeatherForDay(date);
              const dayPlan = weekPlan?.days?.[dayIndex] ?? null;
              const disabledIds = weekPlan?.disabledConstraintIds ?? [];

              return (
                <DayColumn
                  key={dayIndex}
                  date={date}
                  dayIndex={dayIndex}
                  dayPlan={dayPlan}
                  recipes={recipes}
                  constraints={dayConstraints}
                  disabledConstraintIds={disabledIds}
                  weather={dayWeather}
                  settings={settings}
                  weekId={weekId}
                  onUpdate={handleUpdateSlot}
                  onToggleConstraint={handleToggleConstraint}
                  onViewRecipe={onViewRecipe}
                  onOpenMeal={onOpenMeal}
                  onSaveNote={(note) => handleSaveNote(dayIndex, note)}
                  onSaveSideIngredient={(mealType, ing, slot) => handleSaveSideIngredient(dayIndex, mealType, ing, slot)}
                  onRemoveSideIngredient={(mealType, idx, slot) => handleRemoveSideIngredient(dayIndex, mealType, idx, slot)}
                  locked={locked}
                  onLockedAction={onLockedAction}
                  favoritesOnly={favoritesOnly}
                  dndEnabled={!locked}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              <div style={{ width: 150, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: 'var(--card)', cursor: 'grabbing', transform: 'rotate(2deg)' }}>
                <div style={{ height: 90, position: 'relative' }}>
                  {activeDrag.recipe?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeDrag.recipe.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <PhotoSlot category={activeDrag.recipe?.category} />
                  )}
                </div>
                <div style={{ padding: '6px 9px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeDrag.recipe?.name ?? activeDrag.label}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Bestätigung vor dem Überschreiben einer bereits gefüllten Woche */}
      {confirmSuggest && (
        <div className="mz-modal-scrim" onClick={() => setConfirmSuggest(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-card)', padding: '24px 24px 20px',
              maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                Woche neu vorschlagen?
              </h3>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--muted)', margin: '0 0 20px' }}>
              Die aktuelle Woche wird neu vorgeschlagen und die bestehenden Rezepte werden aus dem
              Menüplan gelöscht. Bist du dir sicher?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="mz-btn-soft" onClick={() => setConfirmSuggest(false)}>
                Abbrechen
              </button>
              <button className="mz-btn-primary" onClick={runSuggestWeek} style={{ background: '#c62828' }}>
                Neu vorschlagen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
