'use client';
import { useState, useCallback } from 'react';
import { ShoppingCart, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ShoppingGroups, ShoppingGroup } from '@/types';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Farben für bis zu 7 Einkaufslisten */
const GROUP_COLORS = [
  { bg: '#e8f2e8', border: '#4a7a4e', text: '#2e5a32', dot: '#4a7a4e' },
  { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1', dot: '#1565c0' },
  { bg: '#fce4ec', border: '#c62828', text: '#b71c1c', dot: '#c62828' },
  { bg: '#fff3e0', border: '#e65100', text: '#bf360c', dot: '#e65100' },
  { bg: '#f3e5f5', border: '#6a1b9a', text: '#4a148c', dot: '#6a1b9a' },
  { bg: '#e0f2f1', border: '#00695c', text: '#004d40', dot: '#00695c' },
  { bg: '#fafafa', border: '#424242', text: '#212121', dot: '#424242' },
];

interface ShoppingGroupsBarProps {
  weekId:   string;
  groups:   ShoppingGroups;
  onChange: (groups: ShoppingGroups) => void;
}

export function ShoppingGroupsBar({ weekId, groups, onChange }: ShoppingGroupsBarProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (next: ShoppingGroups) => {
    setSaving(true);
    try {
      await fetch('/api/weekplan/shopping-groups', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ weekId, groups: next }),
      });
      onChange(next);
    } finally {
      setSaving(false);
    }
  }, [weekId, onChange]);

  /** Welcher Gruppe gehört Tag dayIndex (1–7)? */
  const groupForDay = (dayIndex: number): number =>
    groups.findIndex(g => g.dayIndices.includes(dayIndex));

  /** Tag zur nächsten Gruppe verschieben (rotierend); neue Gruppe anlegen falls max nicht erreicht */
  const cycleDay = async (dayIndex: number) => {
    const currentIdx = groupForDay(dayIndex);
    const nextIdx = (currentIdx + 1) % groups.length;

    const next: ShoppingGroups = groups.map((g, i) => ({
      ...g,
      dayIndices: i === nextIdx
        ? [...g.dayIndices.filter(d => d !== dayIndex), dayIndex].sort((a, b) => a - b)
        : g.dayIndices.filter(d => d !== dayIndex),
    }));
    // Leere Gruppen entfernen (ausser erste)
    const cleaned = next.filter((g, i) => i === 0 || g.dayIndices.length > 0);
    // IDs ggf. neu-nummerieren
    const renumbered: ShoppingGroups = cleaned.map((g, i) => ({ ...g, id: `sg-${i + 1}` }));
    await save(renumbered);
  };

  /** Neue Einkaufsliste hinzufügen (erster Tag ohne feste Gruppe) */
  const addGroup = async () => {
    if (groups.length >= 7) return;
    const newId = `sg-${groups.length + 1}`;
    // Letzen Tag der letzten Gruppe in die neue Gruppe verschieben
    const last = groups[groups.length - 1];
    if (!last || last.dayIndices.length <= 1) return; // nichts zu verschieben

    const movedDay = last.dayIndices[last.dayIndices.length - 1];
    const next: ShoppingGroups = [
      ...groups.map(g => ({
        ...g,
        dayIndices: g.dayIndices.filter(d => d !== movedDay),
      })),
      { id: newId, dayIndices: [movedDay] },
    ].filter(g => g.dayIndices.length > 0 || g.id === 'sg-1');
    await save(next);
  };

  /** Gruppe auflösen: alle Tage zurück zur ersten Gruppe */
  const removeGroup = async (groupIdx: number) => {
    if (groupIdx === 0) return;
    const daysToMerge = groups[groupIdx].dayIndices;
    const next: ShoppingGroups = groups
      .map((g, i) => {
        if (i === 0) return { ...g, dayIndices: [...g.dayIndices, ...daysToMerge].sort((a, b) => a - b) };
        if (i === groupIdx) return null;
        return g;
      })
      .filter(Boolean) as ShoppingGroups;
    const renumbered: ShoppingGroups = next.map((g, i) => ({ ...g, id: `sg-${i + 1}` }));
    await save(renumbered);
  };

  return (
    <div className="mb-3 rounded-2xl overflow-hidden border" style={{ borderColor: '#e0d8ce', backgroundColor: '#fff9f3' }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
        style={{ backgroundColor: open ? '#f7f4ee' : '#fff9f3' }}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={14} style={{ color: '#4a7a4e' }} />
          <span className="text-xs font-semibold" style={{ color: '#2c2420' }}>
            Einkaufslisten
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: '#e8f2e8', color: '#4a7a4e' }}>
            {groups.length} {groups.length === 1 ? 'Liste' : 'Listen'}
          </span>
          {saving && <span className="text-[10px]" style={{ color: '#9c8c84' }}>Speichert…</span>}
        </div>
        {open ? <ChevronUp size={14} style={{ color: '#9c8c84' }} /> : <ChevronDown size={14} style={{ color: '#9c8c84' }} />}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 space-y-3" style={{ borderTop: '1px solid #f0ebe3' }}>
          {/* Hinweis */}
          <p className="text-[11px]" style={{ color: '#9c8c84' }}>
            Tippe auf einen Tag um ihn zur nächsten Einkaufsliste zu verschieben.
          </p>

          {/* Gruppen-Übersicht */}
          <div className="flex flex-wrap gap-2">
            {groups.map((g, gi) => {
              const colors = GROUP_COLORS[gi % GROUP_COLORS.length];
              return (
                <div key={g.id} className="flex items-center gap-1 px-2 py-1 rounded-xl border text-xs font-semibold"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors.dot }} />
                  Einkaufsliste {gi + 1}
                  {gi > 0 && (
                    <button
                      onClick={() => removeGroup(gi)}
                      className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                      title="Liste auflösen"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
            {groups.length < 7 && (() => {
              const lastGroup = groups[groups.length - 1];
              const canAdd = lastGroup && lastGroup.dayIndices.length > 1;
              return (
                <button
                  onClick={addGroup}
                  disabled={!canAdd}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl border text-xs font-semibold transition-opacity"
                  style={{
                    borderColor: '#e0d8ce',
                    color: canAdd ? '#9c8c84' : '#c8c0b8',
                    backgroundColor: '#f7f4ee',
                    opacity: canAdd ? 1 : 0.5,
                    cursor: canAdd ? 'pointer' : 'not-allowed',
                  }}
                  title={canAdd ? 'Neue Einkaufsliste erstellen' : 'Alle Listen haben nur noch 1 Tag — erst Tage umverteilen'}
                >
                  <Plus size={10} />
                  Neue Liste
                </button>
              );
            })()}
          </div>

          {/* Tages-Chips */}
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, i) => {
              const dayIndex = i + 1;
              const gi = groupForDay(dayIndex);
              const colors = gi >= 0 ? GROUP_COLORS[gi % GROUP_COLORS.length] : GROUP_COLORS[0];
              return (
                <button
                  key={dayIndex}
                  onClick={() => cycleDay(dayIndex)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  title={gi >= 0 ? `Einkaufsliste ${gi + 1} → klicken zum Verschieben` : ''}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
