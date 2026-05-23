'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Download, RefreshCw, Tag, Plus, Trash2, RotateCcw, X } from 'lucide-react';
import { getWeekId, nextWeek, formatAmount } from '@/lib/utils';
import type { ShoppingList } from '@/types';

// ─── Kategorien ───────────────────────────────────────────────────────────────

const RECIPE_CATEGORY_ORDER = [
  'Gemüse & Salat', 'Hülsenfrüchte', 'Getreide & Stärke', 'Milchprodukte & Eier',
  'Fisch & Meeresfrüchte', 'Tofu & Veganes', 'Haltbare Produkte', 'Nüsse & Samen',
  'Gewürze & Kräuter', 'Sonstiges',
];
const EXTRA_CATEGORIES = ['Haushalt', 'Hygiene', 'Persönliches', 'Getränke', 'Tierbedarf'];
const ALL_CATEGORIES   = [...RECIPE_CATEGORY_ORDER, ...EXTRA_CATEGORIES];

// Store promo badge colours — kept distinct for brand identity
const STORE_COLORS: Record<string, { bg: string; color: string }> = {
  migros: { bg: '#fff3e0', color: '#e65100' },
  coop:   { bg: '#fce4ec', color: '#c62828' },
  lidl:   { bg: '#fffde7', color: '#f57f17' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShoppingListView() {
  const [weekId]  = useState(() => getWeekId(nextWeek(new Date())));
  const [list, setList]       = useState<ShoppingList>({});
  const [loading, setLoading] = useState(true);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<string[]>(() => readLS(`mz-del-${weekId}`, [] as string[]));
  const [overrides, setOverrides] = useState<Record<string, number>>(() => readLS(`mz-ov-${weekId}`, {}));

  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const [custom, setCustom] = useState<CustomItem[]>(() => readLS('mz-custom', [] as CustomItem[]));
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: '', amount: '', unit: 'Stk', category: 'Sonstiges' });
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(`mz-ov-${weekId}`,  JSON.stringify(overrides)); }, [overrides, weekId]);
  useEffect(() => { localStorage.setItem('mz-custom',        JSON.stringify(custom));    }, [custom]);
  useEffect(() => { localStorage.setItem(`mz-del-${weekId}`, JSON.stringify(deleted));   }, [deleted, weekId]);
  useEffect(() => { if (editKey) editRef.current?.focus(); }, [editKey]);
  useEffect(() => { if (showAdd) nameInputRef.current?.focus(); }, [showAdd]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/shopping-list?weekId=${weekId}`);
      const data = await res.json();
      setList(data);
    } finally { setLoading(false); }
  }, [weekId]);

  useEffect(() => { loadList(); }, [loadList]);

  const toggleChecked = (key: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleCustomChecked = (id: string) =>
    setCustom(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));

  const toggleDeleted = (key: string) =>
    setDeleted(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const startEdit = (key: string, currentAmount: number) => {
    setEditKey(key);
    setEditVal(String(currentAmount));
  };

  const commitEdit = (key: string, originalAmount: number) => {
    const val = parseFloat(editVal.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      if (Math.abs(val - originalAmount) < 0.001) resetOverride(key);
      else setOverrides(prev => ({ ...prev, [key]: val }));
    }
    setEditKey(null);
  };

  const resetOverride = (key: string) =>
    setOverrides(prev => { const n = { ...prev }; delete n[key]; return n; });

  const addCustom = () => {
    if (!draft.name.trim()) return;
    const item: CustomItem = { id: `c-${Date.now()}`, name: draft.name.trim(), amount: draft.amount.trim(), unit: draft.unit.trim(), category: draft.category, checked: false };
    setCustom(prev => [...prev, item]);
    setDraft({ name: '', amount: '', unit: 'Stk', category: 'Sonstiges' });
    setShowAdd(false);
  };

  const removeCustom = (id: string) => setCustom(prev => prev.filter(c => c.id !== id));

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('Einkaufsliste – MahlZeitPlaner', 15, 20);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`KW ${weekId.split('-W')[1]} · ${new Date().toLocaleDateString('de-CH')}`, 15, 28);
    let y = 38;
    const ordered = buildOrderedCategories();
    for (const cat of ordered) {
      const recipeItems = (list[cat] ?? []).filter(item => !deleted.includes(`${item.name.toLowerCase()}_${item.unit}`));
      const customInCat = custom.filter(c => c.category === cat);
      if (!recipeItems.length && !customInCat.length) continue;
      doc.setFontSize(12); doc.setTextColor(40); doc.setFont('helvetica', 'bold');
      doc.text(cat, 15, y); y += 7;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
      for (const item of recipeItems) {
        const key = `${item.name.toLowerCase()}_${item.unit}`;
        const amount = overrides[key] ?? item.totalAmount;
        doc.text(`${checked.has(key) ? '☑' : '☐'}  ${formatAmount(amount, item.unit)}  ${item.name}`, 15, y);
        y += 6; if (y > 270) { doc.addPage(); y = 20; }
      }
      for (const c of customInCat) {
        const label = c.amount ? `${c.amount} ${c.unit}  ${c.name}` : c.name;
        doc.text(`${c.checked ? '☑' : '☐'}  ${label}`, 15, y);
        y += 6; if (y > 270) { doc.addPage(); y = 20; }
      }
      y += 4;
    }
    doc.save(`einkaufsliste-kw${weekId.split('-W')[1]}.pdf`);
  };

  const buildOrderedCategories = () => {
    const recipeCatKeys = Object.keys(list).filter(k => list[k]?.length);
    const customCatKeys = custom.map(c => c.category);
    const hasCategory   = (c: string) => recipeCatKeys.includes(c) || customCatKeys.includes(c);
    const all = [
      ...RECIPE_CATEGORY_ORDER.filter(hasCategory),
      ...EXTRA_CATEGORIES.filter(hasCategory),
      ...recipeCatKeys.filter(c => !ALL_CATEGORIES.includes(c)),
      ...customCatKeys.filter(c => !ALL_CATEGORIES.includes(c)),
    ];
    return all.filter((c, i) => all.indexOf(c) === i);
  };

  const orderedCategories = buildOrderedCategories();
  const totalItems   = Object.values(list).reduce((s, a) => s + a.length, 0) + custom.length;
  const checkedCount = checked.size + custom.filter(c => c.checked).length;
  const modifiedCount = Object.keys(overrides).length;

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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: '#9c8c84' }}>
            {checkedCount} von {totalItems} erledigt
            {modifiedCount > 0 && (
              <span className="ml-2 text-xs" style={{ color: '#c49a6c' }}>{modifiedCount} angepasst</span>
            )}
          </p>
          {totalItems > 0 && (
            <div className="mt-1.5 h-1.5 rounded-full w-48 overflow-hidden" style={{ backgroundColor: '#e8dfd3' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${totalItems ? (checkedCount / totalItems) * 100 : 0}%`, backgroundColor: '#b5614a' }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadList}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ border: '1px solid #e0d8ce', color: '#5a4e48', backgroundColor: '#fff9f3' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f7f4ee')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff9f3')}
          >
            <RefreshCw size={14} />
            Aktualisieren
          </button>
          {totalItems > 0 && (
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#b5614a' }}
            >
              <Download size={14} />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin" style={{ color: '#d0c8be' }} />
        </div>
      )}

      {/* Add product */}
      {!loading && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff9f3', border: '1px solid #e0d8ce' }}>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
              style={{ color: '#9c8c84' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee'; (e.currentTarget as HTMLElement).style.color = '#5a4e48'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
            >
              <Plus size={15} style={{ color: '#b5614a' }} />
              Produkt hinzufügen
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold" style={{ color: '#2c2420' }}>Neues Produkt</p>
                <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg" style={{ color: '#9c8c84' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={15} />
                </button>
              </div>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Name (z.B. Waschmittel)"
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                style={{ ...inputStyle, width: '100%' }}
              />
              <div className="flex gap-2">
                <input
                  type="text" inputMode="decimal" placeholder="Menge" value={draft.amount}
                  onChange={(e) => setDraft(d => ({ ...d, amount: e.target.value }))}
                  style={{ ...inputStyle, width: '112px' }}
                />
                <input
                  type="text" placeholder="Einheit" value={draft.unit}
                  onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
                  style={{ ...inputStyle, width: '112px' }}
                />
                <select
                  value={draft.category}
                  onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))}
                  style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                >
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={addCustom}
                disabled={!draft.name.trim()}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#b5614a' }}
              >
                Hinzufügen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty */}
      {!loading && totalItems === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#9c8c84' }}>Keine Einträge. Plane zuerst die Woche im Menüplan.</p>
        </div>
      )}

      {/* Categories */}
      {!loading && orderedCategories.map((category) => {
        const recipeItems = list[category] ?? [];
        const customInCat = custom.filter(c => c.category === category);
        if (!recipeItems.length && !customInCat.length) return null;

        return (
          <div key={category} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff9f3', border: '1px solid #e0d8ce' }}>
            {/* Category header */}
            <div className="px-4 py-2.5" style={{ backgroundColor: '#efe9df', borderBottom: '1px solid #e0d8ce' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#5a4e48' }}>{category}</h3>
            </div>
            <div>

              {/* Recipe items */}
              {recipeItems.map((item) => {
                const key          = `${item.name.toLowerCase()}_${item.unit}`;
                const isChecked    = checked.has(key);
                const isDeleted    = deleted.includes(key);
                const isModified   = key in overrides;
                const effectiveAmt = overrides[key] ?? item.totalAmount;
                const isEditing    = editKey === key;
                const isFaded      = isChecked || isDeleted;

                return (
                  <div
                    key={key}
                    className="flex items-start gap-3 px-4 py-3 transition-colors"
                    style={{
                      backgroundColor: isDeleted ? '#f7f4ee' : isChecked ? '#f7f4ee' : isModified ? '#fdfaf5' : 'transparent',
                      borderLeft: isModified && !isDeleted ? '2.5px solid #c49a6c' : 'none',
                      borderBottom: '1px solid #f0ebe3',
                    }}
                    onMouseEnter={e => { if (!isDeleted && !isChecked && !isModified) (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee'; }}
                    onMouseLeave={e => { if (!isDeleted && !isChecked && !isModified) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleChecked(key)}
                      className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                      style={isChecked
                        ? { backgroundColor: '#b5614a', border: '2px solid #b5614a' }
                        : { border: '2px solid #d0c8be', backgroundColor: 'transparent' }
                      }
                    >
                      {isChecked && <Check size={11} color="#fff" strokeWidth={3} />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Name */}
                        <span
                          className="text-sm font-medium transition-colors"
                          style={isFaded ? { textDecoration: 'line-through', color: '#9c8c84' } : { color: '#2c2420' }}
                        >
                          {item.name}
                        </span>

                        {/* Amount — editable */}
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={editRef}
                              type="text" inputMode="decimal" value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(key, item.totalAmount)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  commitEdit(key, item.totalAmount);
                                if (e.key === 'Escape') setEditKey(null);
                              }}
                              className="w-20 px-2 py-0.5 text-sm rounded-lg focus:outline-none"
                              style={{ border: '1px solid #c49a6c', backgroundColor: '#fff9f3', color: '#2c2420' }}
                            />
                            <span className="text-xs" style={{ color: '#9c8c84' }}>{item.unit}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!isFaded) startEdit(key, effectiveAmt); }}
                            title="Menge anpassen"
                            className="flex items-center gap-1 text-sm rounded px-1 -mx-1 transition-colors"
                            style={isFaded
                              ? { color: '#9c8c84', cursor: 'default' }
                              : isModified
                              ? { color: '#c49a6c', fontWeight: 600, cursor: 'pointer' }
                              : { color: '#5a4e48', cursor: 'pointer' }
                            }
                          >
                            {isModified && !isFaded && <span style={{ color: '#c49a6c', fontSize: '10px' }}>●</span>}
                            <span style={isFaded ? { textDecoration: 'line-through' } : {}}>
                              {formatAmount(effectiveAmt, item.unit)}
                            </span>
                          </button>
                        )}

                        {/* Reset override */}
                        {isModified && !isEditing && !isFaded && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resetOverride(key); }}
                            style={{ color: '#9c8c84' }}
                            title={`Zurücksetzen auf ${formatAmount(item.totalAmount, item.unit)}`}
                            onMouseEnter={e => (e.currentTarget.style.color = '#c49a6c')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9c8c84')}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>

                      {/* Promo + recipe names */}
                      {!isDeleted && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.promotions.map((promo, pi) => {
                            const sc = STORE_COLORS[promo.store] ?? { bg: '#efe9df', color: '#5a4e48' };
                            return (
                              <span
                                key={pi}
                                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: sc.bg, color: sc.color }}
                              >
                                <Tag size={10} />
                                {promo.store.charAt(0).toUpperCase() + promo.store.slice(1)}
                                {promo.discount && ` ${promo.discount}`}
                              </span>
                            );
                          })}
                          {item.recipeNames.length <= 2
                            ? item.recipeNames.map((name, ri) => (
                                <span key={ri} className="text-xs truncate" style={{ color: '#9c8c84' }}>{name}</span>
                              ))
                            : <span className="text-xs" style={{ color: '#9c8c84' }}>{item.recipeNames.length} Rezepte</span>
                          }
                        </div>
                      )}
                    </div>

                    {/* Soft-delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDeleted(key); }}
                      title={isDeleted ? 'Wiederherstellen' : 'Nicht benötigt'}
                      className="flex-shrink-0 p-1.5 rounded-lg transition-all mt-0.5"
                      style={isDeleted
                        ? { color: '#c62828', backgroundColor: '#fce4ec', opacity: 1 }
                        : { color: '#d0c8be', opacity: 0.5 }
                      }
                      onMouseEnter={e => {
                        if (!isDeleted) {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                          (e.currentTarget as HTMLElement).style.color = '#c62828';
                          (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isDeleted) {
                          (e.currentTarget as HTMLElement).style.opacity = '0.5';
                          (e.currentTarget as HTMLElement).style.color = '#d0c8be';
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {/* Custom items */}
              {customInCat.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors"
                  style={{
                    borderLeft: '2.5px solid #d4a090',
                    borderBottom: '1px solid #f0ebe3',
                    backgroundColor: item.checked ? '#f7f4ee' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!item.checked) (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee'; }}
                  onMouseLeave={e => { if (!item.checked) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <button
                    onClick={() => toggleCustomChecked(item.id)}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                    style={item.checked
                      ? { backgroundColor: '#b5614a', border: '2px solid #b5614a' }
                      : { border: '2px solid #d0c8be', backgroundColor: 'transparent' }
                    }
                  >
                    {item.checked && <Check size={11} color="#fff" strokeWidth={3} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={item.checked ? { textDecoration: 'line-through', color: '#9c8c84' } : { color: '#2c2420' }}
                      >
                        {item.name}
                      </span>
                      {item.amount && (
                        <span className="text-sm" style={{ color: item.checked ? '#9c8c84' : '#5a4e48' }}>
                          {item.amount} {item.unit}
                        </span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: '#f2e5e0', color: '#b5614a' }}
                      >
                        manuell
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeCustom(item.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                    style={{ color: '#d0c8be', opacity: 0.5 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#c62828'; (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.color = '#d0c8be'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
