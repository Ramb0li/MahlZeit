'use client';
import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { THEMES } from '@/lib/themes';
import type { ThemeId } from '@/lib/themes';
import type { AppSettings, DayConstraint, Child } from '@/types';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CONSTRAINT_LABELS = {
  maxTime: 'Max. Zeit',
  mealprep: 'Mealprep',
  leftovers: 'Reste essen',
  custom: 'Anpassen',
};

const PRESET_COLORS = [
  '#4CAF50', '#8B5CF6', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#6B7280', '#EC4899',
];

interface SettingsViewProps {
  initialSettings: AppSettings;
  initialConstraints: DayConstraint[];
  onSettingsChange?: (settings: AppSettings) => void;
  onConstraintsChange?: (constraints: DayConstraint[]) => void;
}

export function SettingsView({ initialSettings, initialConstraints, onSettingsChange, onConstraintsChange }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [constraints, setConstraints] = useState<DayConstraint[]>(initialConstraints);
  const [saved, setSaved] = useState(false);

  const portionFactor = (age: number) => {
    if (age < 3) return '0.25×';
    if (age <= 6) return '0.5×';
    if (age <= 12) return '0.75×';
    return '1×';
  };

  const totalPortions = () => {
    const childPortions = settings.household.children.reduce((sum, c) => {
      const f = c.age < 3 ? 0.25 : c.age <= 6 ? 0.5 : c.age <= 12 ? 0.75 : 1;
      return sum + f;
    }, 0);
    return settings.household.adults + childPortions;
  };

  const addChild = () => {
    const newChild: Child = { id: `child-${Date.now()}`, age: 5 };
    setSettings((s) => ({ ...s, household: { ...s.household, children: [...s.household.children, newChild] } }));
  };

  const updateChild = (id: string, age: number) => {
    setSettings((s) => ({
      ...s,
      household: {
        ...s.household,
        children: s.household.children.map((c) => (c.id === id ? { ...c, age } : c)),
      },
    }));
  };

  const removeChild = (id: string) => {
    setSettings((s) => ({
      ...s,
      household: { ...s.household, children: s.household.children.filter((c) => c.id !== id) },
    }));
  };

  const addConstraint = () => {
    const newC: DayConstraint = {
      id: `c-${Date.now()}`,
      dayOfWeek: 1,
      label: 'Neues Event',
      color: '#4CAF50',
      mealType: 'dinner',
      constraint: 'maxTime',
      maxTimeMinutes: 30,
    };
    setConstraints((prev) => [...prev, newC]);
  };

  const updateConstraint = (id: string, updates: Partial<DayConstraint>) => {
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeConstraint = (id: string) => {
    setConstraints((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSave = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, constraints }),
    });
    onSettingsChange?.(settings);
    onConstraintsChange?.(constraints);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">

      {/* Theme picker */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Design-Variante</h2>
        <div className="grid grid-cols-3 gap-3">
          {(Object.values(THEMES) as typeof THEMES[ThemeId][]).map((t) => {
            const isActive = (settings.theme ?? 'green') === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSettings((s) => ({ ...s, theme: t.id as ThemeId }))}
                className={`flex flex-col overflow-hidden rounded-2xl border-2 transition-all ${
                  isActive ? 'border-gray-900 shadow-md' : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                {/* Color preview strip */}
                <div className="flex h-16">
                  {t.previewColors.map((color, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
                {/* Label */}
                <div
                  className="px-3 py-2 flex flex-col items-start gap-0.5"
                  style={{ backgroundColor: t.isDark ? '#1A1610' : '#FFFFFF' }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ color: t.isDark ? '#EAE0CE' : '#111827' }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: t.isDark ? '#A89870' : '#6B7280' }}
                  >
                    {t.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">Wird nach dem Speichern sofort angewendet.</p>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Haushaltsgrösse</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Erwachsene</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSettings((s) => ({ ...s, household: { ...s.household, adults: Math.max(1, s.household.adults - 1) } }))}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-medium"
              >–</button>
              <span className="w-6 text-center font-medium text-gray-900">{settings.household.adults}</span>
              <button
                onClick={() => setSettings((s) => ({ ...s, household: { ...s.household, adults: s.household.adults + 1 } }))}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-medium"
              >+</button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-700">Kinder</label>
              <button onClick={addChild} className="flex items-center gap-1 text-xs text-brand-green hover:text-brand-green-dark font-medium">
                <Plus size={14} />
                Kind hinzufügen
              </button>
            </div>
            {settings.household.children.length === 0 && (
              <p className="text-xs text-gray-400">Noch keine Kinder</p>
            )}
            <div className="space-y-2">
              {settings.household.children.map((child) => (
                <div key={child.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600 flex-1">Kind · {child.age} Jahre</span>
                  <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border">
                    {portionFactor(child.age)} Portion
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={18}
                    value={child.age}
                    onChange={(e) => updateChild(child.id, Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  />
                  <button onClick={() => removeChild(child.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Gesamtportionen: <span className="font-semibold text-brand-green-dark">{totalPortions()}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Wetterintegration</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
          <input
            type="text"
            value={settings.weather.location}
            onChange={(e) => setSettings((s) => ({ ...s, weather: { ...s.weather, location: e.target.value } }))}
            placeholder="z.B. Luzern, Zürich, Bern …"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
          <p className="text-xs text-gray-400 mt-1">
            Wetterdaten via{' '}
            <a href="https://open-meteo.com" target="_blank" rel="noopener" className="text-brand-green hover:underline">
              open-meteo.com
            </a>{' '}
            · Kostenlos, kein API-Key nötig.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Wöchentliche Events & Constraints</h2>
          <button onClick={addConstraint} className="flex items-center gap-1 text-xs text-brand-green hover:text-brand-green-dark font-medium">
            <Plus size={14} />
            Event hinzufügen
          </button>
        </div>
        <div className="space-y-3">
          {constraints.map((c) => (
            <div key={c.id} className="p-4 bg-gray-50 rounded-xl space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={c.dayOfWeek}
                  onChange={(e) => updateConstraint(c.id, { dayOfWeek: Number(e.target.value) })}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                >
                  {DAY_LABELS.map((d, i) => (
                    <option key={i} value={i + 1}>{d}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => updateConstraint(c.id, { label: e.target.value })}
                  className="flex-1 min-w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  placeholder="Event-Name"
                />
                <select
                  value={c.constraint}
                  onChange={(e) => updateConstraint(c.id, { constraint: e.target.value as DayConstraint['constraint'] })}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                >
                  {Object.entries(CONSTRAINT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {c.constraint === 'maxTime' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={c.maxTimeMinutes ?? 30}
                      min={5}
                      max={120}
                      step={5}
                      onChange={(e) => updateConstraint(c.id, { maxTimeMinutes: Number(e.target.value) })}
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                )}
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateConstraint(c.id, { color })}
                      className={`w-5 h-5 rounded-full transition-transform ${c.color === color ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => removeConstraint(c.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Aktionen (manuelle Eingabe)</h2>
        {(['migros', 'coop', 'lidl'] as const).map((store) => (
          <div key={store} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{store}</label>
            <textarea
              value={settings.promotions[`manual${store.charAt(0).toUpperCase() + store.slice(1)}` as keyof typeof settings.promotions]?.join('\n') ?? ''}
              onChange={(e) => {
                const items = e.target.value.split('\n').filter((x) => x.trim());
                const key = `manual${store.charAt(0).toUpperCase() + store.slice(1)}` as 'manualMigros' | 'manualCoop' | 'manualLidl';
                setSettings((s) => ({ ...s, promotions: { ...s.promotions, [key]: items } }));
              }}
              rows={2}
              placeholder="Je ein Produkt pro Zeile (z.B. Lachsfilet)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 resize-none"
            />
          </div>
        ))}
      </section>

      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-brand-green text-white hover:bg-brand-green-dark'
          }`}
        >
          <Save size={16} />
          {saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}
