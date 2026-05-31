'use client';
import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Loader2, X } from 'lucide-react';
import type { Group } from '@/lib/groups';
import type { AppSettings, DietType } from '@/types';

/* ─── Daten ─────────────────────────────────────────────────────────────────── */

const ALLERGENS = [
  { id: 'gluten',       label: 'Gluten',       emoji: '🌾' },
  { id: 'weizen',       label: 'Weizen',        emoji: '🌾' },
  { id: 'laktose',      label: 'Laktose',       emoji: '🥛' },
  { id: 'milch',        label: 'Milch',         emoji: '🍼' },
  { id: 'ei',           label: 'Ei',            emoji: '🥚' },
  { id: 'fisch',        label: 'Fisch',         emoji: '🐟' },
  { id: 'schalentiere', label: 'Schalentiere',  emoji: '🦐' },
  { id: 'erdnüsse',     label: 'Erdnüsse',      emoji: '🥜' },
  { id: 'haselnüsse',   label: 'Haselnüsse',    emoji: '🌰' },
  { id: 'walnüsse',     label: 'Walnüsse',      emoji: '🌰' },
  { id: 'soja',         label: 'Soja',          emoji: '🫘' },
  { id: 'sesam',        label: 'Sesam',         emoji: '🌻' },
  { id: 'sellerie',     label: 'Sellerie',      emoji: '🥬' },
  { id: 'senf',         label: 'Senf',          emoji: '🟡' },
  { id: 'lupinen',      label: 'Lupinen',       emoji: '🌿' },
  { id: 'alkohol',      label: 'Alkohol',       emoji: '🍷' },
  { id: 'fruktose',     label: 'Fruktose',      emoji: '🍬' },
  { id: 'sorbit',       label: 'Sorbit',        emoji: '🍬' },
] as const;

const PRESET_AVERSIONS = ['Schweinefleisch', 'Fisch', 'Ersatzprodukte', 'Koriander', 'Rosenkohl', 'Pilze'];

const DIET_OPTIONS: { value: DietType | 'alle'; emoji: string; label: string; sub: string }[] = [
  { value: 'alle',          emoji: '🍽',  label: 'Alle',           sub: 'Kein Filter' },
  { value: 'fleischhaltig', emoji: '🥩',  label: 'Fleischhaltig',  sub: 'Inkl. Fleisch' },
  { value: 'flexitarisch',  emoji: '🌾',  label: 'Flexitarisch',   sub: 'Max. 1× Fleisch/Woche' },
  { value: 'pescetarisch',  emoji: '🐟',  label: 'Pescetarisch',   sub: 'Kein Fleisch' },
  { value: 'vegetarisch',   emoji: '🥗',  label: 'Vegetarisch',    sub: 'Kein Fleisch/Fisch' },
  { value: 'vegan',         emoji: '🌿',  label: 'Vegan',          sub: 'Nur pflanzlich' },
];

const DAY_OPTIONS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

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

  // Step 1
  const [familyName, setFamilyName] = useState(
    currentGroupName === 'Meine Familie' ? '' : currentGroupName
  );

  // Step 2
  const [location, setLocation] = useState(currentSettings.weather?.location ?? '');

  // Step 3
  const [adults, setAdults] = useState(currentSettings.household?.adults ?? 2);

  // Step 4
  const [diet, setDiet] = useState<DietType | 'alle'>(currentSettings.dietPreference ?? 'alle');

  // Step 5
  const [allergies, setAllergies] = useState<string[]>(currentSettings.allergiesAndAversions ?? []);

  // Step 6
  const [shoppingFreq, setShoppingFreq]   = useState<'once' | 'multi'>('once');
  const [shoppingDays, setShoppingDays]   = useState<number[]>([1]); // 1 = Montag default

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const toggleAllergy = (id: string) =>
    setAllergies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleShoppingDay = (d: number) => {
    if (shoppingFreq === 'once') {
      setShoppingDays([d]);
    } else {
      setShoppingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Gruppenname speichern
      const nameRes = await fetch('/api/groups/rename', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: (familyName.trim() || 'Meine Familie') }),
      });
      if (!nameRes.ok) {
        const d = await nameRes.json();
        setError(d.error ?? 'Fehler beim Speichern');
        return;
      }
      const groupData = await nameRes.json() as Group;

      // 2. Settings speichern (inkl. onboardingDone-Flag)
      const newSettings: AppSettings = {
        ...currentSettings,
        weather:              { ...currentSettings.weather, location: location.trim() || currentSettings.weather.location },
        household:            { ...currentSettings.household, adults },
        dietPreference:       diet,
        allergiesAndAversions: allergies,
        // 'once': gewählter Einkaufstag als Wochenwechsel-Tag
        // 'multi': bestehende Einstellung beibehalten (Woche im Planer weiter konfigurierbar)
        weekSwitchDay: shoppingFreq === 'once' ? (shoppingDays[0] ?? 1) : (currentSettings.weekSwitchDay ?? 0),
        onboardingDone:       true,
      };

      const settingsRes = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: newSettings }),
      });
      if (!settingsRes.ok) {
        setError('Fehler beim Speichern der Einstellungen');
        return;
      }

      onComplete(groupData, newSettings);
    } catch {
      setError('Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return familyName.trim().length >= 2;
    return true;
  };

  /* ─── Styles ─────────────────────────────────────────────────────────────── */

  const inputStyle = {
    border: '1.5px solid #c8d8c8',
    backgroundColor: '#f2f6f2',
    color: '#2c2420',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  } as const;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(44,36,32,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden bg-white">

        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ backgroundColor: '#4a7a4e' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Willkommen bei MahlZeit!</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#c8e0c8' }}>
              Schritt {step} / {TOTAL}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL) * 100}%`, backgroundColor: '#fff' }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
              {error}
            </div>
          )}

          {/* ── Step 1: Familienname ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: '#2c2420' }}>Wie heisst deine Familie?</h3>
                <p className="text-sm mb-4" style={{ color: '#9c8c84' }}>
                  Der Name erscheint im Menüplan und auf Einladungen an Familienmitglieder.
                </p>
              </div>
              <input
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                autoFocus
                maxLength={60}
                placeholder="z.B. Familie Muster"
                style={inputStyle}
              />
            </div>
          )}

          {/* ── Step 2: Wohnort ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: '#2c2420' }}>Wo wohnst du?</h3>
                <p className="text-sm mb-4" style={{ color: '#9c8c84' }}>
                  Der Menüplan berücksichtigt dein Wetter und macht passende Menüvorschläge — z.B. Suppen an kalten Tagen.
                </p>
              </div>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                autoFocus
                placeholder="z.B. Luzern, Schweiz"
                style={inputStyle}
              />
              <p className="text-xs" style={{ color: '#9c8c84' }}>
                Optional — kann jederzeit in den Einstellungen geändert werden.
              </p>
            </div>
          )}

          {/* ── Step 3: Portionen ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: '#2c2420' }}>Wie viele Personen kochst du für?</h3>
                <p className="text-sm mb-4" style={{ color: '#9c8c84' }}>
                  Anzahl Erwachsene im Haushalt — Rezepte werden entsprechend skaliert.
                </p>
              </div>
              <div className="flex items-center gap-5 justify-center py-4">
                <button
                  onClick={() => setAdults(Math.max(1, adults - 1))}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all"
                  style={{ border: '2px solid #e0d8ce', color: '#5a4e48' }}
                >
                  –
                </button>
                <div className="text-center">
                  <span className="text-5xl font-black" style={{ color: '#2c2420' }}>{adults}</span>
                  <p className="text-xs mt-1" style={{ color: '#9c8c84' }}>
                    {adults === 1 ? 'Person' : 'Personen'}
                  </p>
                </div>
                <button
                  onClick={() => setAdults(Math.min(10, adults + 1))}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all"
                  style={{ border: '2px solid #e0d8ce', color: '#5a4e48' }}
                >
                  +
                </button>
              </div>
              <p className="text-xs text-center" style={{ color: '#9c8c84' }}>
                Kinder kannst du später unter Einstellungen → Haushaltsgrösse erfassen.
              </p>
            </div>
          )}

          {/* ── Step 4: Ernährungsweise ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: '#2c2420' }}>Wie esst ihr?</h3>
                <p className="text-sm mb-4" style={{ color: '#9c8c84' }}>
                  Das filtert die Rezeptvorschläge und den Menüplan-Generator.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DIET_OPTIONS.map(({ value, emoji, label, sub }) => {
                  const isActive = diet === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setDiet(value)}
                      className="flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all"
                      style={isActive
                        ? { borderColor: '#4a7a4e', backgroundColor: '#e8f2e8' }
                        : { borderColor: '#e0d8ce' }
                      }
                    >
                      <span className="text-2xl">{emoji}</span>
                      <p className="text-xs font-semibold" style={{ color: isActive ? '#4a7a4e' : '#2c2420' }}>{label}</p>
                      <p className="text-[10px]" style={{ color: '#9c8c84' }}>{sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 5: Allergien & Abneigungen ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: '#2c2420' }}>Allergien & Abneigungen</h3>
                <p className="text-sm mb-4" style={{ color: '#9c8c84' }}>
                  Rezepte mit diesen Zutaten werden ausgegraut und nicht vorgeschlagen.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#5a4e48' }}>Allergene & Intoleranzen</p>
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map(({ id, label, emoji }) => {
                    const active = allergies.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleAllergy(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                        style={active
                          ? { borderColor: '#b5614a', backgroundColor: '#fce8e3', color: '#b5614a' }
                          : { borderColor: '#e0d8ce', backgroundColor: '#f7f4ee', color: '#5a4e48' }
                        }
                      >
                        <span>{emoji}</span>{label}
                        {active && <X size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#5a4e48' }}>Sonstige Abneigungen</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AVERSIONS.map(p => {
                    const id = p.toLowerCase();
                    const active = allergies.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleAllergy(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                        style={active
                          ? { borderColor: '#b5614a', backgroundColor: '#fce8e3', color: '#b5614a' }
                          : { borderColor: '#e0d8ce', backgroundColor: '#f7f4ee', color: '#5a4e48' }
                        }
                      >
                        {p}
                        {active && <X size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs" style={{ color: '#9c8c84' }}>
                Weitere Abneigungen kannst du später in den Einstellungen ergänzen.
              </p>
            </div>
          )}

          {/* ── Step 6: Einkaufsrhythmus ── */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold mb-1" style={{ color: '#2c2420' }}>Wann kaufst du ein?</h3>
                <p className="text-sm mb-4" style={{ color: '#9c8c84' }}>
                  Ab welchem Wochentag soll automatisch die nächste Woche angezeigt werden?
                </p>
              </div>

              {/* Frequenz-Auswahl */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { val: 'once' as const,  label: '1× pro Woche',    sub: 'Wochentag wählen',         emoji: '🛒' },
                  { val: 'multi' as const, label: 'Mehrmals/Woche',  sub: 'Im Planer einstellbar',    emoji: '🔄' },
                ] as const).map(({ val, label, sub, emoji }) => (
                  <button
                    key={val}
                    onClick={() => {
                      setShoppingFreq(val);
                      if (val === 'once' && shoppingDays.length > 1) setShoppingDays([shoppingDays[0] ?? 1]);
                    }}
                    className="flex flex-col items-center gap-1 p-4 rounded-2xl border-2 text-center transition-all"
                    style={shoppingFreq === val
                      ? { borderColor: '#4a7a4e', backgroundColor: '#e8f2e8' }
                      : { borderColor: '#e0d8ce' }
                    }
                  >
                    <span className="text-2xl">{emoji}</span>
                    <p className="text-xs font-semibold" style={{ color: shoppingFreq === val ? '#4a7a4e' : '#2c2420' }}>{label}</p>
                    <p className="text-[10px]" style={{ color: '#9c8c84' }}>{sub}</p>
                  </button>
                ))}
              </div>

              {/* Tagesauswahl — nur bei 1× pro Woche */}
              {shoppingFreq === 'once' && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#5a4e48' }}>
                    Ab welchem Tag beginnt deine neue Planungswoche?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map(({ value, label }) => {
                      const active = shoppingDays.includes(value);
                      return (
                        <button
                          key={value}
                          onClick={() => setShoppingDays([value])}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all"
                          style={active
                            ? { borderColor: '#4a7a4e', backgroundColor: '#e8f2e8', color: '#4a7a4e' }
                            : { borderColor: '#e0d8ce', color: '#5a4e48' }
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hinweis bei mehrmals/Woche */}
              {shoppingFreq === 'multi' && (
                <div className="px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: '#e8f2e8', color: '#2e5a32' }}>
                  <strong>Tipp:</strong> Im Menüplan kannst du unter «Einkaufslisten» die Woche auf mehrere
                  Listen aufteilen — z.B. Mo–Mi und Do–Sa.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ border: '1.5px solid #e0d8ce', color: '#5a4e48' }}
            >
              <ArrowLeft size={15} />
              Zurück
            </button>
          ) : <div />}

          {step < TOTAL ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: '#4a7a4e' }}
            >
              Weiter
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#4a7a4e' }}
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
  );
}
