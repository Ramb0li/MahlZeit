'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Download, RefreshCw, Tag, Plus, Trash2, RotateCcw, X, PenLine } from 'lucide-react';
import { getWeekId, nextWeek, formatAmount } from '@/lib/utils';
import type { ShoppingList } from '@/types';

// ─── Kategorien ───────────────────────────────────────────────────────────────

const RECIPE_CATEGORY_ORDER = [
  'Gemüse & Salat', 'Hülsenfrüchte', 'Getreide & Stärke', 'Milchprodukte & Eier',
  'Fisch & Meeresfrüchte', 'Tofu & Veganes', 'Haltbare Produkte', 'Nüsse & Samen',
  'Gewürze & Kräuter', 'Sonstiges',
];
const EXTRA_CATEGORIES = ['Haushalt', 'Hygiene', 'Persönliches', 'Getränke', 'Tierbedarf'];
const ALL_CATEGORIES = [...RECIPE_CATEGORY_ORDER, ...EXTRA_CATEGORIES];

const STORE_COLORS: Record<string, string> = {
  migros: 'bg-orange-100 text-orange-700',
  coop:   'bg-red-100 text-red-700',
  lidl:   'bg-yellow-100 text-yellow-700',
};

// ─── Typen ────────────────────────────────────────────────────────────────────

interface CustomItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

// ─── Komponente ──────────────────────────────────────────────────────────────

export function ShoppingListView() {
  const [weekId]        = useState(() => getWeekId(nextWeek(new Date())));
  const [list, setList]   = useState<ShoppingList>({});
  const [loading, setLoading] = useState(true);

  // Checkbox-Status (Rezept-Artikel)
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Weich gelöschte Artikel (durchgestrichen, nicht mehr benötigt)
  const [deleted, setDeleted] = useState<string[]>(
    () => readLS(`mz-del-${weekId}`, [] as string[])
  );

  // Mengen-Overrides: key = "name_unit", value = angepasste Menge
  const [overrides, setOverrides] = useState<Record<string, number>>(
    () => readLS(`mz-ov-${weekId}`, {})
  );

  // Inline-Editing
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  // Eigene Artikel — global gespeichert (nicht wochenspezifisch)
  const [custom, setCustom] = useState<CustomItem[]>(
    () => readLS('mz-custom', [] as CustomItem[])
  );

  // Add-Formular
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft]     = useState({ name: '', amount: '', unit: 'Stk', category: 'Sonstiges' });
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Persist
  useEffect(() => { localStorage.setItem(`mz-ov-${weekId}`,  JSON.stringify(overrides)); }, [overrides, weekId]);
  useEffect(() => { localStorage.setItem('mz-custom',        JSON.stringify(custom));    }, [custom]);
  useEffect(() => { localStorage.setItem(`mz-del-${weekId}`, JSON.stringify(deleted));   }, [deleted,   weekId]);

  // Auto-focus
  useEffect(() => { if (editKey)  editRef.current?.focus();  }, [editKey]);
  useEffect(() => { if (showAdd)  nameInputRef.current?.focus(); }, [showAdd]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/shopping-list?weekId=${weekId}`);
      const data = await res.json();
      setList(data);
    } finally { setLoading(false); }
  }, [weekId]);

  useEffect(() => { loadList(); }, [loadList]);

  // ─── Checkbox ──────────────────────────────────────────────────────────────
  const toggleChecked = (key: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleCustomChecked = (id: string) =>
    setCustom(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));

  // ─── Soft-Delete ───────────────────────────────────────────────────────────
  const toggleDeleted = (key: string) =>
    setDeleted(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  // ─── Mengen-Editing ────────────────────────────────────────────────────────
  const startEdit = (key: string, currentAmount: number) => {
    setEditKey(key);
    setEditVal(String(currentAmount));
  };

  const commitEdit = (key: string, originalAmount: number) => {
    const val = parseFloat(editVal.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      if (Math.abs(val - originalAmount) < 0.001) {
        resetOverride(key);
      } else {
        setOverrides(prev => ({ ...prev, [key]: val }));
      }
    }
    setEditKey(null);
  };

  const resetOverride = (key: string) =>
    setOverrides(prev => { const n = { ...prev }; delete n[key]; return n; });

  // ─── Eigene Artikel ────────────────────────────────────────────────────────
  const addCustom = () => {
    if (!draft.name.trim()) return;
    const item: CustomItem = {
      id:       `c-${Date.now()}`,
      name:     draft.name.trim(),
      amount:   draft.amount.trim(),
      unit:     draft.unit.trim(),
      category: draft.category,
      checked:  false,
    };
    setCustom(prev => [...prev, item]);
    setDraft({ name: '', amount: '', unit: 'Stk', category: 'Sonstiges' });
    setShowAdd(false);
  };

  const removeCustom = (id: string) => setCustom(prev => prev.filter(c => c.id !== id));

  // ─── PDF ───────────────────────────────────────────────────────────────────
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
        const key        = `${item.name.toLowerCase()}_${item.unit}`;
        const amount     = overrides[key] ?? item.totalAmount;
        const isChecked  = checked.has(key);
        doc.text(`${isChecked ? '☑' : '☐'}  ${formatAmount(amount, item.unit)}  ${item.name}`, 15, y);
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

  // ─── Kategorien zusammenstellen ────────────────────────────────────────────
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {checkedCount} von {totalItems} erledigt
            {modifiedCount > 0 && (
              <span className="ml-2 text-xs text-amber-500">{modifiedCount} angepasst</span>
            )}
          </p>
          {totalItems > 0 && (
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full w-48 overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all"
                style={{ width: `${totalItems ? (checkedCount / totalItems) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadList}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
            Aktualisieren
          </button>
          {totalItems > 0 && (
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:bg-brand-green-dark transition-colors"
            >
              <Download size={14} />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Laden */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-gray-300" />
        </div>
      )}

      {/* ── Produkt hinzufügen – OBEN ─────────────────────────────────────── */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <Plus size={15} className="text-brand-green" />
              Produkt hinzufügen
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700">Neues Produkt</p>
                <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
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
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Menge"
                  value={draft.amount}
                  onChange={(e) => setDraft(d => ({ ...d, amount: e.target.value }))}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                />
                <input
                  type="text"
                  placeholder="Einheit"
                  value={draft.unit}
                  onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                />
                <select
                  value={draft.category}
                  onChange={(e) => setDraft(d => ({ ...d, category: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 bg-white"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={addCustom}
                disabled={!draft.name.trim()}
                className="w-full py-2 rounded-xl text-sm font-medium bg-brand-green text-white hover:bg-brand-green-dark disabled:opacity-40 transition-colors"
              >
                Hinzufügen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leer */}
      {!loading && totalItems === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">Keine Einträge. Plane zuerst die Woche im Menüplan.</p>
        </div>
      )}

      {/* Kategorien */}
      {!loading && orderedCategories.map((category) => {
        const recipeItems = list[category] ?? [];
        const customInCat = custom.filter(c => c.category === category);
        if (!recipeItems.length && !customInCat.length) return null;

        return (
          <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
            </div>
            <div className="divide-y divide-gray-50">

              {/* ── Rezept-Artikel ── */}
              {recipeItems.map((item) => {
                const key            = `${item.name.toLowerCase()}_${item.unit}`;
                const isChecked      = checked.has(key);
                const isDeleted      = deleted.includes(key);
                const isModified     = key in overrides;
                const effectiveAmt   = overrides[key] ?? item.totalAmount;
                const isEditing      = editKey === key;
                const isFaded        = isChecked || isDeleted;

                return (
                  <div
                    key={key}
                    className={`flex items-start gap-3 px-4 py-3 group transition-colors ${
                      isDeleted  ? 'bg-gray-50/80' :
                      isChecked  ? 'bg-gray-50' :
                      isModified ? 'bg-amber-50/60' :
                      'hover:bg-gray-50'
                    } ${isModified && !isDeleted ? 'border-l-2 border-amber-400' : ''}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleChecked(key)}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isChecked ? 'bg-brand-green border-brand-green' : 'border-gray-300'
                      }`}
                    >
                      {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </button>

                    {/* Inhalt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Name */}
                        <span className={`text-sm font-medium transition-colors ${
                          isDeleted  ? 'line-through text-gray-400' :
                          isChecked  ? 'line-through text-gray-400' :
                          'text-gray-800'
                        }`}>
                          {item.name}
                        </span>

                        {/* Menge – klickbar zum Editieren */}
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={editRef}
                              type="text"
                              inputMode="decimal"
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(key, item.totalAmount)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  commitEdit(key, item.totalAmount);
                                if (e.key === 'Escape') setEditKey(null);
                              }}
                              className="w-20 px-2 py-0.5 text-sm border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                            />
                            <span className="text-xs text-gray-500">{item.unit}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!isFaded) startEdit(key, effectiveAmt); }}
                            title="Menge anpassen"
                            className={`flex items-center gap-1 text-sm rounded px-1 -mx-1 transition-colors ${
                              isFaded
                                ? 'text-gray-400 cursor-default'
                                : isModified
                                  ? 'text-amber-700 font-semibold hover:bg-amber-100'
                                  : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                            }`}
                          >
                            {isModified && !isFaded && <span className="text-amber-500 text-xs">●</span>}
                            <span className={isFaded ? 'line-through' : ''}>
                              {formatAmount(effectiveAmt, item.unit)}
                            </span>
                          </button>
                        )}

                        {/* Reset Override */}
                        {isModified && !isEditing && !isFaded && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resetOverride(key); }}
                            className="text-gray-400 hover:text-amber-600 transition-colors"
                            title={`Zurücksetzen auf ${formatAmount(item.totalAmount, item.unit)}`}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>

                      {/* Rezeptnamen & Aktionen */}
                      {!isDeleted && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.promotions.map((promo, pi) => (
                            <span
                              key={pi}
                              className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${STORE_COLORS[promo.store] ?? ''}`}
                            >
                              <Tag size={10} />
                              {promo.store.charAt(0).toUpperCase() + promo.store.slice(1)}
                              {promo.discount && ` ${promo.discount}`}
                            </span>
                          ))}
                          {item.recipeNames.length <= 2
                            ? item.recipeNames.map((name, ri) => (
                                <span key={ri} className="text-xs text-gray-400 truncate">{name}</span>
                              ))
                            : <span className="text-xs text-gray-400">{item.recipeNames.length} Rezepte</span>
                          }
                        </div>
                      )}
                    </div>

                    {/* Mülleimer – dezent, immer sichtbar, rot bei Hover/Aktivierung */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDeleted(key); }}
                      title={isDeleted ? 'Wiederherstellen' : 'Nicht benötigt'}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-all mt-0.5 ${
                        isDeleted
                          ? 'text-red-400 opacity-100 bg-red-50'
                          : 'text-red-300 opacity-40 hover:opacity-100 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {/* ── Eigene Artikel ── */}
              {customInCat.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 group transition-colors border-l-2 border-blue-200 ${
                    item.checked ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => toggleCustomChecked(item.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.checked ? 'bg-brand-green border-brand-green' : 'border-gray-300'
                    }`}
                  >
                    {item.checked && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {item.name}
                      </span>
                      {item.amount && (
                        <span className={`text-sm ${item.checked ? 'text-gray-400' : 'text-gray-600'}`}>
                          {item.amount} {item.unit}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">
                        manuell
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeCustom(item.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-red-300 opacity-40 hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
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
