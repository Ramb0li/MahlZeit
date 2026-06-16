'use client';
import { useState, useRef, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { Group } from '@/lib/groups';
import type { AppSettings, DietType, Child } from '@/types';
import { ALLERGENS, PRESET_AVERSIONS } from '@/lib/allergens-config';

/* ─── Konstanten ────────────────────────────────────────────────────────────── */

const DIET_OPTIONS: { value: DietType; label: string; desc: string }[] = [
  { value: 'fleischhaltig', label: 'Fleischhaltig', desc: 'Fleisch und Fisch sind willkommen — keine Einschränkung.' },
  { value: 'flexitarisch',  label: 'Flexitarisch',  desc: 'Überwiegend pflanzlich, höchstens ein Fleischgericht pro Woche.' },
  { value: 'pescetarisch',  label: 'Pescetarisch',  desc: 'Kein Fleisch, aber Fisch und Meeresfrüchte sind okay.' },
  { value: 'vegetarisch',   label: 'Vegetarisch',   desc: 'Kein Fleisch und kein Fisch.' },
  { value: 'vegan',         label: 'Vegan',         desc: 'Komplett pflanzlich, keine tierischen Produkte.' },
];

const SHOPPING_OPTIONS = [
  { value: 'once'  as const, label: 'Einmal pro Woche',  sub: 'Eine grosse Liste für 7 Tage'       },
  { value: 'twice' as const, label: 'Zweimal pro Woche', sub: 'Mo–Mi und Do–So getrennt'           },
  { value: 'daily' as const, label: 'Fast täglich',      sub: 'Frische, kleine Einkäufe'           },
];

interface GeoResult { name: string; admin1?: string; country?: string }

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface OnboardingWizardProps {
  currentGroupName: string;
  currentSettings:  AppSettings;
  onComplete:       (group: Group, settings: AppSettings) => void;
}

/* ─── Wizard ─────────────────────────────────────────────────────────────────── */

export function OnboardingWizard({ currentGroupName, currentSettings, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const TOTAL = 6;

  const [familyName,   setFamilyName]   = useState(currentGroupName === 'Meine Familie' ? '' : currentGroupName);
  const [location,     setLocation]     = useState(currentSettings.weather?.location ?? '');
  const [adults,       setAdults]       = useState(currentSettings.household?.adults ?? 2);
  const [childCount,   setChildCount]   = useState(currentSettings.household?.children?.length ?? 0);
  const [diet,         setDiet]         = useState<DietType>(
    (currentSettings.dietPreference && currentSettings.dietPreference !== 'alle'
      ? currentSettings.dietPreference as DietType
      : 'flexitarisch')
  );
  const [allergies,    setAllergies]    = useState<string[]>(currentSettings.allergiesAndAversions ?? []);
  const [noneSelected, setNoneSelected] = useState((currentSettings.allergiesAndAversions ?? []).length === 0);
  const [shopping,     setShopping]     = useState<'once' | 'twice' | 'daily'>('once');

  // Standort-Autocomplete (open-meteo Geocoding, gleiche Quelle wie in den Einstellungen)
  const [locSuggestions, setLocSuggestions] = useState<GeoResult[]>([]);
  const [showLocSug,     setShowLocSug]     = useState(false);
  const locDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLocSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setLocSuggestions([]); return; }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=de&format=json`);
      if (!res.ok) return;
      const data = await res.json() as { results?: GeoResult[] };
      setLocSuggestions(data.results ?? []);
      setShowLocSug(true);
    } catch { setLocSuggestions([]); }
  }, []);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const toggleAllergy = (id: string) => {
    setNoneSelected(false);
    setAllergies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectNone = () => {
    setNoneSelected(true);
    setAllergies([]);
  };

  const buildSettings = (): AppSettings => {
    const existingChildren = currentSettings.household?.children ?? [];
    let newChildren: Child[];
    if (childCount <= existingChildren.length) {
      newChildren = existingChildren.slice(0, childCount);
    } else {
      const extra: Child[] = Array.from({ length: childCount - existingChildren.length }, (_, i) => ({
        id: `child-${Date.now()}-${i}`,
        age: 8,
      }));
      newChildren = [...existingChildren, ...extra];
    }
    const weekSwitchDay = shopping === 'once' ? 1 : 0;
    return {
      ...currentSettings,
      weather:               { ...currentSettings.weather, location: location.trim() || currentSettings.weather.location },
      household:             { adults, children: newChildren },
      dietPreference:        diet,
      allergiesAndAversions: noneSelected ? [] : allergies,
      weekSwitchDay,
      onboardingDone:        true,
    };
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    try {
      const nameRes = await fetch('/api/groups/rename', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: familyName.trim() || 'Meine Familie' }),
      });
      if (!nameRes.ok) { setError((await nameRes.json()).error ?? 'Fehler'); return; }
      const groupData = await nameRes.json() as Group;

      const newSettings = buildSettings();
      const settingsRes = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: newSettings }),
      });
      if (!settingsRes.ok) { setError('Fehler beim Speichern'); return; }
      onComplete(groupData, newSettings);
    } catch {
      setError('Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const nameRes = await fetch('/api/groups/rename', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: currentGroupName }),
      });
      if (!nameRes.ok) return;
      const groupData = await nameRes.json() as Group;
      const skipSettings: AppSettings = { ...currentSettings, onboardingDone: true };
      await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: skipSettings }),
      });
      onComplete(groupData, skipSettings);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = step === 1 ? familyName.trim().length >= 2 : true;

  /* ─── Step meta ──────────────────────────────────────────────────────────── */

  const STEP_META: { title: string; sub: string }[] = [
    { title: 'Wie heisst dein Haushalt?',        sub: 'Gib deiner Gruppe einen Namen — so erkennst du sie wieder und kannst Mitglieder einladen.' },
    { title: 'In welcher Stadt kocht ihr?',      sub: 'Wir nutzen das lokale Wetter für passende Vorschläge — z.B. Eintöpfe bei Kälte, Leichtes bei Hitze.' },
    { title: 'Wie viele Personen essen mit?',    sub: 'Daraus berechnen wir die Mengen für Rezepte und Einkaufsliste. Kinder zählen wir kleiner.' },
    { title: 'Wie ernährt ihr euch?',            sub: 'Bestimmt, welche Gerichte vorgeschlagen werden. Du kannst es jederzeit ändern.' },
    { title: 'Allergien oder Abneigungen?',      sub: 'Tippe alles an, was nicht auf den Tisch soll — solche Gerichte blenden wir automatisch aus. Mehrfachauswahl möglich.' },
    { title: 'Wie oft kaufst du ein?',           sub: 'Wir gruppieren die Einkaufsliste passend zu deinem Rhythmus.' },
  ];
  const { title, sub } = STEP_META[step - 1];

  /* ─── Shared input style ─────────────────────────────────────────────────── */

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    border: '1.5px solid #e0d8ce', borderRadius: '12px',
    background: '#faf7f2', color: '#271f1a', fontSize: '15px', outline: 'none',
  };
  const activeChip: React.CSSProperties = { border: '1.5px solid #d9543b', background: 'rgba(217,84,59,0.07)', color: '#d9543b' };
  const idleChip:   React.CSSProperties = { border: '1.5px solid #e0d8ce', background: '#fff', color: '#271f1a' };

  /* ─── Stepper row ─────────────────────────────────────────────────────────── */

  const StepperRow = ({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) => (
    <div className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{ border: '1.5px solid #e0d8ce', background: '#faf7f2' }}>
      <span className="text-sm font-semibold" style={{ color: '#271f1a' }}>{label}</span>
      <div className="flex items-center gap-4">
        <button onClick={onDec} className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold" style={{ border: '1.5px solid #e0d8ce', color: '#5c5048' }}>−</button>
        <span className="text-base font-bold w-5 text-center" style={{ color: '#271f1a' }}>{value}</span>
        <button onClick={onInc} className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold" style={{ border: '1.5px solid #e0d8ce', color: '#5c5048' }}>+</button>
      </div>
    </div>
  );

  /* ─── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(39,31,26,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="flex overflow-hidden rounded-3xl shadow-2xl" style={{ width: 'min(820px,95vw)', height: 'min(580px,90vh)', background: '#fff' }}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="hidden sm:flex flex-col flex-shrink-0 p-8" style={{ width: '42%', background: '#271f1a' }}>
          {/* Logo */}
          <div className="text-base font-black tracking-tight" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
            Mahl<span style={{ color: '#d9543b' }}>Zeit</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Welcome text */}
          <h1 className="text-4xl font-black leading-tight mb-3" style={{ color: '#fff' }}>Willkommen.</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#9a8c80' }}>
            In sechs Schritten zu deinem persönlichen Menüplaner — danach plant MahlZyt deine Woche fast von allein.
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-8">
            {Array.from({ length: TOTAL }, (_, i) => {
              const n = i + 1;
              return (
                <div key={n} style={{
                  height: 8, borderRadius: 4, transition: 'all 0.25s',
                  width: n === step ? 20 : 8,
                  background: n === step ? '#d9543b' : n < step ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)',
                }} />
              );
            })}
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0" style={{ background: '#fff' }}>

          {/* Skip */}
          <div className="flex justify-end px-6 pt-4 pb-0 flex-shrink-0">
            <button onClick={handleSkip} className="text-sm transition-opacity hover:opacity-60" style={{ color: '#9a8c80' }}>
              Überspringen
            </button>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-8 py-4">

            <p className="text-xs font-bold tracking-widest mb-2" style={{ color: '#d9543b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              SCHRITT {step} VON {TOTAL}
            </p>
            <h2 className="text-2xl font-extrabold mb-1 leading-snug" style={{ color: '#271f1a' }}>{title}</h2>
            <p className="text-sm mb-6" style={{ color: '#5c5048' }}>{sub}</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#fce4ec', color: '#c62828' }}>{error}</div>
            )}

            {/* ── Step 1: Familienname ── */}
            {step === 1 && (
              <input
                type="text" autoFocus
                value={familyName} onChange={e => setFamilyName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canProceed) setStep(2); }}
                placeholder="Familie Keller"
                style={inp}
                maxLength={60}
              />
            )}

            {/* ── Step 2: Wohnort (mit Live-Vorschlägen) ── */}
            {step === 2 && (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={location}
                  onChange={e => {
                    const v = e.target.value;
                    setLocation(v);
                    if (locDebounce.current) clearTimeout(locDebounce.current);
                    if (v.trim().length >= 2) locDebounce.current = setTimeout(() => fetchLocSuggestions(v), 280);
                    else { setLocSuggestions([]); setShowLocSug(false); }
                  }}
                  onFocus={() => { if (locSuggestions.length) setShowLocSug(true); }}
                  onKeyDown={e => { if (e.key === 'Enter') { setShowLocSug(false); setStep(3); } if (e.key === 'Escape') setShowLocSug(false); }}
                  placeholder="z.B. Luzern, Zürich, Bern …"
                  style={inp}
                  autoComplete="off"
                />
                {showLocSug && locSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1.5px solid #e0d8ce', borderRadius: 12, boxShadow: '0 12px 32px rgba(39,31,26,0.14)', overflow: 'hidden', zIndex: 10 }}>
                    {locSuggestions.map((r, i) => (
                      <button
                        key={i}
                        onMouseDown={e => { e.preventDefault(); setLocation(r.name); setShowLocSug(false); setLocSuggestions([]); }}
                        className="w-full text-left px-4 py-2.5 flex flex-col transition-opacity hover:opacity-70"
                      >
                        <span className="text-sm font-semibold" style={{ color: '#271f1a' }}>{r.name}</span>
                        {(r.admin1 || r.country) && (
                          <span className="text-xs" style={{ color: '#9a8c80' }}>{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Haushalt ── */}
            {step === 3 && (
              <div className="space-y-3">
                <StepperRow label="Erwachsene" value={adults}     onDec={() => setAdults(Math.max(1, adults - 1))}         onInc={() => setAdults(Math.min(10, adults + 1))} />
                <StepperRow label="Kinder"     value={childCount} onDec={() => setChildCount(Math.max(0, childCount - 1))} onInc={() => setChildCount(Math.min(10, childCount + 1))} />
              </div>
            )}

            {/* ── Step 4: Ernährungsweise ── */}
            {step === 4 && (
              <div>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map(({ value, label }) => {
                    const active = diet === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setDiet(value)}
                        className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                        style={active ? activeChip : idleChip}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* Erklärung der gewählten Option */}
                <p className="text-sm mt-4 px-4 py-3 rounded-xl" style={{ background: '#faf7f2', color: '#5c5048', border: '1px solid #e0d8ce' }}>
                  {DIET_OPTIONS.find(o => o.value === diet)?.desc}
                </p>
              </div>
            )}

            {/* ── Step 5: Allergien & Abneigungen (gleiche Liste wie in den Einstellungen) ── */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9a8c80' }}>Allergien</p>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGENS.map(({ id, label, emoji }) => {
                      const active = allergies.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleAllergy(id)}
                          className="px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
                          style={active ? activeChip : idleChip}
                        >
                          <span style={{ marginRight: 5 }}>{emoji}</span>{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9a8c80' }}>Abneigungen</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_AVERSIONS.map((label) => {
                      const active = allergies.includes(label);
                      return (
                        <button
                          key={label}
                          onClick={() => toggleAllergy(label)}
                          className="px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
                          style={active ? activeChip : idleChip}
                        >
                          {label}
                        </button>
                      );
                    })}
                    <button
                      onClick={selectNone}
                      className="px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
                      style={noneSelected ? activeChip : idleChip}
                    >
                      Keine
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 6: Einkaufsrhythmus ── */}
            {step === 6 && (
              <div className="space-y-3">
                {SHOPPING_OPTIONS.map(({ value, label, sub: optSub }) => {
                  const active = shopping === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setShopping(value)}
                      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all"
                      style={active
                        ? { border: '1.5px solid #d9543b', background: 'rgba(217,84,59,0.05)' }
                        : { border: '1.5px solid #e0d8ce', background: '#fff' }
                      }
                    >
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `2px solid ${active ? '#d9543b' : '#e0d8ce'}` }}>
                        {active && <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#d9543b' }} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#271f1a' }}>{label}</p>
                        <p className="text-xs" style={{ color: '#9a8c80' }}>{optSub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-8 pb-7 pt-4 flex-shrink-0">
            {step > 1 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ border: '1.5px solid #e0d8ce', color: '#5c5048' }}
              >
                ‹ Zurück
              </button>
            ) : <div />}

            {step < TOTAL ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: '#d9543b' }}
              >
                Weiter ›
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: '#d9543b' }}
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Wird gespeichert…</>
                  : <><Check size={15} /> Loslegen</>
                }
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
