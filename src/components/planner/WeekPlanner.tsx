'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Trash2, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getWeekId, getWeekDays, nextWeek, prevWeek, formatDate } from '@/lib/utils';
import { getTheme } from '@/lib/themes';
import { DayColumn } from './DayColumn';
import type { WeekPlan, Recipe, WeatherCache, DayConstraint, AppSettings, MealSlot } from '@/types';

interface WeekPlannerProps {
  recipes: Recipe[];
  settings: AppSettings;
  constraints: DayConstraint[];
}

export function WeekPlanner({ recipes, settings, constraints }: WeekPlannerProps) {
  const [currentDate, setCurrentDate] = useState(() => nextWeek(new Date()));
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [weather, setWeather] = useState<WeatherCache | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [loading, setLoading] = useState(true);

  const theme = getTheme(settings.theme);
  const weekId = getWeekId(currentDate);
  const weekDays = getWeekDays(currentDate);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weekplan?weekId=${weekId}`);
      const data = await res.json();
      setWeekPlan(data);
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

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useEffect(() => { loadWeather(); }, [loadWeather]);

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

  const handlePrintPDF = async () => {
    const { default: jsPDF }    = await import('jspdf');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoTable             = ((await import('jspdf-autotable')) as any).default;

    const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });

    const showLunch     = settings.defaultView === 'lunchAndDinner'       || settings.defaultView === 'breakfastLunchDinner';
    const showBreakfast = settings.defaultView === 'breakfastLunchDinner';

    const DAY_SHORT = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];

    // ── Hilfsfunktion: Slot → Zelltext ──────────────────────────────────────
    const slotText = (slot: MealSlot | null | undefined): string => {
      if (!slot)              return '';
      if (slot.isLeftovers)   return 'Reste essen';
      if (!slot.recipeId)     return '';
      const r = recipes.find(x => x.id === slot.recipeId);
      if (!r)                 return '';
      return `${r.name}\n(${r.timeMinutes} min)`;
    };

    // ── Kopfzeile ────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30);
    doc.text('MahlZeit – Wochenplan', 14, 14);

    const dateFrom = weekDays[0] ? format(weekDays[0], 'd. MMM',      { locale: de }) : '';
    const dateTo   = weekDays[6] ? format(weekDays[6], 'd. MMM yyyy', { locale: de }) : '';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`KW ${kwNum}  ·  ${dateFrom} – ${dateTo}`, 14, 21);

    // ── Spalten-Header ───────────────────────────────────────────────────────
    const head = [[
      { content: '', styles: { fillColor: [80, 130, 97] as [number, number, number] } },
      ...weekDays.map((d, i) => ({
        content: `${DAY_SHORT[i]}\n${format(d, 'd. MMM', { locale: de })}`,
        styles:  { fillColor: [80, 130, 97] as [number, number, number], halign: 'center' as const },
      })),
    ]];

    // ── Zeilen ───────────────────────────────────────────────────────────────
    const body: string[][] = [];

    if (showBreakfast) {
      body.push([
        'Frühstück',
        ...weekDays.map((_, i) => slotText(weekPlan?.days?.[i + 1]?.breakfast)),
      ]);
    }
    if (showLunch) {
      body.push([
        'Mittagessen',
        ...weekDays.map((_, i) => slotText(weekPlan?.days?.[i + 1]?.lunch)),
      ]);
    }
    body.push([
      'Abendessen',
      ...weekDays.map((_, i) => slotText(weekPlan?.days?.[i + 1]?.dinner)),
    ]);

    // ── Tabelle ──────────────────────────────────────────────────────────────
    // A4 landscape usable width: 297 - 14*2 = 269mm
    const usable    = 269;
    const labelCol  = 22;
    const dayColW   = (usable - labelCol) / 7;   // ≈ 35.3mm

    autoTable(doc, {
      startY:  27,
      head,
      body,
      theme:   'grid',
      margin:  { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: labelCol, fontStyle: 'bold', fillColor: [240, 246, 241], textColor: [50, 90, 60] },
        1: { cellWidth: dayColW },
        2: { cellWidth: dayColW },
        3: { cellWidth: dayColW },
        4: { cellWidth: dayColW },
        5: { cellWidth: dayColW },
        6: { cellWidth: dayColW },
        7: { cellWidth: dayColW },
      },
      headStyles: {
        fillColor:  [80, 130, 97],
        textColor:  255,
        fontStyle:  'bold',
        fontSize:   9,
        halign:     'center',
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize:    9,
        cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
        valign:      'top',
        textColor:   [40, 40, 40],
      },
      alternateRowStyles: {
        fillColor: [248, 252, 249],
      },
      styles: {
        overflow:   'linebreak',
        lineColor:  [210, 225, 215],
        lineWidth:  0.3,
      },
    });

    // ── Fussnote ─────────────────────────────────────────────────────────────
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(
      `Erstellt am ${format(new Date(), 'd. MMM yyyy, HH:mm', { locale: de })} · MahlZeitPlaner`,
      14,
      pageH - 6
    );

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
            className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors hover:bg-gray-50"
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

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: theme.pageSubtext }}>
          Wird geladen…
        </div>
      ) : (
        <div className="md:flex-1 md:overflow-x-auto">
          <div className="flex flex-col md:flex-row gap-3 pb-4 md:h-full">
            {weekDays.map((date, i) => {
              const dayIndex = i + 1;
              const dayConstraints = constraints.filter((c) => c.dayOfWeek === dayIndex);
              const dayWeather = getWeatherForDay(date);
              const dayPlan = weekPlan?.days?.[dayIndex] ?? null;

              return (
                <DayColumn
                  key={dayIndex}
                  date={date}
                  dayIndex={dayIndex}
                  dayPlan={dayPlan}
                  recipes={recipes}
                  constraints={dayConstraints}
                  weather={dayWeather}
                  settings={settings}
                  weekId={weekId}
                  onUpdate={handleUpdateSlot}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
