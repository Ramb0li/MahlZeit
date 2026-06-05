'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Download, RefreshCw, Plus, Trash2, RotateCcw, X, ChevronDown } from 'lucide-react';
import { getWeekId, getWeekDays, nextWeek, formatAmount } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { ShoppingList, ShoppingGroups } from '@/types';

const DAY_LABELS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const GROUP_COLORS = [
  { bg: '#e8f2e8', border: '#4a7a4e', text: '#2e5a32' },
  { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1' },
  { bg: '#fce4ec', border: '#c62828', text: '#b71c1c' },
  { bg: '#fff3e0', border: '#e65100', text: '#bf360c' },
  { bg: '#f3e5f5', border: '#6a1b9a', text: '#4a148c' },
  { bg: '#e0f2f1', border: '#00695c', text: '#004d40' },
  { bg: '#fafafa', border: '#424242', text: '#212121' },
];

/** Listenname z.B. "KW23.Mo-So" oder "KW23.Mo-Mi" */
function buildListLabel(weekId: string, dayIndices: number[]): string {
  const kw = weekId.split('-W')[1] ?? '';
  if (!dayIndices.length) return `KW${kw}`;
  const sorted = [...dayIndices].sort((a, b) => a - b);
  const first = DAY_LABELS_SHORT[(sorted[0] ?? 1) - 1] ?? '';
  const last  = DAY_LABELS_SHORT[(sorted[sorted.length - 1] ?? 7) - 1] ?? '';
  return first === last ? `KW${kw}.${first}` : `KW${kw}.${first}-${last}`;
}

// ─── Kategorie-Emojis ────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, string> = {
  'Gemüse & Salat':        '🥕',
  'Hülsenfrüchte':         '🌾',
  'Getreide & Stärke':     '🫘',
  'Milchprodukte & Eier':  '🥛',
  'Fisch & Meeresfrüchte': '🐟',
  'Tofu & Veganes':        '🫘',
  'Haltbare Produkte':     '🫙',
  'Nüsse & Samen':         '🥜',
  'Gewürze & Kräuter':     '🌿',
  'Sonstiges':             '🫧',
  'Haushalt':              '🧹',
  'Hygiene':               '🧴',
  'Persönliches':          '🪞',
  'Getränke':              '🥤',
  'Tierbedarf':            '🐾',
};

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
  // Beide Wochen verfügbar — User kann wechseln
  const todayDate     = new Date();
  const nextDate      = nextWeek(todayDate);
  const currentWeekId = getWeekId(todayDate);
  const nextWeekId    = getWeekId(nextDate);
  const [weekDate, setWeekDate] = useState(todayDate);
  const weekId   = getWeekId(weekDate);
  const weekDays = getWeekDays(weekDate);

  const [list, setList]       = useState<ShoppingList>({});
  const [loading, setLoading] = useState(true);

  // Phase 4: Mehrfach-Listen
  const [groups, setGroups]           = useState<ShoppingGroups>([{ id: 'sg-1', dayIndices: [1,2,3,4,5,6,7] }]);
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null); // null = alle

  const [checked, setChecked]   = useState<Set<string>>(new Set());
  const [deleted, setDeleted]   = useState<string[]>(() => readLS(`mz-del-${currentWeekId}`, [] as string[]));
  const [overrides, setOverrides] = useState<Record<string, number>>(() => readLS(`mz-ov-${currentWeekId}`, {}));

  // Reload per-week localStorage state whenever the selected week changes
  useEffect(() => {
    setDeleted(readLS(`mz-del-${weekId}`, [] as string[]));
    setOverrides(readLS(`mz-ov-${weekId}`, {} as Record<string, number>));
    setChecked(new Set());
  }, [weekId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const [custom, setCustom] = useState<CustomItem[]>(() => readLS('mz-custom', [] as CustomItem[]));
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: '', amount: '', unit: 'Stk', category: 'Sonstiges' });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (cat: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  useEffect(() => { localStorage.setItem(`mz-ov-${weekId}`,  JSON.stringify(overrides)); }, [overrides, weekId]);
  useEffect(() => { localStorage.setItem('mz-custom',        JSON.stringify(custom));    }, [custom]);
  useEffect(() => { localStorage.setItem(`mz-del-${weekId}`, JSON.stringify(deleted));   }, [deleted, weekId]);
  useEffect(() => { if (editKey && editRef.current) editRef.current.focus(); }, [editKey]);
  useEffect(() => { if (showAdd) nameInputRef.current?.focus(); }, [showAdd]);

  const loadList = useCallback(async (dayIndices?: number[]) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ weekId });
      if (dayIndices?.length) params.set('dayIndices', dayIndices.join(','));
      const res  = await fetch(`/api/shopping-list?${params}`);
      const data = await res.json();
      if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
        setList({});
      } else {
        setList(data);
        // Soft-Delete-Cleanup: durchgestrichene Items, die nicht mehr in der frisch
        // generierten Liste stehen (weil sich ein Menü geändert hat), entfernen — und
        // veraltete Streich-Keys können so nicht wieder auftauchen.
        const liveKeys = new Set<string>(
          Object.values(data as ShoppingList).flat().map(i => `${i.name.toLowerCase()}_${i.unit}`)
        );
        setDeleted(prev => prev.filter(k => liveKeys.has(k)));
      }
    } finally { setLoading(false); }
  }, [weekId]);

  const loadGroupsMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/shopping-list?weekId=${weekId}&meta=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.groups) setGroups(data.groups);
      }
    } catch {}
  }, [weekId]);

  useEffect(() => {
    setActiveGroupIdx(null);
    loadGroupsMeta();
    loadList();
  }, [loadList, loadGroupsMeta]);

  const handleSelectGroup = (idx: number | null) => {
    setActiveGroupIdx(idx);
    if (idx === null) {
      loadList();
    } else {
      const g = groups[idx];
      if (g) loadList(g.dayIndices);
    }
  };

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
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    const pageW = 210; const pageH = 297;
    const m = 16; const col2X = pageW / 2 + 4;
    const colW = pageW / 2 - m - 4;

    const C = {
      ink:    [ 39,  31,  26] as [number,number,number],
      ink2:   [ 92,  80,  72] as [number,number,number],
      muted:  [154, 140, 128] as [number,number,number],
      border: [224, 216, 206] as [number,number,number],
      accent: [217,  84,  59] as [number,number,number],
    };

    const INGREDIENT_CAT_COLORS: Record<string, { text: [number,number,number]; bg: [number,number,number] }> = {
      'Gemüse & Salat':        { text: [ 90, 138,  79], bg: [238, 246, 236] },
      'Hülsenfrüchte':         { text: [176, 106,  16], bg: [254, 246, 228] },
      'Getreide & Stärke':     { text: [122,  88,  24], bg: [253, 246, 228] },
      'Milchprodukte & Eier':  { text: [ 58, 122, 154], bg: [232, 243, 248] },
      'Fisch & Meeresfrüchte': { text: [ 32,  96, 160], bg: [232, 240, 252] },
      'Tofu & Veganes':        { text: [ 74, 122,  78], bg: [238, 244, 236] },
      'Haltbare Produkte':     { text: [138,  64,  32], bg: [253, 240, 232] },
      'Nüsse & Samen':         { text: [160, 112,  16], bg: [254, 252, 232] },
      'Gewürze & Kräuter':     { text: [ 70, 100,  70], bg: [240, 248, 240] },
      'Sonstiges':             { text: [106,  92,  80], bg: [244, 240, 236] },
      'Haushalt':              { text: [ 80, 100, 130], bg: [232, 240, 252] },
      'Hygiene':               { text: [130,  80, 120], bg: [248, 236, 248] },
      'Persönliches':          { text: [140,  80, 100], bg: [252, 236, 240] },
      'Getränke':              { text: [ 32,  96, 160], bg: [228, 244, 255] },
      'Tierbedarf':            { text: [140, 100,  40], bg: [252, 244, 228] },
    };
    const DEFAULT_CAT = { text: [106, 92, 80] as [number,number,number], bg: [244, 240, 236] as [number,number,number] };

    // Header — Wordmark links + KW-Block rechts + Akzentlinie
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.ink);
    doc.text('MahlZeit', m, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text('EINKAUFSLISTE', m, 18);

    // Artikel-Zusammenfassung unter dem Wordmark
    const pdfTotalItems = Object.values(list).reduce((s, a) => s + a.length, 0) + custom.length;
    const pdfCatCount   = buildOrderedCategories().length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.ink2);
    doc.text(`${pdfTotalItems} Artikel · ${pdfCatCount} Kategorien`, m, 23);

    const kw = weekId.split('-W')[1] ?? '';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.ink);
    doc.text(kw, pageW - m, 13, { align: 'right' });
    const kwWidth = doc.getTextWidth(kw);
    doc.setFontSize(8);
    doc.text('KW ', pageW - m - kwWidth - 1, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.ink2);
    const pdfDateFrom = weekDays[0] ? format(weekDays[0], 'd. MMM', { locale: de }) : '';
    const pdfDateTo   = weekDays[6] ? format(weekDays[6], 'd. MMM yyyy', { locale: de }) : '';
    doc.text(`${pdfDateFrom} – ${pdfDateTo}`, pageW - m, 18, { align: 'right' });

    doc.setFillColor(...C.accent);
    doc.rect(m, 26, pageW - 2 * m, 0.8, 'F');

    // Two-column layout
    let yL = 31; let yR = 31;
    let col = 0;

    const getY  = () => col === 0 ? yL : yR;
    const getX  = () => col === 0 ? m  : col2X;
    const advY  = (h: number) => { if (col === 0) yL += h; else yR += h; };

    const switchColOrPage = () => {
      if (col === 0 && yL > yR + 20) { col = 1; return; }
      if (col === 0) { col = 1; yR = yL; return; }
      doc.addPage();
      doc.setFillColor(...C.accent);
      doc.rect(m, 8, pageW - 2 * m, 0.8, 'F');
      col = 0; yL = 14; yR = 14;
    };

    const checkOverflow = () => {
      if (getY() > pageH - 20) switchColOrPage();
    };

    const ordered = buildOrderedCategories();
    for (const cat of ordered) {
      const recipeItems = (list[cat] ?? []).filter(item => !deleted.includes(`${item.name.toLowerCase()}_${item.unit}`));
      const customInCat = custom.filter(c => c.category === cat);
      if (!recipeItems.length && !customInCat.length) continue;

      checkOverflow();
      const x = getX();
      const y = getY();

      const catTheme = INGREDIENT_CAT_COLORS[cat] ?? DEFAULT_CAT;

      const allItems = [
        ...recipeItems.map(item => {
          const key = `${item.name.toLowerCase()}_${item.unit}`;
          const amount = overrides[key] ?? item.totalAmount;
          return { text: `${item.name}`, qty: formatAmount(amount, item.unit), done: checked.has(key) };
        }),
        ...customInCat.map(c => ({
          text: c.name,
          qty: c.amount ? `${c.amount} ${c.unit}` : '',
          done: c.checked,
        })),
      ];

      // Category header
      doc.setFillColor(...catTheme.bg);
      doc.rect(x - 2, y - 3, colW + 4, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...catTheme.text);
      doc.text(cat.toUpperCase(), x + 2, y + 2);
      doc.setFontSize(6.5);
      doc.text(String(allItems.length), x + colW, y + 2, { align: 'right' });
      advY(11);

      for (const it of allItems) {
        checkOverflow();
        const ix = getX(); const iy = getY();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(it.done ? 160 : C.ink[0], it.done ? 160 : C.ink[1], it.done ? 160 : C.ink[2]);
        // Checkbox
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.4);
        doc.rect(ix, iy - 3.5, 4, 4, 'S');
        if (it.done) {
          doc.setDrawColor(...C.accent);
          doc.line(ix + 0.5, iy - 1.5, ix + 1.5, iy - 0.5);
          doc.line(ix + 1.5, iy - 0.5, ix + 3.5, iy - 3.2);
        }
        // Name
        const nameLines = doc.splitTextToSize(it.text, colW - 24);
        doc.text(nameLines, ix + 6, iy);
        // Qty right-aligned in muted
        if (it.qty) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...C.muted);
          doc.text(it.qty, ix + colW, iy, { align: 'right' });
        }
        advY(nameLines.length * 4.5 + 1);
      }
      advY(4);
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH', { day:'numeric', month:'long', year:'numeric' })}`, m, pageH - 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.border);
    doc.text('MAHLZEIT', pageW - m, pageH - 6, { align: 'right' });

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
  // Durchgestrichene (soft-deleted) Items zählen nicht zu den "zu kaufenden" Artikeln.
  const deletedSet    = new Set(deleted);
  const totalItems    = Object.values(list).reduce(
    (s, a) => s + a.filter(i => !deletedSet.has(`${i.name.toLowerCase()}_${i.unit}`)).length, 0,
  ) + custom.length;
  const checkedCount  = Array.from(checked).filter(k => !deletedSet.has(k)).length
                      + custom.filter(c => c.checked).length;
  const kwNum         = weekId.split('-W')[1] ?? '';
  const dateFrom      = weekDays[0] ? format(weekDays[0], 'd. MMM', { locale: de }) : '';
  const dateTo        = weekDays[6] ? format(weekDays[6], 'd. MMM yyyy', { locale: de }) : '';

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
    <div className="space-y-4">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#9a8c80' }}>
            KW {kwNum}, {dateFrom} – {dateTo}
          </p>
          <h1 className="mz-view-title" style={{ marginBottom: 4 }}>Einkaufsliste</h1>
          <p className="text-sm" style={{ color: '#9a8c80' }}>
            Automatisch aus deinem Wochenplan
            {totalItems > 0 && <> &middot; <strong style={{ color: '#5a4e48' }}>{totalItems} Artikel</strong></>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { const g = activeGroupIdx !== null ? groups[activeGroupIdx] : undefined; loadList(g?.dayIndices); }}
            className="mz-btn-soft"
            title="Aktualisieren"
          >
            <RefreshCw size={14} />
          </button>
          {totalItems > 0 && (
            <button onClick={exportPDF} className="mz-btn-primary">
              <Download size={14} />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalItems > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="text-sm font-medium" style={{ color: '#5a4e48' }}>
              {checkedCount}/{totalItems} erledigt
            </span>
            <span className="text-xs" style={{ color: '#9a8c80' }}>
              {Math.round((checkedCount / totalItems) * 100)} %
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 999, backgroundColor: '#e0d8ce', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${(checkedCount / totalItems) * 100}%`,
                backgroundColor: '#d9543b',
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Week selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setWeekDate(todayDate)}
          className={`mz-chip${weekId === currentWeekId ? ' on' : ''}`}
        >
          Diese Woche
        </button>
        <button
          onClick={() => setWeekDate(nextDate)}
          className={`mz-chip${weekId === nextWeekId ? ' on' : ''}`}
        >
          Nächste Woche
        </button>
      </div>

      {/* Multi-list groups (Phase 4) */}
      {groups.length > 1 && (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#e0d8ce', backgroundColor: '#fff9f3' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: '#f0ebe3' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9a8c80' }}>
              Einkaufslisten dieser Woche
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            <button
              onClick={() => handleSelectGroup(null)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
              style={activeGroupIdx === null
                ? { borderColor: '#271f1a', backgroundColor: '#271f1a', color: '#fff' }
                : { borderColor: '#e0d8ce', color: '#5a4e48' }
              }
            >
              Alle
            </button>
            {groups.map((g, gi) => {
              const colors = GROUP_COLORS[gi % GROUP_COLORS.length];
              const label = buildListLabel(weekId, g.dayIndices);
              return (
                <button
                  key={g.id}
                  onClick={() => handleSelectGroup(gi)}
                  className="flex flex-col items-start px-3 py-2 rounded-xl text-xs border-2 transition-all"
                  style={activeGroupIdx === gi
                    ? { borderColor: colors.border, backgroundColor: colors.border, color: '#fff' }
                    : { borderColor: colors.border, backgroundColor: colors.bg, color: colors.text }
                  }
                >
                  <span className="font-semibold">Einkaufsliste {gi + 1}</span>
                  <span className="opacity-75">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
              style={{ color: '#9a8c80' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee'; (e.currentTarget as HTMLElement).style.color = '#5a4e48'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9a8c80'; }}
            >
              <Plus size={15} style={{ color: '#d9543b' }} />
              Produkt hinzufügen
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold" style={{ color: '#271f1a' }}>Neues Produkt</p>
                <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg" style={{ color: '#9a8c80' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <X size={15} />
                </button>
              </div>
              <input
                ref={nameInputRef}
                type="text" placeholder="Name (z.B. Waschmittel)" value={draft.name}
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
                onClick={addCustom} disabled={!draft.name.trim()}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#d9543b' }}
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
          <p className="text-sm" style={{ color: '#9a8c80' }}>Keine Einträge. Plane zuerst die Woche im Menüplan.</p>
        </div>
      )}

      {/* ── Category grid ──────────────────────────────────────────────── */}
      {!loading && orderedCategories.length > 0 && (
        <div className="mz-shop-grid">
          {orderedCategories.map((category) => {
            const recipeItems = list[category] ?? [];
            const customInCat = custom.filter(c => c.category === category);
            if (!recipeItems.length && !customInCat.length) return null;

            const visibleRecipeItems = recipeItems.filter(i => !deleted.includes(`${i.name.toLowerCase()}_${i.unit}`));
            const catTotal   = visibleRecipeItems.length + customInCat.length;
            const catChecked = visibleRecipeItems.filter(i => checked.has(`${i.name.toLowerCase()}_${i.unit}`)).length
                             + customInCat.filter(c => c.checked).length;
            const icon = CAT_ICONS[category] ?? '🛒';

            return (
              <div
                key={category}
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: '#fff', border: '1px solid #e0d8ce' }}
              >
                {/* Card header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
                  style={{ borderBottom: collapsed.has(category) ? 'none' : '1px solid #f0ebe3', backgroundColor: '#faf7f2' }}
                  onClick={() => toggleCollapse(category)}
                >
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span className="flex-1 text-sm font-semibold" style={{ color: '#271f1a' }}>{category}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: catChecked === catTotal && catTotal > 0 ? '#e8f5e9' : '#efe9df',
                      color: catChecked === catTotal && catTotal > 0 ? '#2e7d32' : '#9a8c80',
                    }}
                  >
                    {catChecked}/{catTotal}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      color: '#9a8c80',
                      transform: collapsed.has(category) ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform .2s',
                      flexShrink: 0,
                    }}
                  />
                </div>

                {/* Items */}
                {!collapsed.has(category) && <div>
                  {recipeItems.map((item) => {
                    const key          = `${item.name.toLowerCase()}_${item.unit}`;
                    const isChecked    = checked.has(key);
                    const isModified   = key in overrides;
                    const effectiveAmt = overrides[key] ?? item.totalAmount;
                    const isEditing    = editKey === key;
                    const isDeleted    = deleted.includes(key);
                    const isFaded      = isChecked || isDeleted;

                    return (
                      <div key={key} style={{ borderBottom: '1px solid #f7f4ee' }}>
                      <div
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isChecked ? '#f7f4ee' : 'transparent',
                        }}
                        onClick={() => toggleChecked(key)}
                        onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.backgroundColor = '#faf7f2'; }}
                        onMouseLeave={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        {/* Checkbox */}
                        <div
                          className="shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors"
                          style={isChecked
                            ? { backgroundColor: '#d9543b', border: '2px solid #d9543b' }
                            : { border: '2px solid #d0c8be', backgroundColor: 'transparent' }
                          }
                          onClick={e => e.stopPropagation()}
                        >
                          {isChecked && <Check size={9} color="#fff" strokeWidth={3} />}
                        </div>

                        {/* Name */}
                        <span
                          className="flex-1 text-sm"
                          style={isFaded
                            ? { textDecoration: 'line-through', color: '#9a8c80' }
                            : isModified
                            ? { color: '#271f1a', fontWeight: 500 }
                            : { color: '#271f1a' }
                          }
                        >
                          {item.name}
                          {item.promotions.map((promo, pi) => {
                            const sc = STORE_COLORS[promo.store] ?? { bg: '#efe9df', color: '#5a4e48' };
                            return (
                              <span
                                key={pi}
                                className="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: sc.bg, color: sc.color }}
                              >
                                {promo.store.charAt(0).toUpperCase() + promo.store.slice(1)}
                              </span>
                            );
                          })}
                        </span>

                        {/* Amount — editable */}
                        {isEditing ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              ref={editRef}
                              type="text" inputMode="decimal" value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(key, item.totalAmount)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  commitEdit(key, item.totalAmount);
                                if (e.key === 'Escape') setEditKey(null);
                              }}
                              className="w-16 px-2 py-0.5 text-xs rounded-lg focus:outline-none"
                              style={{ border: '1px solid #c49a6c', backgroundColor: '#fff9f3', color: '#271f1a' }}
                            />
                            <span className="text-xs" style={{ color: '#9a8c80' }}>{item.unit}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!isFaded) startEdit(key, effectiveAmt); }}
                            className="shrink-0 text-xs font-medium"
                            style={isFaded
                              ? { color: '#9a8c80', textDecoration: 'line-through', cursor: 'default' }
                              : isModified
                              ? { color: '#c49a6c', cursor: 'pointer' }
                              : { color: '#9a8c80', cursor: 'pointer' }
                            }
                          >
                            {formatAmount(effectiveAmt, item.unit)}
                          </button>
                        )}

                        {/* Soft-delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDeleted(key); }}
                          title={isDeleted ? 'Wiederherstellen' : 'Entfernen'}
                          className="shrink-0 p-1 rounded-lg opacity-0 hover:opacity-100 transition-all"
                          style={{ color: '#d0c8be' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.color = '#d0c8be'; }}
                        >
                          <Trash2 size={12} />
                        </button>

                        {/* Reset override */}
                        {isModified && !isEditing && !isFaded && (
                          <button
                            onClick={(e) => { e.stopPropagation(); resetOverride(key); }}
                            style={{ color: '#9a8c80' }}
                            title="Zurücksetzen"
                            onMouseEnter={e => (e.currentTarget.style.color = '#c49a6c')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9a8c80')}
                          >
                            <RotateCcw size={11} />
                          </button>
                        )}
                      </div>
                      {/* Recipe source + pantry indicator */}
                      {(item.inPantry || (item.recipeNames?.length ?? 0) > 0) && (
                        <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5" style={{ marginTop: -2 }}>
                          {item.inPantry && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                            >
                              Im Vorrat
                            </span>
                          )}
                          {(item.recipeNames?.length ?? 0) > 0 && (
                            <span className="text-xs" style={{ color: '#b0a090' }}>
                              {item.recipeNames.join(' · ')}
                            </span>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}

                  {/* Custom items in category */}
                  {customInCat.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid #f7f4ee',
                        borderLeft: '2.5px solid #d4a090',
                        backgroundColor: item.checked ? '#f7f4ee' : 'transparent',
                      }}
                      onClick={() => toggleCustomChecked(item.id)}
                    >
                      <div
                        className="shrink-0 w-4 h-4 rounded flex items-center justify-center"
                        style={item.checked
                          ? { backgroundColor: '#d9543b', border: '2px solid #d9543b' }
                          : { border: '2px solid #d0c8be' }
                        }
                      >
                        {item.checked && <Check size={9} color="#fff" strokeWidth={3} />}
                      </div>
                      <span
                        className="flex-1 text-sm"
                        style={item.checked ? { textDecoration: 'line-through', color: '#9a8c80' } : { color: '#271f1a' }}
                      >
                        {item.name}
                      </span>
                      {item.amount && (
                        <span className="text-xs shrink-0" style={{ color: '#9a8c80' }}>
                          {item.amount} {item.unit}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCustom(item.id); }}
                        className="shrink-0 p-1 rounded-lg opacity-0 hover:opacity-100 transition-all"
                        style={{ color: '#d0c8be' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.color = '#d0c8be'; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
