'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Trash2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getWeekId, getWeekDays, nextWeek, prevWeek, formatDate, getInitialDisplayWeek } from '@/lib/utils';
import { getTheme } from '@/lib/themes';
import { DayColumn } from './DayColumn';
import { ShoppingGroupsBar } from './ShoppingGroupsBar';
import type { WeekPlan, Recipe, WeatherCache, DayConstraint, AppSettings, MealSlot, ShoppingGroups } from '@/types';

interface WeekPlannerProps {
  recipes: Recipe[];
  settings: AppSettings;
  constraints: DayConstraint[];
  onViewRecipe?: (recipe: Recipe) => void;
}

export function WeekPlanner({ recipes, settings, constraints, onViewRecipe }: WeekPlannerProps) {
  const [currentDate, setCurrentDate] = useState(() =>
    getInitialDisplayWeek(settings.weekSwitchDay ?? 0)
  );
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [weather, setWeather] = useState<WeatherCache | null>(null);
  const [shoppingGroups, setShoppingGroups] = useState<ShoppingGroups>([{ id: 'sg-1', dayIndices: [1,2,3,4,5,6,7] }]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [loading, setLoading] = useState(true);

  const theme = getTheme(settings.theme);
  const weekId = getWeekId(currentDate);
  const weekDays = getWeekDays(currentDate);

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

  const handleSuggestWeek = async () => {
    setIsSuggesting(true);
    try {
      const res = await fetch('/api/weekplan/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId }),
      });
      const data = await res.json();
      setWeekPlan(data);
    } finally {
      setIsSuggesting(false);
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

    const DAY_SHORT  = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const pageW = 297; const pageH = 210;
    const margin = 12;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    // Palette — Salbei als PDF-Design
    const C = {
      sage:      [74,  122,  78] as [number,number,number],
      sageMid:   [143, 184, 143] as [number,number,number],
      sageLt:    [232, 242, 232] as [number,number,number],
      white:     [255, 255, 255] as [number,number,number],
      text:      [30,  45,  30]  as [number,number,number],
      textMuted: [107, 140, 107] as [number,number,number],
      border:    [200, 220, 200] as [number,number,number],
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

    const getRecipeImageUrl = (slot: MealSlot | null | undefined): string | null => {
      if (!slot?.recipeId) return null;
      const r = recipes.find(x => x.id === slot.recipeId);
      return r?.imageUrl ?? null;
    };

    // Header background
    doc.setFillColor(...C.sage);
    doc.rect(0, 0, pageW, 22, 'F');

    // Logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.white);
    doc.text('MahlZeit', margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 230, 200);

    const dateFrom = weekDays[0] ? format(weekDays[0], 'd. MMM', { locale: de }) : '';
    const dateTo   = weekDays[6] ? format(weekDays[6], 'd. MMM yyyy', { locale: de }) : '';
    doc.text(`Wochenplan · KW ${kwNum} · ${dateFrom} – ${dateTo}`, margin + 28, 14);

    // Meal rows config
    const allMealRows: { key: 'breakfast'|'lunch'|'dinner'; label: string; show: boolean }[] = [
      { key: 'breakfast', label: 'Frühstück',   show: showBreakfast },
      { key: 'lunch',     label: 'Mittagessen',  show: showLunch     },
      { key: 'dinner',    label: 'Abendessen',   show: showDinner    },
    ];
    const mealRows = allMealRows.filter(r => r.show);

    const numRows = mealRows.length || 1;
    const startY  = 27;
    const gridH   = usableH - (startY - margin);
    const rowH    = gridH / numRows;
    const labelW  = 20;
    const dayColW = (usableW - labelW) / 7;

    // Draw grid
    for (let ri = 0; ri < mealRows.length; ri++) {
      const row = mealRows[ri];
      const y   = startY + ri * rowH;

      // Row label background
      doc.setFillColor(...C.sageLt);
      doc.rect(margin, y, labelW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      // Vertical text label (rotated)
      doc.saveGraphicsState();
      doc.text(row.label, margin + labelW / 2, y + rowH / 2, { angle: 90, align: 'center' });
      doc.restoreGraphicsState();

      // Day cells
      for (let di = 0; di < 7; di++) {
        const x    = margin + labelW + di * dayColW;
        const plan = weekPlan?.days?.[di + 1];
        const slot = plan?.[row.key];
        const name = getRecipeName(slot);
        const time = getRecipeTime(slot);

        // Cell background — alternate
        const isToday = formatDate(weekDays[di]) === formatDate(new Date());
        doc.setFillColor(isToday ? 220 : (di % 2 === 0 ? 248 : 255), isToday ? 242 : (di % 2 === 0 ? 250 : 255), isToday ? 220 : (di % 2 === 0 ? 248 : 255));
        doc.rect(x, y, dayColW, rowH, 'F');

        // Border
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.rect(x, y, dayColW, rowH, 'S');

        // Day header (only first row)
        if (ri === 0) {
          doc.setFillColor(...C.sageMid);
          doc.rect(x, y, dayColW, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...C.white);
          const dayDate = weekDays[di];
          const dayLabel = `${DAY_SHORT[di]}  ${dayDate ? format(dayDate, 'd. MMM', { locale: de }) : ''}`;
          doc.text(dayLabel, x + dayColW / 2, y + 5.5, { align: 'center' });
        }

        // Recipe name
        if (name) {
          const textY = ri === 0 ? y + 12 : y + 6;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...C.text);
          const lines = doc.splitTextToSize(name, dayColW - 4);
          doc.text(lines.slice(0, 3), x + 2, textY);
          if (time) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...C.textMuted);
            doc.text(time, x + 2, textY + lines.slice(0,3).length * 4.5);
          }
        } else {
          const textY = ri === 0 ? y + 15 : y + rowH / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...C.border);
          doc.text('—', x + dayColW / 2, textY, { align: 'center' });
        }
      }
    }

    // Row borders
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    for (let ri = 0; ri <= mealRows.length; ri++) {
      const y = startY + ri * rowH;
      doc.line(margin, y, margin + usableW, y);
    }
    // Label/day column separator
    doc.line(margin + labelW, startY, margin + labelW, startY + gridH);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`Erstellt am ${format(new Date(), 'd. MMM yyyy, HH:mm', { locale: de })} · MahlZeitPlaner`, margin, pageH - 4);

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

  const getWeatherForDay = (date: Date) => {
    if (!weather?.days?.length) return null;
    const dateStr = formatDate(date);
    return weather.days.find((d) => d.date === dateStr) ?? null;
  };

  const kwNum = weekId.split('-W')[1];
  const startDateStr = weekDays[0] ? formatDate(weekDays[0]).slice(0, 10) : '';

  return (
    <div className="flex flex-col md:h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(prevWeek(currentDate))}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            style={{ backgroundColor: theme.weekNavBg, color: theme.weekNavText }}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-col items-center min-w-[72px]">
            <span className="text-sm font-bold leading-tight" style={{ color: theme.pageText }}>KW {kwNum}</span>
            <span className="text-[11px]" style={{ color: theme.pageSubtext }}>{startDateStr}</span>
          </div>

          <button
            onClick={() => setCurrentDate(nextWeek(currentDate))}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            style={{ backgroundColor: theme.weekNavBg, color: theme.weekNavText }}
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors"
            style={{ backgroundColor: theme.weekNavBg, color: theme.weekNavText }}
          >
            Heute
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPDF}
            className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors"
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = theme.weekNavBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            style={{ borderColor: theme.borderColor, color: theme.weekNavText }}
            title="Als PDF drucken (A4 Querformat)"
          >
            <Printer size={15} />
          </button>

          <button
            onClick={handleClearWeek}
            disabled={isClearing}
            className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors disabled:opacity-40 hover:text-red-500 hover:border-red-300 hover:bg-red-50"
            style={{ borderColor: theme.borderColor, color: theme.weekNavText }}
            title="Woche leeren"
          >
            {isClearing ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>

          <button
            onClick={handleSuggestWeek}
            disabled={isSuggesting}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-50 shadow-sm"
            style={{ backgroundColor: theme.todayAccent }}
          >
            {isSuggesting
              ? <RefreshCw size={14} className="animate-spin" />
              : <Sparkles size={14} />}
            <span className="hidden sm:inline">Woche vorschlagen</span>
          </button>
        </div>
      </div>

      {/* Shopping Groups Bar */}
      <ShoppingGroupsBar
        weekId={weekId}
        groups={shoppingGroups}
        onChange={setShoppingGroups}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: theme.pageSubtext }}>
          Wird geladen…
        </div>
      ) : (
        <div className="md:flex-1 md:overflow-x-auto">
          <div className="flex flex-col md:flex-row gap-3 pb-4 md:min-h-full">
            {weekDays.map((date, i) => {
              const dayIndex = i + 1;
              const dayConstraints = constraints.filter((c) => c.dayOfWeek === dayIndex);
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
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
