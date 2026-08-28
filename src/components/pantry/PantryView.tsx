'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Package, Plus, Trash2, Search, ChevronDown } from 'lucide-react';
import { categorizeIngredient } from '@/lib/utils';
import type { PantryItem, Recipe } from '@/types';
import { CATEGORY_ICONS as PANTRY_CAT_ICONS } from '@/lib/shoppingCategories';

const PANTRY_CAT_ORDER = [
  'Obst & Gemüse',
  'Hülsenfrüchte',
  'Getreide & Stärke',
  'Milchprodukte & Eier',
  'Haltbare Produkte',
  'Tofu & Veganes',
  'Fisch & Meeresfrüchte',
  'Fleisch & Geflügel',
  'Gewürze & Kräuter',
  'Nüsse & Samen',
  'Sonstiges',
];

export function PantryView() {
  const [items, setItems]               = useState<PantryItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [inputVal, setInputVal]         = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showSug, setShowSug]           = useState(false);
  const [matchingRecipes, setMatchingRecipes] = useState<(Recipe & { matchCount: number })[] | null>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showResults, setShowResults]   = useState(true);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [duplicateHint, setDuplicateHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const groupedItems = useMemo(() => {
    const map = new Map<string, PantryItem[]>();
    for (const item of items) {
      const cat = categorizeIngredient(item.name);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    // Sort categories by PANTRY_CAT_ORDER
    const sorted = new Map<string, PantryItem[]>();
    for (const cat of PANTRY_CAT_ORDER) {
      if (map.has(cat)) sorted.set(cat, map.get(cat)!);
    }
    // Remaining categories not in the order list
    map.forEach((catItems, cat) => {
      if (!sorted.has(cat)) sorted.set(cat, catItems);
    });
    return sorted;
  }, [items]);

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  useEffect(() => {
    loadItems();
    loadIngredients();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pantry');
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  };

  const loadIngredients = async () => {
    try {
      const res = await fetch('/api/recipes');
      if (!res.ok) return;
      const recipes: Recipe[] = await res.json();
      const names = Array.from(new Set(
        recipes.flatMap((r) => r.ingredients.map((i) => i.name))
      )).sort((a, b) => a.localeCompare(b, 'de'));
      setAllIngredients(names);
    } catch {}
  };

  const handleInput = (val: string) => {
    setDuplicateHint(null);
    setInputVal(val);
    if (val.trim().length >= 2) {
      const lower = val.toLowerCase();
      const matched = allIngredients
        .filter((n) => n.toLowerCase().startsWith(lower))
        .slice(0, 6);
      setSuggestions(matched);
      setShowSug(matched.length > 0);
    } else {
      setShowSug(false);
    }
  };

  const addItem = async () => {
    if (!inputVal.trim()) return;
    const name = inputVal.trim();
    const duplicate = items.some(i => i.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { setDuplicateHint(name); return; }
    const tempId = `tmp-${Date.now()}`;
    const tempItem: PantryItem = { id: tempId, name, addedAt: new Date().toISOString() };
    setItems((prev) => [...prev, tempItem]);
    setInputVal('');
    setShowSug(false);
    inputRef.current?.focus();

    const res = await fetch('/api/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { item } = await res.json() as { item: PantryItem };
      setItems((prev) => prev.map((i) => i.id === tempId ? item : i));
    } else {
      setItems((prev) => prev.filter((i) => i.id !== tempId));
    }
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch('/api/pantry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const handleToggleWantToUse = async (id: string, val: boolean) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, wantToUse: val } : i));
    setMatchingRecipes(null); // Reset results wenn Auswahl ändert
    await fetch('/api/pantry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, wantToUse: val }),
    });
  };

  const handleFindRecipes = async () => {
    const checkedNames = items.filter(i => i.wantToUse).map(i => i.name.toLowerCase());
    if (!checkedNames.length) return;

    setLoadingRecipes(true);
    setShowResults(true);
    try {
      const res = await fetch('/api/recipes');
      if (!res.ok) return;
      const allRecipes: Recipe[] = await res.json();

      const withCount = allRecipes
        .filter(r => !r.archived)
        .map(r => {
          const ingNames = r.ingredients.map(i => i.name.toLowerCase());
          const matchCount = checkedNames.filter(pi =>
            ingNames.some(n => n.includes(pi) || pi.includes(n))
          ).length;
          return { ...r, matchCount };
        })
        .filter(r => r.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount);

      setMatchingRecipes(withCount);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const pickSuggestion = (name: string) => {
    setInputVal(name);
    setShowSug(false);
    inputRef.current?.focus();
  };

  const wantToUseCount = items.filter(i => i.wantToUse).length;

  const cardStyle = {
    backgroundColor: '#fff9f3',
    border: '1px solid #e0d8ce',
    borderRadius: '16px',
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

  return (
    <div className="max-w-2xl space-y-4">

      {/* Header */}
      <div className="mz-view-head">
        <div>
          <h1 className="mz-view-title">Chuchichäschtli</h1>
          <p className="mz-view-sub">Lebensmittel zuhause erfassen — werden auf der Einkaufsliste markiert</p>
        </div>
      </div>

      {/* Eingabe */}
      <div className="rounded-2xl overflow-visible" style={cardStyle}>
        <div className="p-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: '#271f1a' }}>Lebensmittel erfassen</p>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Zutat eingeben (z.B. Salz, Mehl, Teigwaren)"
              value={inputVal}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  addItem();
                if (e.key === 'Escape') setShowSug(false);
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSug(true); }}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              style={{ ...inputStyle, width: '100%' }}
            />
            {showSug && (
              <div
                className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
                style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3' }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{ color: '#271f1a' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {duplicateHint && (
            <p className="text-xs -mt-1" style={{ color: '#d9543b' }}>
              «{duplicateHint}» ist bereits im Chuchichäschtli.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={addItem}
              disabled={!inputVal.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: '#d9543b', flexShrink: 0 }}
            >
              <Plus size={15} />
              Hinzufügen
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div
            className="animate-spin"
            style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'transparent', borderRadius: '50%' }}
          />
        </div>
      )}

      {/* Leer */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <Package size={32} style={{ color: 'var(--border)', margin: '0 auto 12px' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Noch nichts erfasst. Füge Lebensmittel hinzu, die du zuhause hast.
          </p>
        </div>
      )}

      {/* Liste — nach Kategorie gruppiert */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {/* Gesamt-Info */}
          <div className="px-1">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}
              {wantToUseCount > 0 && (
                <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
                  · {wantToUseCount} zum Verwerten markiert
                </span>
              )}
            </p>
          </div>

          {Array.from(groupedItems.entries()).map(([cat, catItems]) => {
            const collapsed = collapsedCats.has(cat);
            const catWantToUse = catItems.filter(i => i.wantToUse).length;
            return (
              <div key={cat} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff' }}>
                {/* Kategorie-Header */}
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: '#faf7f2', borderBottom: collapsed ? 'none' : '1px solid #f0ebe3', cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 18 }}>{PANTRY_CAT_ICONS[cat] ?? '📦'}</span>
                    <span className="text-sm font-semibold" style={{ color: '#271f1a' }}>
                      {cat}
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#efe9df', color: '#9a8c80' }}
                    >
                      {catItems.length}
                    </span>
                    {catWantToUse > 0 && (
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: '#fce8e3', color: '#d9543b', fontSize: 10 }}
                      >
                        {catWantToUse} verwerten
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={14}
                    style={{
                      color: '#9a8c80',
                      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform .2s',
                      flexShrink: 0,
                    }}
                  />
                </button>

                {/* Einträge */}
                {!collapsed && (
                  <div style={{ backgroundColor: '#fff' }}>
                    {catItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors"
                        style={{ borderBottom: idx < catItems.length - 1 ? '1px solid #f7f4ee' : undefined }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#faf7f2')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                      >
                        {/* Verwerten-Checkbox */}
                        <label
                          className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                          title="Zutaten verwerten — beeinflusst den Menüvorschlag"
                        >
                          <input
                            type="checkbox"
                            checked={!!item.wantToUse}
                            onChange={(e) => handleToggleWantToUse(item.id, e.target.checked)}
                            style={{ accentColor: '#d9543b', width: 14, height: 14, cursor: 'pointer' }}
                          />
                          <span className="text-xs" style={{ color: '#9a8c80' }}>Verwerten</span>
                        </label>

                        <span className="flex-1 text-sm font-medium truncate" style={{ color: '#271f1a' }}>
                          {item.name}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--muted)', opacity: 0.5 }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity    = '1';
                            (e.currentTarget as HTMLElement).style.color      = '#c62828';
                            (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity    = '0.5';
                            (e.currentTarget as HTMLElement).style.color      = 'var(--muted)';
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rezepte aus Vorrat */}
      {wantToUseCount > 0 && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Rezepte aus Vorrat</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {wantToUseCount} {wantToUseCount === 1 ? 'Zutat' : 'Zutaten'} zum Verwerten — passende Rezepte finden
                </p>
              </div>
              <button
                onClick={handleFindRecipes}
                disabled={loadingRecipes}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: '#d9543b' }}
              >
                <Search size={14} />
                {loadingRecipes ? 'Suche…' : 'Passende Rezepte'}
              </button>
            </div>

            {matchingRecipes !== null && (
              <div>
                <button
                  onClick={() => setShowResults(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold mb-2"
                  style={{ color: '#d9543b' }}
                >
                  <ChevronDown size={13} style={{ transform: showResults ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  {matchingRecipes.length === 0
                    ? 'Keine passenden Rezepte gefunden'
                    : `${matchingRecipes.length} Rezept${matchingRecipes.length !== 1 ? 'e' : ''} gefunden`}
                </button>

                {showResults && matchingRecipes.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {matchingRecipes.slice(0, 12).map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                        style={{ borderBottom: idx < Math.min(matchingRecipes.length, 12) - 1 ? '1px solid var(--border)' : undefined, backgroundColor: 'var(--card)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{r.name}</p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.category}</p>
                        </div>
                        <span
                          className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#fce8e3', color: '#d9543b' }}
                        >
                          {r.matchCount} {r.matchCount === 1 ? 'Zutat' : 'Zutaten'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
