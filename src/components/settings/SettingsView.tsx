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
  custom: 'Anpassen',
};

const PRESET_COLORS = [
  '#b5614a', '#c49a6c', '#5a4e48', '#2e7d32',
  '#1565c0', '#ad1457', '#4527a0', '#00695c',
];

// Shared style helpers
const sectionCard = {
  backgroundColor: '#fff9f3',
  border: '1px solid #e0d8ce',
  borderRadius: '16px',
  padding: '24px',
} as const;

const inputStyle = {
  border: '1px solid #e0d8ce',
  backgroundColor: '#f7f4ee',
  color: '#2c2420',
  borderRadius: '10px',
  padding: '7px 10px',
  fontSize: '13px',
  outline: 'none',
} as const;

interface SettingsViewProps {
  initialSettings: AppSettings;
  initialConstraints: DayConstraint[];
  onSettingsChange?: (settings: AppSettings) => void;
  onConstraintsChange?: (constraints: DayConstraint[]) => void;
}

export function SettingsView({ initialSettings, initialConstraints, onSettingsChange, onConstraintsChange }: SettingsViewProps) {
  const [settings, setSettings]     = useState<AppSettings>(initialSettings);
  const [constraints, setConstraints] = useState<DayConstraint[]>(initialConstraints);
  const [saved, setSaved]           = useState(false);

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

  const updateChild = (id: string, age: number) =>
    setSettings((s) => ({ ...s, household: { ...s.household, children: s.household.children.map((c) => (c.id === id ? { ...c, age } : c)) } }));

  const removeChild = (id: string) =>
    setSettings((s) => ({ ...s, household: { ...s.household, children: s.household.children.filter((c) => c.id !== id) } }));

  const addConstraint = () => {
    const newC: DayConstraint = { id: `c-${Date.now()}`, dayOfWeek: 1, label: 'Neues Event', color: '#b5614a', mealType: 'dinner', constraint: 'maxTime', maxTimeMinutes: 30 };
    setConstraints((prev) => [...prev, newC]);
  };

  const updateConstraint = (id: string, updates: Partial<DayConstraint>) =>
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));

  const removeConstraint = (id: string) =>
    setConstraints((prev) => prev.filter((c) => c.id !== id));

  const handleSave = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings, constraints }) });
    onSettingsChange?.(settings);
    onConstraintsChange?.(constraints);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const h2Style = { fontSize: '15px', fontWeight: 600, color: '#2c2420', marginBottom: '4px' } as const;
  const subStyle = { fontSize: '12px', color: '#9c8c84', marginBottom: '16px', display: 'block' } as const;
  const labelStyle = { fontSize: '13px', fontWeight: 500, color: '#5a4e48', display: 'block', marginBottom: '4px' } as const;

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Theme picker ───────────────────────────────────────────────────── */}
      <section style={sectionCard}>
        <h2 style={h2Style}>Design-Variante</h2>
        <span style={subStyle}>Wird nach dem Speichern sofort angewendet.</span>
        <div className="grid grid-cols-3 gap-3">
          {(Object.values(THEMES) as typeof THEMES[ThemeId][]).map((t) => {
            const isActive = (settings.theme ?? 'green') === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSettings((s) => ({ ...s, theme: t.id as ThemeId }))}
                className="flex flex-col overflow-hidden rounded-2xl border-2 transition-all"
                style={isActive ? { borderColor: '#b5614a', boxShadow: '0 4px 16px rgba(181,97,74,0.18)' } : { borderColor: '#e0d8ce' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#d4a090'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#e0d8ce'; }}
              >
                <div className="flex h-14">
                  {t.previewColors.map((color, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div
                  className="px-3 py-2 flex flex-col items-start gap-0.5"
                  style={{ backgroundColor: t.isDark ? '#1c1510' : '#fff9f3' }}
                >
                  <span className="text-sm font-bold" style={{ color: t.isDark ? '#ede5d8' : '#2c2420' }}>{t.label}</span>
                  <span className="text-[11px]" style={{ color: t.isDark ? '#9c8c84' : '#9c8c84' }}>{t.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Meal toggles ───────────────────────────────────────────────────── */}
      <section style={sectionCard}>
        <h2 style={h2Style}>Mahlzeiten im Wochenplan</h2>
        <span style={subStyle}>Klicke auf eine Mahlzeit, um sie im Wochenplaner ein- oder auszublenden.</span>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { key: 'showBreakfast' as const, emoji: '☕', label: 'Frühstück',   def: false },
              { key: 'showLunch'     as const, emoji: '🥗', label: 'Mittagessen', def: false },
              { key: 'showDinner'    as const, emoji: '🍽', label: 'Abendessen',  def: true  },
            ]
          ).map(({ key, emoji, label, def }) => {
            const isActive = settings[key] ?? def;
            return (
              <button
                key={key}
                onClick={() => setSettings((s) => ({ ...s, [key]: !isActive }))}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                style={isActive
                  ? { borderColor: '#b5614a', backgroundColor: '#f2e5e0' }
                  : { borderColor: '#e0d8ce', opacity: 0.55 }
                }
              >
                <span className="text-2xl">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: isActive ? '#b5614a' : '#2c2420' }}>{label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9c8c84' }}>{isActive ? 'Aktiv' : 'Ausgeblendet'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Diet preference ────────────────────────────────────────────────── */}
      <section style={sectionCard}>
        <h2 style={h2Style}>Ernährungsweise</h2>
        <span style={subStyle}>
          Filtert Rezeptvorschläge und den Menü-Picker — z.B. &quot;Vegetarisch&quot; blendet Fisch- und Fleischgerichte aus.
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { value: 'alle',         emoji: '🍽',  label: 'Alle Rezepte',  sub: 'Kein Filter' },
              { value: 'pescetarisch', emoji: '🐟',  label: 'Pescetarisch',  sub: 'Kein Fleisch' },
              { value: 'vegetarisch',  emoji: '🥗',  label: 'Vegetarisch',   sub: 'Kein Fisch' },
              { value: 'vegan',        emoji: '🌿',  label: 'Vegan',         sub: 'Nur pflanzlich' },
            ] as const
          ).map(({ value, emoji, label, sub }) => {
            const isActive = (settings.dietPreference ?? 'alle') === value;
            return (
              <button
                key={value}
                onClick={() => setSettings((s) => ({ ...s, dietPreference: value }))}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                style={isActive
                  ? { borderColor: '#b5614a', backgroundColor: '#f2e5e0' }
                  : { borderColor: '#e0d8ce' }
                }
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#d4a090'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#e0d8ce'; }}
              >
                <span className="text-2xl">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: isActive ? '#b5614a' : '#2c2420' }}>{label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9c8c84' }}>{sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Household ──────────────────────────────────────────────────────── */}
      <section style={sectionCard}>
        <h2 style={h2Style}>Haushaltsgrösse</h2>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm" style={{ color: '#5a4e48' }}>Erwachsene</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSettings((s) => ({ ...s, household: { ...s.household, adults: Math.max(1, s.household.adults - 1) } }))}
                className="w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors"
                style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >–</button>
              <span className="w-6 text-center font-semibold" style={{ color: '#2c2420' }}>{settings.household.adults}</span>
              <button
                onClick={() => setSettings((s) => ({ ...s, household: { ...s.household, adults: s.household.adults + 1 } }))}
                className="w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors"
                style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >+</button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm" style={{ color: '#5a4e48' }}>Kinder</label>
              <button
                onClick={addChild}
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: '#b5614a' }}
              >
                <Plus size={14} />
                Kind hinzufügen
              </button>
            </div>
            {settings.household.children.length === 0 && (
              <p className="text-xs" style={{ color: '#9c8c84' }}>Noch keine Kinder</p>
            )}
            <div className="space-y-2">
              {settings.household.children.map((child) => (
                <div key={child.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f7f4ee' }}>
                  <span className="text-sm flex-1" style={{ color: '#5a4e48' }}>Kind · {child.age} Jahre</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff9f3', color: '#9c8c84', border: '1px solid #e0d8ce' }}>
                    {portionFactor(child.age)} Portion
                  </span>
                  <input
                    type="number" min={0} max={18} value={child.age}
                    onChange={(e) => updateChild(child.id, Number(e.target.value))}
                    style={{ ...inputStyle, width: '56px', textAlign: 'center', padding: '4px 8px' }}
                  />
                  <button
                    onClick={() => removeChild(child.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#9c8c84' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2" style={{ borderTop: '1px solid #e0d8ce' }}>
            <p className="text-sm" style={{ color: '#5a4e48' }}>
              Gesamtportionen:{' '}
              <span className="font-semibold" style={{ color: '#b5614a' }}>{totalPortions()}</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Weather ────────────────────────────────────────────────────────── */}
      <section style={sectionCard}>
        <h2 style={h2Style}>Wetterintegration</h2>
        <div className="mt-4">
          <label style={labelStyle}>Standort</label>
          <input
            type="text"
            value={settings.weather.location}
            onChange={(e) => setSettings((s) => ({ ...s, weather: { ...s.weather, location: e.target.value } }))}
            placeholder="z.B. Luzern, Zürich, Bern …"
            style={{ ...inputStyle, width: '100%' }}
          />
          <p className="text-xs mt-1" style={{ color: '#9c8c84' }}>
            Wetterdaten via{' '}
            <a href="https://open-meteo.com" target="_blank" rel="noopener" className="transition-colors hover:underline" style={{ color: '#b5614a' }}>
              open-meteo.com
            </a>{' '}
            · Kostenlos, kein API-Key nötig.
          </p>
        </div>
      </section>

      {/* ── Events & Constraints ───────────────────────────────────────────── */}
      <section style={sectionCard}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ ...h2Style, marginBottom: 0 }}>Wöchentliche Events & Constraints</h2>
          <button
            onClick={addConstraint}
            className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#b5614a' }}
          >
            <Plus size={14} />
            Event hinzufügen
          </button>
        </div>
        <div className="space-y-3">
          {constraints.map((c) => (
            <div key={c.id} className="p-4 rounded-xl space-y-3" style={{ backgroundColor: '#f7f4ee' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={c.dayOfWeek}
                  onChange={(e) => updateConstraint(c.id, { dayOfWeek: Number(e.target.value) })}
                  style={{ ...inputStyle, padding: '6px 8px' }}
                >
                  {DAY_LABELS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                </select>
                <input
                  type="text" value={c.label}
                  onChange={(e) => updateConstraint(c.id, { label: e.target.value })}
                  style={{ ...inputStyle, flex: 1, minWidth: '96px', padding: '6px 8px' }}
                  placeholder="Event-Name"
                />
                <select
                  value={c.constraint}
                  onChange={(e) => updateConstraint(c.id, { constraint: e.target.value as DayConstraint['constraint'] })}
                  style={{ ...inputStyle, padding: '6px 8px' }}
                >
                  {Object.entries(CONSTRAINT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {c.constraint === 'maxTime' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" value={c.maxTimeMinutes ?? 30} min={5} max={120} step={5}
                      onChange={(e) => updateConstraint(c.id, { maxTimeMinutes: Number(e.target.value) })}
                      style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '6px 8px' }}
                    />
                    <span className="text-xs" style={{ color: '#9c8c84' }}>min</span>
                  </div>
                )}
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateConstraint(c.id, { color })}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: c.color === color ? 'scale(1.25)' : 'scale(1)',
                        outline: c.color === color ? '2px solid #9c8c84' : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => removeConstraint(c.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#9c8c84' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Aktionen (manuelle Promotionen) ───────────────────────────────── */}
      <section style={sectionCard}>
        <h2 style={h2Style}>Aktionen (manuelle Eingabe)</h2>
        <div className="mt-4">
          {(['migros', 'coop', 'lidl'] as const).map((store) => (
            <div key={store} className="mb-4">
              <label style={labelStyle} className="capitalize">{store}</label>
              <textarea
                value={settings.promotions[`manual${store.charAt(0).toUpperCase() + store.slice(1)}` as keyof typeof settings.promotions]?.join('\n') ?? ''}
                onChange={(e) => {
                  const items = e.target.value.split('\n').filter((x) => x.trim());
                  const key = `manual${store.charAt(0).toUpperCase() + store.slice(1)}` as 'manualMigros' | 'manualCoop' | 'manualLidl';
                  setSettings((s) => ({ ...s, promotions: { ...s.promotions, [key]: items } }));
                }}
                rows={2}
                placeholder="Je ein Produkt pro Zeile (z.B. Lachsfilet)"
                style={{ ...inputStyle, width: '100%', resize: 'none' }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={saved
            ? { backgroundColor: '#f2e5e0', color: '#b5614a' }
            : { backgroundColor: '#b5614a', color: '#fff' }
          }
        >
          <Save size={16} />
          {saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}
