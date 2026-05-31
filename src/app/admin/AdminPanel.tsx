'use client';

import { useState, useMemo } from 'react';
import { useRouter }         from 'next/navigation';
import Link                  from 'next/link';
import { RecipeForm }        from '@/components/recipes/RecipeForm';
import type { AppUser }      from '@/lib/users';
import type { Group }        from '@/lib/groups';
import type { Recipe, Category } from '@/types';

// Kategoriefarben für Badges
const CAT_COLOR: Record<string, { bg: string; color: string }> = {
  'Eier':           { bg: '#fff3e0', color: '#e65100' },
  'Reis':           { bg: '#f5ece0', color: '#c49a6c' },
  'Pasta':          { bg: '#f2e5e0', color: '#b5614a' },
  'Eintopf/Gratin': { bg: '#fce4ec', color: '#c62828' },
  'Fisch':          { bg: '#e3f2fd', color: '#1565c0' },
  'Sonstige':       { bg: '#efe9df', color: '#5a4e48' },
  'Asiatisch':      { bg: '#fce4ec', color: '#ad1457' },
  'Ofen':           { bg: '#ede7f6', color: '#4527a0' },
  'Suppen':         { bg: '#e0f2f1', color: '#00695c' },
  'Salat/Bowl':     { bg: '#e8f5e9', color: '#2e7d32' },
  'Frühstück':      { bg: '#fff8e1', color: '#f57f17' },
  'Süsses':         { bg: '#fce4ec', color: '#880e4f' },
  'Brot & Aufstrich': { bg: '#efebe9', color: '#4e342e' },
  'Snacks':         { bg: '#f3e5f5', color: '#6a1b9a' },
};

type SafeUser = Omit<AppUser, 'passwordHash'>;

const PLAN_LABEL: Record<string, string> = {
  trial:    '7-Tage Test',
  lifetime: 'Lifetime',
  abo:      'Monatsabo',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#e8f5e9', color: '#2e7d32' },
  inactive: { bg: '#fce4ec', color: '#c62828' },
  pending:  { bg: '#fff3e0', color: '#e65100' },
};

interface Props {
  initialUsers:   SafeUser[];
  adminEmail:     string;
  groups:         Group[];
  initialRecipes: Recipe[];
}

export default function AdminPanel({ initialUsers, adminEmail, groups, initialRecipes }: Props) {
  const groupNameById = (id?: string) => id ? (groups.find(g => g.id === id)?.name ?? '—') : '—';
  const isAdmin = (email: string) => email.toLowerCase() === adminEmail.toLowerCase();
  const [users,    setUsers]    = useState<SafeUser[]>(initialUsers);
  const [loading,  setLoading]  = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<string | null>(null);
  const router = useRouter();

  // ── Tab-State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'users' | 'recipes'>('users');

  // ── Rezepte-State ────────────────────────────────────────────────────────────
  const [recipes,        setRecipes]        = useState<Recipe[]>(initialRecipes);
  const [recipeSearch,   setRecipeSearch]   = useState('');
  const [recipeCatFilter, setRecipeCatFilter] = useState<Category | 'Alle'>('Alle');
  const [editingRecipe,  setEditingRecipe]  = useState<Recipe | null | 'new'>(null);
  const [recipeSaving,   setRecipeSaving]   = useState(false);
  const [recipeNotice,   setRecipeNotice]   = useState<{ type: 'ok'|'err'; text: string } | null>(null);
  const [deleteRecipeId, setDeleteRecipeId] = useState<string | null>(null);

  const filteredRecipes = useMemo(() => recipes.filter(r => {
    if (recipeCatFilter !== 'Alle' && r.category !== recipeCatFilter) return false;
    if (recipeSearch && !r.name.toLowerCase().includes(recipeSearch.toLowerCase())) return false;
    return true;
  }), [recipes, recipeCatFilter, recipeSearch]);

  const recipeCategories = useMemo(() =>
    ['Alle', ...Array.from(new Set(recipes.map(r => r.category))).sort()] as (Category | 'Alle')[],
  [recipes]);

  const handleRecipeSave = async (recipe: Recipe) => {
    setRecipeSaving(true);
    setRecipeNotice(null);
    const isNew = editingRecipe === 'new';
    try {
      const res = await fetch('/api/admin/recipes', {
        method:  isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(recipe),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecipeNotice({ type: 'err', text: data.error ?? 'Fehler beim Speichern.' });
        return;
      }
      if (isNew) {
        setRecipes(prev => [...prev, recipe]);
      } else {
        setRecipes(prev => prev.map(r => r.id === recipe.id ? recipe : r));
      }
      setEditingRecipe(null);
      setRecipeNotice({ type: 'ok', text: `"${recipe.name}" gespeichert.` });
      setTimeout(() => setRecipeNotice(null), 3000);
    } catch {
      setRecipeNotice({ type: 'err', text: 'Netzwerkfehler.' });
    } finally {
      setRecipeSaving(false);
    }
  };

  const handleRecipeDelete = async (id: string) => {
    setRecipeSaving(true);
    try {
      const res  = await fetch('/api/admin/recipes', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { setRecipeNotice({ type: 'err', text: data.error ?? 'Fehler.' }); return; }
      setRecipes(prev => prev.filter(r => r.id !== id));
      setDeleteRecipeId(null);
      setRecipeNotice({ type: 'ok', text: 'Rezept gelöscht.' });
      setTimeout(() => setRecipeNotice(null), 2500);
    } finally {
      setRecipeSaving(false);
    }
  };

  const patch = async (email: string, status: 'active' | 'inactive') => {
    setLoading(email + status);
    await fetch('/api/admin/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, status }),
    });
    setUsers((prev) => prev.map((u) => u.email === email ? { ...u, status } : u));
    setLoading(null);
  };

  const del = async (email: string) => {
    setLoading(email + 'del');
    await fetch('/api/admin/users', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    setUsers((prev) => prev.filter((u) => u.email !== email));
    setConfirm(null);
    setLoading(null);
  };

  const exportCsv = () => {
    const header = 'Vorname,Nachname,E-Mail,Gruppe,Rolle,Plan,Status,Registriert,Zugang bis';
    const rows   = users.map((u) =>
      [u.firstName, u.lastName, u.email,
       groupNameById(u.groupId), u.groupRole ?? '',
       u.plan, u.status,
       u.registeredAt.slice(0, 10), u.accessUntil?.slice(0, 10) ?? ''].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `mahlzeit-nutzer-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f4ee', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-fraunces font-black text-2xl" style={{ color: '#2c2420' }}>
              🍽 MahlZeit — Admin
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#9c8c84' }}>
              {users.filter(u => !isAdmin(u.email)).length} registrierte Nutzer
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#e8f2e8', color: '#4a7a4e', border: '1px solid #c8d8c8', textDecoration: 'none' }}
            >
              🍽 Zum Menüplaner →
            </Link>
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }}
            >
              ↓ CSV Export
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#fce4ec', color: '#c62828', border: '1px solid #ffcdd2' }}
            >
              Abmelden
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['users', 'recipes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={activeTab === tab
                ? { backgroundColor: '#4a7a4e', color: '#fff' }
                : { backgroundColor: '#efe9df', color: '#5a4e48' }
              }
            >
              {tab === 'users' ? `👥 Nutzer (${users.filter(u => !isAdmin(u.email)).length})` : `📖 Rezepte (${recipes.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'users' && <>

        {/* Stats row — Admin wird in keiner Metrik mitgezählt */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(() => {
            const customers = users.filter(u => !isAdmin(u.email));
            return [
              { label: 'Aktiv',      value: customers.filter((u) => u.status === 'active').length,   color: '#2e7d32', bg: '#e8f5e9' },
              { label: 'Ausstehend', value: customers.filter((u) => u.status === 'pending').length,  color: '#e65100', bg: '#fff3e0' },
              { label: 'Inaktiv',    value: customers.filter((u) => u.status === 'inactive').length, color: '#c62828', bg: '#fce4ec' },
              { label: 'Lifetime',   value: customers.filter((u) => u.plan === 'lifetime').length,   color: '#b5614a', bg: '#f2e5e0' },
            ];
          })().map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-2xl p-4" style={{ backgroundColor: bg }}>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#efe9df', borderBottom: '1px solid #e0d8ce' }}>
                {['Name', 'E-Mail', 'Gruppe', 'Plan', 'Status', 'Registriert', 'Aktionen'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs" style={{ color: '#9c8c84' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#9c8c84' }}>
                    Noch keine Nutzer registriert.
                  </td>
                </tr>
              )}
              {(() => {
                // Owners zuerst, dann ihre Members darunter, dann Users ohne Gruppe
                const owners       = users.filter(u => u.groupRole === 'owner');
                const members      = users.filter(u => u.groupRole === 'member');
                const ungrouped    = users.filter(u => !u.groupRole);
                const ownersByGroup = new Map(owners.map(o => [o.groupId, o]));

                const rendered: { user: SafeUser; isMember: boolean }[] = [];
                for (const owner of owners) {
                  rendered.push({ user: owner, isMember: false });
                  const groupMembers = members.filter(m => m.groupId === owner.groupId);
                  for (const m of groupMembers) rendered.push({ user: m, isMember: true });
                }
                // Members ohne dazugehörigen Owner (Edge-Case)
                const orphanMembers = members.filter(m => !ownersByGroup.has(m.groupId));
                for (const m of orphanMembers) rendered.push({ user: m, isMember: true });
                // User ohne groupRole (Legacy / pre-Migration)
                for (const u of ungrouped) rendered.push({ user: u, isMember: false });

                return rendered.map(({ user: u, isMember }) => {
                  const sc    = STATUS_COLOR[u.status] ?? STATUS_COLOR.inactive;
                  const admin = isAdmin(u.email);
                  return (
                    <tr key={u.email} style={{
                      borderBottom: '1px solid #f0ede8',
                      backgroundColor: admin ? '#f2f6f2' : isMember ? '#fbfaf5' : 'transparent',
                    }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#2c2420', paddingLeft: isMember ? 32 : 16 }}>
                        <div className="flex items-center gap-2">
                          {isMember && <span style={{ color: '#c49a6c', fontWeight: 'bold' }}>↳</span>}
                          {u.firstName} {u.lastName}
                          {admin && (
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                              style={{ backgroundColor: '#4a7a4e', color: '#fff' }}
                              title="Administrator-Account — wird in den Statistiken nicht mitgezählt"
                            >
                              ★ Admin
                            </span>
                          )}
                          {isMember && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: '#f5ece0', color: '#c49a6c' }}>
                              Mitglied
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#5a4e48' }}>{u.email}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#5a4e48' }}>
                        {groupNameById(u.groupId)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#f2e5e0', color: '#b5614a' }}>
                          {PLAN_LABEL[u.plan] ?? u.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={sc}>
                          {u.status === 'active' ? 'Aktiv' : u.status === 'pending' ? 'Ausstehend' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#9c8c84' }}>
                        {u.registeredAt.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        {admin ? (
                          <span className="text-xs italic" style={{ color: '#9c8c84' }}>
                            —
                          </span>
                        ) : (
                          <div className="flex gap-1.5">
                            {u.status === 'active' ? (
                              <button
                                onClick={() => patch(u.email, 'inactive')}
                                disabled={!!loading}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                                style={{ backgroundColor: '#fce4ec', color: '#c62828' }}
                              >
                                {loading === u.email + 'inactive' ? '…' : 'Deaktivieren'}
                              </button>
                            ) : (
                              <button
                                onClick={() => patch(u.email, 'active')}
                                disabled={!!loading}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                                style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                              >
                                {loading === u.email + 'active' ? '…' : 'Aktivieren'}
                              </button>
                            )}
                            <button
                              onClick={() => setConfirm(u.email)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                              style={{ backgroundColor: '#f7f4ee', color: '#9c8c84', border: '1px solid #e0d8ce' }}
                            >
                              Löschen
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        </> /* end users tab */}

        {/* ── Rezepte-Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'recipes' && (
          <div>
            {/* Notice */}
            {recipeNotice && (
              <div className="mb-4 px-4 py-2 rounded-xl text-sm" style={recipeNotice.type === 'ok'
                ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
                : { backgroundColor: '#fce4ec', color: '#c62828' }
              }>
                {recipeNotice.text}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                type="text"
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                placeholder="Rezept suchen…"
                className="rounded-xl px-3 py-2 text-sm flex-1 min-w-[180px]"
                style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3', color: '#2c2420', outline: 'none' }}
              />
              <select
                value={recipeCatFilter}
                onChange={e => setRecipeCatFilter(e.target.value as Category | 'Alle')}
                className="rounded-xl px-3 py-2 text-sm"
                style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3', color: '#2c2420', outline: 'none' }}
              >
                {recipeCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={() => setEditingRecipe('new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#4a7a4e', color: '#fff' }}
              >
                + Neues Rezept
              </button>
            </div>

            {/* Rezepte-Tabelle */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e0d8ce', backgroundColor: '#fff9f3' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#efe9df', borderBottom: '1px solid #e0d8ce' }}>
                    {['Rezept', 'Kategorie', 'Zeit', 'Quelle', 'Aktionen'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-xs" style={{ color: '#9c8c84' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-sm" style={{ color: '#9c8c84' }}>
                        Keine Rezepte gefunden.
                      </td>
                    </tr>
                  )}
                  {filteredRecipes.map((r, i) => {
                    const catCol = CAT_COLOR[r.category] ?? { bg: '#efe9df', color: '#5a4e48' };
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f0ede8', backgroundColor: i % 2 === 0 ? 'transparent' : '#fffdf9' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: '#2c2420' }}>{r.name}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: '#9c8c84' }}>{r.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={catCol}>
                            {r.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#5a4e48' }}>
                          {r.timeMinutes ? `${r.timeMinutes} min` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[180px] truncate" style={{ color: '#9c8c84' }} title={r.source}>
                          {r.source ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setEditingRecipe(r)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                              style={{ backgroundColor: '#e8f2e8', color: '#4a7a4e' }}
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => setDeleteRecipeId(r.id)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
                              style={{ backgroundColor: '#f7f4ee', color: '#9c8c84', border: '1px solid #e0d8ce' }}
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Rezept Bearbeiten / Neu — Modal ─────────────────────────────── */}
        {editingRecipe !== null && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
               style={{ backgroundColor: 'rgba(44,36,32,0.6)' }}>
            <div className="w-full max-w-3xl rounded-2xl shadow-2xl" style={{ backgroundColor: '#fff9f3' }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e0d8ce' }}>
                <h2 className="font-semibold text-base" style={{ color: '#2c2420' }}>
                  {editingRecipe === 'new' ? 'Neues Template-Rezept' : `Bearbeiten: ${(editingRecipe as Recipe).name}`}
                </h2>
                <button onClick={() => setEditingRecipe(null)} style={{ color: '#9c8c84' }} className="text-xl leading-none">✕</button>
              </div>
              <div className="p-6">
                {recipeSaving && <p className="text-sm text-center mb-3" style={{ color: '#9c8c84' }}>Speichern…</p>}
                <RecipeForm
                  recipe={editingRecipe === 'new' ? undefined : (editingRecipe as Recipe)}
                  onSave={handleRecipeSave}
                  onCancel={() => setEditingRecipe(null)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Rezept löschen — Bestätigung ────────────────────────────────── */}
        {deleteRecipeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(44,36,32,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: '#fff9f3' }}>
              <h3 className="font-semibold mb-2" style={{ color: '#2c2420' }}>Template-Rezept löschen?</h3>
              <p className="text-sm mb-1" style={{ color: '#5a4e48' }}>
                <strong>{recipes.find(r => r.id === deleteRecipeId)?.name}</strong>
              </p>
              <p className="text-xs mb-5" style={{ color: '#9c8c84' }}>
                Die JSON-Datei wird gelöscht. Die Änderung wird erst nach einem Deployment für alle Nutzer wirksam.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteRecipeId(null)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#5a4e48' }}>
                  Abbrechen
                </button>
                <button
                  onClick={() => handleRecipeDelete(deleteRecipeId)}
                  disabled={recipeSaving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#c62828' }}
                >
                  {recipeSaving ? '…' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm modal */}
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(44,36,32,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ backgroundColor: '#fff9f3' }}>
              <h3 className="font-semibold mb-2" style={{ color: '#2c2420' }}>Nutzer löschen?</h3>
              <p className="text-sm mb-5" style={{ color: '#5a4e48' }}>
                <strong>{confirm}</strong> wird <strong>endgültig</strong> gelöscht und kann nicht wiederhergestellt werden.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ color: '#5a4e48' }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => del(confirm)}
                  disabled={!!loading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#c62828' }}
                >
                  {loading ? '…' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
