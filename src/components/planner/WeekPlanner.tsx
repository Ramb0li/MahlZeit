'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { getWeekId, getWeekDays, nextWeek, prevWeek, formatDate } from '@/lib/utils';
import { getTheme } from '@/lib/themes';
import { DayColumn } from './DayColumn';
import type { WeekPlan, Recipe, WeatherCache, DayConstraint, AppSettings } from '@/types';

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

  const handleUpdateSlot = async (
    dayIndex: number,
    mealType: 'lunch' | 'dinner' | 'showLunch',
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
