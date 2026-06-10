'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { ImagePlus, X, Loader2, Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { type Recipe, type Category, type WeatherType, type Ingredient } from '@/types';

function generateId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const CHEF_MESSAGES = [
  'Unser Chefkoch liest dein Rezept ein…',
  'Die Zutaten werden abgewogen…',
  'Wir rühren die Schritte zusammen…',
  'Eine Prise Magie kommt dazu…',
  'Gleich ist angerichtet…',
];

interface ImportRecipeModalProps {
  isPremium: boolean;
  onClose: () => void;
  onImported: (recipe: Recipe) => void;
}

type Tab = 'url' | 'screenshot';

const inputStyle = {
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-2)',
  color: 'var(--ink)',
  borderRadius: '12px',
  padding: '10px 14px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
} as const;

export function ImportRecipeModal({ isPremium, onClose, onImported }: ImportRecipeModalProps) {
  const [tab, setTab]       = useState<Tab>('url');
  const [url, setUrl]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [dragging, setDragging] = useState(false);
  const [chefMsg, setChefMsg] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lustige Chefkoch-Ladetexte zyklen, solange analysiert wird
  useEffect(() => {
    if (!loading) { setChefMsg(0); return; }
    const t = setInterval(() => setChefMsg((i) => (i + 1) % CHEF_MESSAGES.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  // ── helpers ────────────────────────────────────────────────────────────────

  function buildRecipe(data: Record<string, unknown>, sourceUrl?: string): Recipe {
    // Deutsch-Schweizer Rechtschreibung: ß → ss (Sicherheitsnetz zusätzlich zum Prompt)
    const safeStr = (v: unknown, fallback = '') => (typeof v === 'string' ? v.replace(/ß/g, 'ss') : fallback);
    const safeNum = (v: unknown, fallback = 0)  => (typeof v === 'number' ? v : fallback);

    const VALID_CATS: Category[] = [
      'Snacks & Vorspeisen', 'Suppen, Eintöpfe & Currys',
      'Salate & Bowls', 'Pasta', 'Reis & Getreide', 'Kartoffelgerichte',
      'Fleisch & Geflügel', 'Fisch & Meeresfrüchte', 'Vegetarische Hauptgerichte',
      'Aufläufe & Gratins', 'Wraps & Sandwiches', 'Desserts & Süsses', 'Eigene Rezepte',
    ];
    const VALID_WEATHER: WeatherType[] = ['warm', 'kalt', 'neutral'];

    const rawMins = safeNum(data.timeMinutes, 30);
    const mins    = rawMins > 0 ? rawMins : 30;

    const rawIng = Array.isArray(data.ingredients) ? data.ingredients : [];
    const ingredients: Ingredient[] = rawIng.map((ing: unknown) => {
      const i = (typeof ing === 'object' && ing !== null) ? ing as Record<string, unknown> : {};
      const perP = safeNum(data.basePortions, 4) || 4;
      return {
        name:        safeStr(i.name, 'Unbekannte Zutat'),
        amount:      safeNum(i.amount, 1),
        unit:        safeStr(i.unit, 'Stk'),
        perPortions: perP,
      };
    });

    const cat     = safeStr(data.category);
    const weather = safeStr(data.weatherType);
    const steps   = Array.isArray(data.steps)
      ? (data.steps as unknown[]).map(s => safeStr(s)).filter(Boolean)
      : [];

    // Accept tags[] from Claude response; fallback to empty array
    const rawTags = Array.isArray(data.tags) ? (data.tags as unknown[]).map(t => safeStr(t)).filter(Boolean) : [];

    return {
      id:           generateId(),
      name:         safeStr(data.name, 'Importiertes Rezept'),
      description:  safeStr(data.description),
      category:     (VALID_CATS.includes(cat as Category) ? cat : 'Vegetarische Hauptgerichte') as Category,
      timeMinutes:  mins,
      tags:         rawTags,
      ingredients,
      weatherType:  (VALID_WEATHER.includes(weather as WeatherType) ? weather : 'neutral') as WeatherType,
      source:       safeStr(data.source) || sourceUrl || 'Import',
      basePortions: safeNum(data.basePortions, 4) || 4,
      steps:        steps.length ? steps : undefined,
    };
  }

  // ── URL import ─────────────────────────────────────────────────────────────

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/recipes/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Import');
      onImported(buildRecipe(json.recipe, url.trim()));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  // ── Screenshot import ──────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!isPremium) return;
    if (!file.type.startsWith('image/')) {
      setError('Bitte ein Bild (JPG, PNG, WEBP) hochladen.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res  = await fetch('/api/recipes/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Import');
      onImported(buildRecipe(json.recipe));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [isPremium, onImported]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(44,36,32,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--card)', maxHeight: '90dvh' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Rezept importieren</h2>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
                URL oder Screenshot — in Sekunden fertig
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 p-1 rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}>
            {([
              { id: 'url',        label: '🔗 URL',        sub: 'Kostenlos' },
              { id: 'screenshot', label: '📷 Screenshot', sub: isPremium ? 'Premium' : '🔒 Premium' },
            ] as const).map(({ id, label, sub }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setError(''); }}
                className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all"
                style={tab === id
                  ? { backgroundColor: 'var(--card)', color: 'var(--accent)' }
                  : { color: 'rgba(255,255,255,0.75)' }
                }
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[10px] mt-0.5">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading overlay text */}
          {loading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--border)' }}>
              <Loader2 size={20} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent-ink)' }}>{CHEF_MESSAGES[chefMsg]}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Einen Moment, das Rezept wird zubereitet</p>
              </div>
            </div>
          )}

          {/* ── URL tab ─────────────────────────────────────────────────── */}
          {tab === 'url' && !loading && (
            <div className="space-y-4">
              {/* Steps guide */}
              <div className="space-y-2">
                {[
                  { n: '1', text: 'Kopiere die URL einer Rezeptseite (z.B. fooby.ch, chefkoch.de, allrecipes.com).' },
                  { n: '2', text: 'Füge die URL ein und klicke auf Importieren.' },
                  { n: '3', text: 'Rezept prüfen und mit einem Klick speichern.' },
                ].map(({ n, text }) => (
                  <div key={n} className="flex gap-3 items-start">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      {n}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{text}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
                  placeholder="https://www.fooby.ch/de/rezepte/…"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleUrlImport}
                  disabled={!url.trim() || loading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 shrink-0"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                >
                  <ArrowRight size={15} />
                  Los
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['fooby.ch', 'chefkoch.de', 'allrecipes.com', 'bbcgoodfood.com', 'essen-und-trinken.de'].map(site => (
                  <span
                    key={site}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
                  >
                    {site}
                  </span>
                ))}
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}>
                  + viele mehr
                </span>
              </div>
            </div>
          )}

          {/* ── Screenshot tab ───────────────────────────────────────────── */}
          {tab === 'screenshot' && !loading && (
            <div className="space-y-4">
              {!isPremium ? (
                /* Locked state */
                <div
                  className="flex flex-col items-center text-center py-8 px-4 rounded-2xl"
                  style={{ backgroundColor: '#efe9df', border: '2px dashed #d4c4b4' }}
                >
                  <Lock size={32} style={{ color: '#c49a6c' }} className="mb-3" />
                  <p className="font-semibold text-sm" style={{ color: '#5a4e48' }}>
                    Nur für Premium-Nutzer
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#9c8c84' }}>
                    Importiere Rezepte direkt aus Instagram-Screenshots, Kochbuch-Fotos oder beliebigen Bildern.
                  </p>
                  <div className="mt-4 flex flex-col gap-1.5 text-left w-full max-w-xs">
                    {['Instagram Reels & Posts', 'Kochbuch-Fotos', 'Screenshots jeder Art'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs" style={{ color: '#9c8c84' }}>
                        <CheckCircle2 size={13} style={{ color: '#c49a6c' }} />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Upload area */
                <div className="space-y-3">
                  <div className="space-y-2">
                    {[
                      { n: '1', text: 'Zieh deinen Screenshot/Bild des Rezeptes in die Box oder mache direkt ein Foto aus deinem Rezeptbuch.' },
                      { n: '2', text: 'Unsere KI extrahiert das Rezept automatisch.' },
                    ].map(({ n, text }) => (
                      <div key={n} className="flex gap-3 items-start">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                        >
                          {n}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{text}</p>
                      </div>
                    ))}
                  </div>

                  <div
                    className="flex flex-col items-center justify-center py-10 rounded-2xl cursor-pointer transition-all"
                    style={{
                      border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-2)'}`,
                      backgroundColor: dragging ? 'var(--accent-tint)' : 'var(--bg-2)',
                    }}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={28} style={{ color: 'var(--accent)', opacity: 0.7 }} className="mb-2" />
                    <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      Bild hierher ziehen
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      oder klicken zum Auswählen · JPG, PNG, WEBP
                    </p>
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 pb-5 shrink-0">
          <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
            Zubereitungsschritte werden sinngemäss umformuliert · Quelle wird gespeichert
          </p>
        </div>
      </div>
    </div>
  );
}
