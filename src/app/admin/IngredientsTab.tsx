'use client';

/**
 * Zutaten-Übersicht im Admin-Bereich.
 *
 * Die Liste wird aus den bereits geladenen Rezepten abgeleitet und nirgends
 * gespeichert — sie ist damit immer aktuell, ohne dass es eine zweite
 * Datenhaltung gäbe, die man pflegen müsste.
 *
 * Umbenennen und Zusammenführen laufen über /api/admin/ingredients. Die Vorschau
 * dort nutzt dieselbe Funktion wie das Speichern, was angezeigt wird, passiert
 * also auch genau so.
 */

import { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Check, AlertTriangle, Layers, Copy } from 'lucide-react';
import type { Recipe } from '@/types';
import { buildIngredientIndex, type IngredientEntry, type IngredientHint } from '@/lib/ingredientIndex';

type HintFilter = 'alle' | 'schreibweise' | 'gemischte-einheit' | 'doppelt-im-rezept' | 'aehnlich';

interface RenameChange {
  recipeId: string;
  recipeName: string;
  zutaten:  { von: string; nach: string }[];
  schritte: { index: number; von: string; nach: string }[];
}

const HINT_LABEL: Record<HintFilter, string> = {
  'alle':               'Alle',
  'schreibweise':       'Schreibweise',
  'gemischte-einheit':  'Gemischte Einheiten',
  'doppelt-im-rezept':  'Doppelt im Rezept',
  'aehnlich':           'Ähnliche Namen',
};

function hintOf(entry: IngredientEntry, art: IngredientHint['art']): IngredientHint | undefined {
  return entry.hints.find(h => h.art === art);
}

/** Erster Buchstabe für die alphabetische Gliederung. Alles Nicht-Alphabetische unter #. */
function initial(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-ZÄÖÜ]/.test(c) ? c : '#';
}

export function IngredientsTab({ recipes, onSaved }: { recipes: Recipe[]; onSaved: () => void }) {
  const alle = useMemo(() => buildIngredientIndex(recipes), [recipes]);

  const [suche,      setSuche]      = useState('');
  const [hintFilter, setHintFilter] = useState<HintFilter>('alle');
  const [offen,      setOffen]      = useState<string | null>(null);
  const [markiert,   setMarkiert]   = useState<Set<string>>(new Set());

  // Umbenennen
  const [ziel,            setZiel]            = useState('');
  const [auchInSchritten, setAuchInSchritten] = useState(true);
  const [vorschau,        setVorschau]        = useState<RenameChange[] | null>(null);
  const [busy,            setBusy]            = useState(false);
  const [notiz,           setNotiz]           = useState<{ art: 'ok' | 'err'; text: string } | null>(null);

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return alle.filter(e => {
      if (s && !e.displayNames.some(n => n.toLowerCase().includes(s))) return false;
      if (hintFilter !== 'alle' && !e.hints.some(h => h.art === hintFilter)) return false;
      return true;
    });
  }, [alle, suche, hintFilter]);

  const gruppiert = useMemo(() => {
    const map = new Map<string, IngredientEntry[]>();
    for (const e of gefiltert) {
      const b = initial(e.canonical);
      const liste = map.get(b);
      if (liste) liste.push(e); else map.set(b, [e]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'de'));
  }, [gefiltert]);

  const zaehler = useMemo(() => ({
    alle: alle.length,
    'schreibweise':      alle.filter(e => hintOf(e, 'schreibweise')).length,
    'gemischte-einheit': alle.filter(e => hintOf(e, 'gemischte-einheit')).length,
    'doppelt-im-rezept': alle.filter(e => hintOf(e, 'doppelt-im-rezept')).length,
    'aehnlich':          alle.filter(e => hintOf(e, 'aehnlich')).length,
  }), [alle]);

  const markierteNamen = useMemo(
    () => alle.filter(e => markiert.has(e.key)).flatMap(e => e.displayNames),
    [alle, markiert],
  );

  const toggleMark = (key: string) =>
    setMarkiert(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  async function ladeVorschau() {
    if (!ziel.trim() || markierteNamen.length === 0) return;
    setBusy(true); setNotiz(null);
    try {
      const res = await fetch('/api/admin/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ von: markierteNamen, nach: ziel.trim(), auchInSchritten }),
      });
      const data = await res.json();
      if (!res.ok) { setNotiz({ art: 'err', text: data.error ?? 'Vorschau fehlgeschlagen.' }); return; }
      setVorschau(data.changes as RenameChange[]);
      if (data.changes.length === 0) setNotiz({ art: 'err', text: 'Keine Rezepte betroffen.' });
    } finally { setBusy(false); }
  }

  async function speichern() {
    setBusy(true); setNotiz(null);
    try {
      const res = await fetch('/api/admin/ingredients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ von: markierteNamen, nach: ziel.trim(), auchInSchritten }),
      });
      const data = await res.json();
      if (!res.ok) { setNotiz({ art: 'err', text: data.error ?? 'Speichern fehlgeschlagen.' }); return; }
      setNotiz({ art: 'ok', text: `${data.geaendert} Rezept(e) angepasst. Nicht vergessen: Export JSON und recipes:sync.` });
      setVorschau(null); setMarkiert(new Set()); setZiel('');
      onSaved();
    } finally { setBusy(false); }
  }

  const chip = (aktiv: boolean) => ({
    padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
    background: aktiv ? '#2c2420' : 'var(--card)',
    color:      aktiv ? '#fff' : 'var(--ink-2)',
    border: '1px solid var(--border)', cursor: 'pointer',
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <div className="mz-search-box" style={{ flex: 1, minWidth: 180 }}>
          <input type="text" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Zutat suchen…" />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(Object.keys(HINT_LABEL) as HintFilter[]).map(f => (
            <button key={f} onClick={() => setHintFilter(f)} style={chip(hintFilter === f)}>
              {HINT_LABEL[f]} ({zaehler[f]})
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 12 }}>
        {gefiltert.length} von {alle.length} Zutaten aus {recipes.length} Rezepten.
        Änderungen landen in der Datenbank, danach wie gehabt «Export JSON» und <code>npm run recipes:sync</code>.
      </p>

      {/* Sammelaktion */}
      {markiert.size > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16, background: 'var(--card)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {markiert.size} Zutat(en) markiert: {markierteNamen.slice(0, 6).join(', ')}{markierteNamen.length > 6 ? ' …' : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text" value={ziel} onChange={e => { setZiel(e.target.value); setVorschau(null); }}
              placeholder="Neuer Name für alle markierten"
              style={{ flex: 1, minWidth: 220, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={auchInSchritten} onChange={e => { setAuchInSchritten(e.target.checked); setVorschau(null); }} />
              auch in den Zubereitungsschritten
            </label>
            <button onClick={ladeVorschau} disabled={busy || !ziel.trim()} className="mz-btn-secondary" style={{ fontSize: 13 }}>
              {busy ? 'Lädt…' : 'Vorschau'}
            </button>
            <button onClick={() => { setMarkiert(new Set()); setVorschau(null); setZiel(''); }} style={{ ...chip(false), border: 'none' }}>
              Auswahl aufheben
            </button>
          </div>

          {vorschau && vorschau.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                {vorschau.length} Rezept(e) betroffen,
                {' '}{vorschau.reduce((n, c) => n + c.zutaten.length, 0)} Zutateneintrag/-einträge,
                {' '}{vorschau.reduce((n, c) => n + c.schritte.length, 0)} Schritt(e).
              </p>
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 12 }}>
                {vorschau.map(c => (
                  <div key={c.recipeId} style={{ marginBottom: 10 }}>
                    <strong>{c.recipeName}</strong> <span style={{ color: 'var(--ink-2)' }}>({c.recipeId})</span>
                    {c.zutaten.map((z, i) => (
                      <div key={`z${i}`} style={{ color: 'var(--ink-2)' }}>Zutat: {z.von} → {z.nach}</div>
                    ))}
                    {c.schritte.map((s, i) => (
                      <div key={`s${i}`} style={{ color: 'var(--ink-2)' }}>Schritt {s.index + 1}: … {s.nach.slice(0, 90)}…</div>
                    ))}
                  </div>
                ))}
              </div>
              <button onClick={speichern} disabled={busy} className="mz-btn-primary" style={{ marginTop: 10, fontSize: 13 }}>
                {busy ? 'Speichert…' : 'Übernehmen'}
              </button>
            </div>
          )}
        </div>
      )}

      {notiz && (
        <p style={{ fontSize: 13, marginBottom: 12, color: notiz.art === 'ok' ? '#166534' : '#991b1b' }}>{notiz.text}</p>
      )}

      {/* A-Z-Sprungleiste */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 14 }}>
        {gruppiert.map(([buchstabe]) => (
          <a key={buchstabe} href={`#zutat-${buchstabe}`}
             style={{ padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', color: 'var(--ink-2)', textDecoration: 'none' }}>
            {buchstabe}
          </a>
        ))}
      </div>

      {/* Liste */}
      {gruppiert.map(([buchstabe, eintraege]) => (
        <div key={buchstabe} id={`zutat-${buchstabe}`} style={{ marginBottom: 18, scrollMarginTop: 80 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>{buchstabe}</h3>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {eintraege.map(e => {
              const schreibweise = hintOf(e, 'schreibweise');
              const einheiten    = hintOf(e, 'gemischte-einheit');
              const doppelt      = hintOf(e, 'doppelt-im-rezept');
              const aehnlich     = hintOf(e, 'aehnlich');
              const istOffen     = offen === e.key;

              return (
                <div key={e.key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--card)' }}>
                    <input
                      type="checkbox" checked={markiert.has(e.key)} onChange={() => toggleMark(e.key)}
                      title="Für Umbenennen oder Zusammenführen markieren"
                    />
                    <button
                      onClick={() => setOffen(istOffen ? null : e.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', padding: 0 }}
                    >
                      {istOffen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.canonical}
                        {e.displayNames.length > 1 && (
                          <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}> +{e.displayNames.length - 1}</span>
                        )}
                      </span>
                    </button>

                    <span style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{e.category}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{e.units.join(', ') || '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', minWidth: 54, textAlign: 'right' }}>
                      {e.recipeCount} Rez.
                    </span>

                    <span style={{ display: 'flex', gap: 4 }}>
                      {schreibweise?.art === 'schreibweise' && (
                        <span
                          title={`${schreibweise.grund} Vorschlag: ${schreibweise.vorschlag}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                                   background: schreibweise.sicher ? '#fee2e2' : '#fef9c3',
                                   color:      schreibweise.sicher ? '#991b1b' : '#854d0e' }}
                        >
                          <AlertTriangle size={10} />{schreibweise.vorschlag}
                        </span>
                      )}
                      {einheiten && <span title="Dieselbe Zutat wird in verschiedenen Einheiten geführt." style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, background: '#e0f2fe', color: '#075985' }}><Layers size={10} /></span>}
                      {doppelt   && <span title="Kommt in mindestens einem Rezept mehrfach vor." style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, background: '#ede9fe', color: '#5b21b6' }}><Copy size={10} /></span>}
                      {aehnlich  && aehnlich.art === 'aehnlich' && (
                        <span title={`Ähnliche Schreibweisen: ${aehnlich.namen.join(', ')}`} style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, background: '#f1f5f9', color: '#334155' }}><Search size={10} /></span>
                      )}
                    </span>
                  </div>

                  {istOffen && (
                    <div style={{ padding: '10px 12px 12px 34px', background: 'var(--bg)', fontSize: 12 }}>
                      {e.displayNames.length > 1 && (
                        <p style={{ marginBottom: 8, color: 'var(--ink-2)' }}>
                          Schreibweisen: {e.displayNames.join(' · ')}
                        </p>
                      )}
                      {schreibweise?.art === 'schreibweise' && (
                        <p style={{ marginBottom: 8 }}>
                          <button
                            onClick={() => { setMarkiert(new Set([e.key])); setZiel(schreibweise.vorschlag); setVorschau(null); }}
                            className="mz-btn-secondary" style={{ fontSize: 12 }}
                          >
                            <Check size={12} style={{ display: 'inline', marginRight: 4 }} />
                            Auf «{schreibweise.vorschlag}» ändern
                          </button>
                          <span style={{ marginLeft: 8, color: 'var(--ink-2)' }}>{schreibweise.grund}</span>
                        </p>
                      )}
                      {aehnlich?.art === 'aehnlich' && (
                        <p style={{ marginBottom: 8, color: 'var(--ink-2)' }}>
                          Ähnlich: {aehnlich.namen.join(', ')} — zum Zusammenführen beide markieren.
                        </p>
                      )}
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {e.usages.map((u, i) => (
                            <tr key={`${u.recipeId}-${i}`}>
                              <td style={{ padding: '3px 8px 3px 0', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                                {u.amount > 0 ? `${u.amount} ${u.unit}` : u.unit || '—'}
                              </td>
                              <td style={{ padding: '3px 8px 3px 0' }}>{u.displayName}</td>
                              <td style={{ padding: '3px 0', color: 'var(--ink-2)' }}>{u.recipeName} <span style={{ opacity: 0.6 }}>({u.recipeId})</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {gefiltert.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>Keine Zutat passt zu diesem Filter.</p>
      )}
    </div>
  );
}
