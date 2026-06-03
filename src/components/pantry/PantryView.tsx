'use client';
import { useState, useEffect, useRef } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import type { PantryItem, Recipe } from '@/types';

export function PantryView() {
  const [items, setItems]               = useState<PantryItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [inputVal, setInputVal]         = useState('');
  const [inputAmount, setInputAmount]   = useState('');
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showSug, setShowSug]           = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const name   = inputVal.trim();
    const amount = inputAmount.trim() || undefined;
    // Optimistic insert
    const tempId   = `tmp-${Date.now()}`;
    const tempItem: PantryItem = { id: tempId, name, amount, addedAt: new Date().toISOString() };
    setItems((prev) => [...prev, tempItem]);
    setInputVal('');
    setInputAmount('');
    setShowSug(false);
    inputRef.current?.focus();

    const res = await fetch('/api/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, amount }),
    });
    if (res.ok) {
      const { item } = await res.json() as { item: PantryItem };
      setItems((prev) => prev.map((i) => i.id === tempId ? item : i));
    } else {
      setItems((prev) => prev.filter((i) => i.id !== tempId));
    }
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id)); // optimistic
    await fetch('/api/pantry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const pickSuggestion = (name: string) => {
    setInputVal(name);
    setShowSug(false);
    inputRef.current?.focus();
  };

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
          <p className="mz-view-sub">Lebensmittel, die du zuhause hast — werden auf der Einkaufsliste markiert</p>
        </div>
      </div>

      {/* Eingabe */}
      <div className="rounded-2xl overflow-visible" style={{ backgroundColor: '#fff9f3', border: '1px solid #e0d8ce' }}>
        <div className="p-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: '#2c2420' }}>Lebensmittel erfassen</p>

          {/* Textfeld mit Autocomplete */}
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
                style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff' }}
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{ color: '#2c2420' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Menge (z.B. 500g, 1 Packung)"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={addItem}
              disabled={!inputVal.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: '#4a7a4e', flexShrink: 0 }}
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
            style={{ width: 24, height: 24, border: '2px solid #d0c8be', borderTopColor: 'transparent', borderRadius: '50%' }}
          />
        </div>
      )}

      {/* Leer */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <Package size={32} style={{ color: '#d0c8be', margin: '0 auto 12px' }} />
          <p className="text-sm" style={{ color: '#9c8c84' }}>
            Noch nichts erfasst. Füge Lebensmittel hinzu, die du zuhause hast.
          </p>
        </div>
      )}

      {/* Liste */}
      {!loading && items.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e0d8ce' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: '#f0ebe3', backgroundColor: '#fff9f3' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9c8c84' }}>
              {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}
            </p>
          </div>
          <div>
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                style={{ borderBottom: idx < items.length - 1 ? '1px solid #f0ebe3' : undefined }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: '#2c2420' }}>
                    {item.name}
                  </span>
                  {item.amount && (
                    <span className="text-sm ml-2" style={{ color: '#9c8c84' }}>
                      {item.amount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                  style={{ color: '#d0c8be', opacity: 0.5 }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity    = '1';
                    (e.currentTarget as HTMLElement).style.color      = '#c62828';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity    = '0.5';
                    (e.currentTarget as HTMLElement).style.color      = '#d0c8be';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
