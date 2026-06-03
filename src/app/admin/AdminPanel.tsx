'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter }         from 'next/navigation';
import Link                  from 'next/link';
import { RecipeForm }        from '@/components/recipes/RecipeForm';
import { ImportRecipeModal } from '@/components/recipes/ImportRecipeModal';
import type { AppUser }      from '@/lib/users';
import type { Group }        from '@/lib/groups';
import type { Recipe, Category } from '@/types';
import type { LandingContent, LandingFeature } from '@/lib/content';

// Kategoriefarben für Badges — kategorienspezifisch, bleiben als Hex
const CAT_COLOR: Record<string, { bg: string; color: string }> = {
  'Frühstück':                  { bg: '#fff8e1', color: '#f57f17' },
  'Snacks & Vorspeisen':        { bg: '#f3e5f5', color: '#6a1b9a' },
  'Suppen, Eintöpfe & Currys':  { bg: '#e0f2f1', color: '#00695c' },
  'Salate & Bowls':             { bg: '#e8f5e9', color: '#2e7d32' },
  'Pasta':                      { bg: '#f2e5e0', color: '#b5614a' },
  'Reis & Getreide':            { bg: '#f5ece0', color: '#c49a6c' },
  'Kartoffelgerichte':          { bg: '#fdf3e7', color: '#bf6000' },
  'Fleisch & Geflügel':         { bg: '#fce4ec', color: '#c62828' },
  'Fisch & Meeresfrüchte':      { bg: '#e3f2fd', color: '#1565c0' },
  'Vegetarische Hauptgerichte': { bg: '#f1f8e9', color: '#558b2f' },
  'Aufläufe & Gratins':         { bg: '#ede7f6', color: '#4527a0' },
  'Wraps & Sandwiches':         { bg: '#fbe9e7', color: '#bf360c' },
  'Desserts & Süsses':          { bg: '#fce4ec', color: '#880e4f' },
};

type SafeUser = Omit<AppUser, 'passwordHash'>;

const PLAN_LABEL: Record<string, string> = {
  trial:    '7-Tage Test',
  lifetime: 'Lifetime',
  abo:      'Monatsabo',
  yearly:   'Jahresabo',
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
  const [activeTab, setActiveTab] = useState<'users' | 'recipes' | 'landing'>('users');

  // ── Landing Content State ────────────────────────────────────────────────────
  const [landingContent, setLandingContent] = useState<LandingContent | null>(null);
  const [landingSaving,  setLandingSaving]  = useState(false);
  const [landingNotice,  setLandingNotice]  = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab !== 'landing' || landingContent !== null) return;
    fetch('/api/admin/content')
      .then(r => r.json())
      .then(data => setLandingContent(data))
      .catch(() => setLandingNotice({ type: 'err', text: 'Fehler beim Laden der Landing-Inhalte.' }));
  }, [activeTab, landingContent]);

  const saveLanding = async () => {
    if (!landingContent) return;
    setLandingSaving(true);
    try {
      const res  = await fetch('/api/admin/content', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(landingContent),
      });
      const data = await res.json();
      if (!res.ok) { setLandingNotice({ type: 'err', text: data.error ?? 'Fehler beim Speichern.' }); return; }
      setLandingNotice({ type: 'ok', text: 'Landing Page gespeichert. Änderungen sind sofort live.' });
      setTimeout(() => setLandingNotice(null), 4000);
    } catch {
      setLandingNotice({ type: 'err', text: 'Netzwerkfehler.' });
    } finally {
      setLandingSaving(false);
    }
  };

  // ── Rezepte-State ────────────────────────────────────────────────────────────
  const [recipes,         setRecipes]         = useState<Recipe[]>(initialRecipes);
  const [recipeSearch,    setRecipeSearch]    = useState('');
  const [recipeCatFilter, setRecipeCatFilter] = useState<Category | 'Alle'>('Alle');
  const [editingRecipe,   setEditingRecipe]   = useState<Recipe | null | 'new'>(null);
  const [recipeSaving,    setRecipeSaving]    = useState(false);
  const [recipeNotice,    setRecipeNotice]    = useState<{ type: 'ok'|'err'; text: string } | null>(null);
  const [deleteRecipeId,  setDeleteRecipeId]  = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [seeding,         setSeeding]         = useState(false);

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

  const seedRedis = async () => {
    if (!window.confirm('Rezepte in Redis mit dem aktuellen Bundle überschreiben? Manuelle Prod-Änderungen gehen verloren.')) return;
    setSeeding(true);
    try {
      const res  = await fetch('/api/admin/recipes/seed', { method: 'POST' });
      const data = await res.json() as { ok?: boolean; count?: number; error?: string };
      if (!res.ok) {
        setRecipeNotice({ type: 'err', text: data.error ?? 'Seed fehlgeschlagen.' });
      } else {
        setRecipeNotice({ type: 'ok', text: `Redis mit ${data.count} Rezepten aus dem Bundle befüllt. Seite neu laden.` });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setRecipeNotice({ type: 'err', text: 'Netzwerkfehler.' });
    } finally {
      setSeeding(false);
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <header className="mz-header" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginLeft: 8 }}>Admin</span>
        </div>
        <nav className="mz-topnav">
          {([
            { id: 'users'   as const, label: `Nutzer (${users.filter(u => !isAdmin(u.email)).length})` },
            { id: 'recipes' as const, label: `Rezepte (${recipes.length})` },
            { id: 'landing' as const, label: 'Landing' },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`mz-topnav-btn${activeTab === id ? ' on' : ''}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mz-header-r">
          <Link
            href="/app"
            style={{ background: 'var(--sage)', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
          >
            Zum Planer
          </Link>
          <button className="mz-btn-soft" onClick={exportCsv}>
            CSV Export
          </button>
          <button className="mz-logout" onClick={logout}>
            Abmelden
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {activeTab === 'users' && <>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {(() => {
            const customers = users.filter(u => !isAdmin(u.email));
            return [
              { label: 'Aktiv',      value: customers.filter((u) => u.status === 'active').length,   color: '#2e7d32', bg: '#e8f5e9' },
              { label: 'Ausstehend', value: customers.filter((u) => u.status === 'pending').length,  color: '#e65100', bg: '#fff3e0' },
              { label: 'Inaktiv',    value: customers.filter((u) => u.status === 'inactive').length, color: '#c62828', bg: '#fce4ec' },
              { label: 'Lifetime',   value: customers.filter((u) => u.plan === 'lifetime').length,   color: 'var(--accent)', bg: 'var(--accent-tint)' },
            ];
          })().map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 'var(--r-card)', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-display)', color }}>{value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'E-Mail', 'Gruppe', 'Plan', 'Status', 'Registriert', 'Aktionen'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)', fontSize: 13 }}>
                    Noch keine Nutzer registriert.
                  </td>
                </tr>
              )}
              {(() => {
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
                const orphanMembers = members.filter(m => !ownersByGroup.has(m.groupId));
                for (const m of orphanMembers) rendered.push({ user: m, isMember: true });
                for (const u of ungrouped) rendered.push({ user: u, isMember: false });

                return rendered.map(({ user: u, isMember }) => {
                  const sc    = STATUS_COLOR[u.status] ?? STATUS_COLOR.inactive;
                  const admin = isAdmin(u.email);
                  return (
                    <tr key={u.email} style={{
                      borderBottom: '1px solid var(--border-2)',
                      background: admin ? 'var(--bg-2)' : isMember ? 'color-mix(in srgb, var(--bg) 60%, var(--card))' : 'var(--card)',
                    }}>
                      <td style={{ padding: '10px 16px', paddingLeft: isMember ? 32 : 16, fontWeight: 600, color: 'var(--ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isMember && <span style={{ color: 'var(--accent)', fontWeight: 800 }}>↳</span>}
                          {u.firstName} {u.lastName}
                          {admin && (
                            <span style={{ background: 'var(--sage)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                              Admin
                            </span>
                          )}
                          {isMember && (
                            <span style={{ background: 'var(--chip)', color: 'var(--ink-2)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                              Mitglied
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink-2)' }}>{u.email}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-2)' }}>
                        {groupNameById(u.groupId)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: 'var(--accent-tint)', color: 'var(--accent-ink)', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                          {PLAN_LABEL[u.plan] ?? u.plan}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ ...sc, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                          {u.status === 'active' ? 'Aktiv' : u.status === 'pending' ? 'Ausstehend' : 'Inaktiv'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)' }}>
                        {u.registeredAt.slice(0, 10)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {admin ? (
                          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--muted)' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {u.status === 'active' ? (
                              <button
                                onClick={() => patch(u.email, 'inactive')}
                                disabled={!!loading}
                                style={{ background: '#fce4ec', color: '#c62828', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, opacity: loading ? .5 : 1 }}
                              >
                                {loading === u.email + 'inactive' ? '…' : 'Deaktivieren'}
                              </button>
                            ) : (
                              <button
                                onClick={() => patch(u.email, 'active')}
                                disabled={!!loading}
                                style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, opacity: loading ? .5 : 1 }}
                              >
                                {loading === u.email + 'active' ? '…' : 'Aktivieren'}
                              </button>
                            )}
                            <button
                              onClick={() => setConfirm(u.email)}
                              style={{ background: 'var(--chip)', color: 'var(--muted)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)' }}
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
              <div style={{
                marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--r-sm)', fontSize: 13,
                ...(recipeNotice.type === 'ok'
                  ? { background: '#e8f5e9', color: '#2e7d32' }
                  : { background: '#fce4ec', color: '#c62828' })
              }}>
                {recipeNotice.text}
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <div className="mz-search-box" style={{ flex: 1, minWidth: 180 }}>
                <input
                  type="text"
                  value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  placeholder="Rezept suchen…"
                />
              </div>
              <select
                value={recipeCatFilter}
                onChange={e => setRecipeCatFilter(e.target.value as Category | 'Alle')}
                style={{ border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }}
              >
                {recipeCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => setShowImportModal(true)} className="mz-btn-soft">
                Importieren
              </button>
              <a href="/api/admin/recipes/export" download className="mz-btn-soft" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Export JSON
              </a>
              <button onClick={seedRedis} disabled={seeding} className="mz-btn-soft" title="Bundle-Rezepte nach Redis schreiben (überschreibt Prod-Daten)">
                {seeding ? 'Laden…' : 'Seed Redis'}
              </button>
              <button onClick={() => setEditingRecipe('new')} className="mz-btn-primary">
                + Neues Rezept
              </button>
            </div>

            {/* Rezepte-Tabelle */}
            <div style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Rezept', 'Kategorie', 'Zeit', 'Quelle', 'Aktionen'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)', fontSize: 13 }}>
                        Keine Rezepte gefunden.
                      </td>
                    </tr>
                  )}
                  {filteredRecipes.map((r, i) => {
                    const catCol = CAT_COLOR[r.category] ?? { bg: 'var(--chip)', color: 'var(--ink-2)' };
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                          <div style={{ fontSize: 11, marginTop: 2, color: 'var(--muted)' }}>{r.id}</div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ ...catCol, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                            {r.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-2)' }}>
                          {r.timeMinutes ? `${r.timeMinutes} min` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }} title={r.source}>
                          {r.source ?? '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setEditingRecipe(r)}
                              style={{ background: 'var(--bg-2)', color: 'var(--sage)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => setDeleteRecipeId(r.id)}
                              style={{ background: 'var(--chip)', color: 'var(--muted)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)' }}
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

            {showImportModal && (
              <ImportRecipeModal
                isPremium={true}
                onClose={() => setShowImportModal(false)}
                onImported={(recipe) => {
                  setShowImportModal(false);
                  setEditingRecipe(recipe);
                }}
              />
            )}
          </div>
        )}

        {/* ── Landing Content Tab ──────────────────────────────────────────── */}
        {activeTab === 'landing' && (
          <div>
            {landingNotice && (
              <div style={{
                marginBottom: 16, padding: '10px 16px', borderRadius: 'var(--r-sm)', fontSize: 13,
                ...(landingNotice.type === 'ok'
                  ? { background: '#e8f5e9', color: '#2e7d32' }
                  : { background: '#fce4ec', color: '#c62828' }),
              }}>
                {landingNotice.text}
              </div>
            )}

            {!landingContent && !landingNotice && (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>Lade…</div>
            )}

            {landingContent && (() => {
              const lc = landingContent;

              const inputStyle: React.CSSProperties = {
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)',
                borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
              };
              const taStyle: React.CSSProperties = {
                ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit',
              };
              const labelStyle: React.CSSProperties = {
                fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4,
              };
              const cardStyle: React.CSSProperties = {
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-card)', padding: 16,
              };
              const sectionHeadStyle: React.CSSProperties = {
                fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px 0',
              };

              return (
                <>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Landing Page Inhalt</h2>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, margin: '4px 0 0' }}>
                        Testimonials, Features und Preispläne. Änderungen werden sofort live ohne Deployment.
                      </p>
                    </div>
                    <button onClick={saveLanding} disabled={landingSaving} className="mz-btn-primary">
                      {landingSaving ? 'Speichern…' : 'Speichern'}
                    </button>
                  </div>

                  {/* ── Testimonials ── */}
                  <div style={{ marginBottom: 36 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h3 style={sectionHeadStyle}>Testimonials</h3>
                      <button
                        onClick={() => setLandingContent({ ...lc, reviews: [...lc.reviews, { name: '', text: '', role: '' }] })}
                        className="mz-btn-soft"
                        style={{ fontSize: 12 }}
                      >
                        + Hinzufügen
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {lc.reviews.map((r, i) => (
                        <div key={i} style={cardStyle}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div>
                              <label style={labelStyle}>Name</label>
                              <input
                                value={r.name}
                                onChange={e => {
                                  const reviews = [...lc.reviews];
                                  reviews[i] = { ...r, name: e.target.value };
                                  setLandingContent({ ...lc, reviews });
                                }}
                                style={inputStyle}
                                placeholder="Sarah M."
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Rolle</label>
                              <input
                                value={r.role}
                                onChange={e => {
                                  const reviews = [...lc.reviews];
                                  reviews[i] = { ...r, role: e.target.value };
                                  setLandingContent({ ...lc, reviews });
                                }}
                                style={inputStyle}
                                placeholder="Mutter, Basel"
                              />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Zitat</label>
                            <textarea
                              value={r.text}
                              rows={3}
                              onChange={e => {
                                const reviews = [...lc.reviews];
                                reviews[i] = { ...r, text: e.target.value };
                                setLandingContent({ ...lc, reviews });
                              }}
                              style={taStyle}
                              placeholder="«Das war …»"
                            />
                          </div>
                          {lc.reviews.length > 1 && (
                            <div style={{ marginTop: 8, textAlign: 'right' }}>
                              <button
                                onClick={() => setLandingContent({ ...lc, reviews: lc.reviews.filter((_, j) => j !== i) })}
                                style={{ background: 'var(--chip)', color: 'var(--muted)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)' }}
                              >
                                Entfernen
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Features ── */}
                  <div style={{ marginBottom: 36 }}>
                    <h3 style={sectionHeadStyle}>Features</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {lc.features.map((f: LandingFeature, i: number) => (
                        <div key={i} style={cardStyle}>
                          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                            <div style={{ background: 'var(--accent-tint)', color: 'var(--accent-ink)', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                              {f.n}
                            </div>
                            <input
                              value={f.title}
                              onChange={e => {
                                const features = [...lc.features];
                                features[i] = { ...f, title: e.target.value };
                                setLandingContent({ ...lc, features });
                              }}
                              style={{ ...inputStyle, fontWeight: 600 }}
                              placeholder="Feature-Titel"
                            />
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <label style={labelStyle}>Text</label>
                            <textarea
                              value={f.text}
                              rows={3}
                              onChange={e => {
                                const features = [...lc.features];
                                features[i] = { ...f, text: e.target.value };
                                setLandingContent({ ...lc, features });
                              }}
                              style={taStyle}
                            />
                          </div>
                          <details>
                            <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
                              Inline-Link {f.link ? `(aktiv: ${f.link.text})` : '(keiner)'}
                            </summary>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                              <div>
                                <label style={labelStyle}>Link-Text (im Fliesstext)</label>
                                <input
                                  value={f.link?.text ?? ''}
                                  onChange={e => {
                                    const features = [...lc.features];
                                    const lt = e.target.value;
                                    features[i] = { ...f, link: lt ? { text: lt, url: f.link?.url ?? '' } : undefined };
                                    setLandingContent({ ...lc, features });
                                  }}
                                  style={inputStyle}
                                  placeholder="@cuiseline"
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Link-URL</label>
                                <input
                                  value={f.link?.url ?? ''}
                                  onChange={e => {
                                    const features = [...lc.features];
                                    const lu = e.target.value;
                                    const lt = f.link?.text ?? '';
                                    features[i] = { ...f, link: lt ? { text: lt, url: lu } : undefined };
                                    setLandingContent({ ...lc, features });
                                  }}
                                  style={inputStyle}
                                  placeholder="https://…"
                                />
                              </div>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Preise ── */}
                  <div style={{ marginBottom: 36 }}>
                    <h3 style={sectionHeadStyle}>Preispläne</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
                      {lc.plans.map((p, i) => (
                        <div key={i} style={{ ...cardStyle, borderColor: p.featured ? 'var(--accent)' : 'var(--border)' }}>
                          {/* Badge + Featured */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                            <input
                              value={p.badge}
                              onChange={e => {
                                const plans = [...lc.plans];
                                plans[i] = { ...p, badge: e.target.value };
                                setLandingContent({ ...lc, plans });
                              }}
                              style={{ ...inputStyle, fontSize: 11 }}
                              placeholder="Badge (Bester Wert)"
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={p.featured}
                                onChange={e => {
                                  const plans = [...lc.plans];
                                  plans[i] = { ...p, featured: e.target.checked };
                                  setLandingContent({ ...lc, plans });
                                }}
                              />
                              Featured
                            </label>
                          </div>
                          {/* Name */}
                          <input
                            value={p.name}
                            onChange={e => {
                              const plans = [...lc.plans];
                              plans[i] = { ...p, name: e.target.value };
                              setLandingContent({ ...lc, plans });
                            }}
                            style={{ ...inputStyle, fontSize: 15, fontWeight: 700, marginBottom: 8 }}
                            placeholder="Plan-Name"
                          />
                          {/* Price + per */}
                          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, marginBottom: 8 }}>
                            <input
                              value={p.amount}
                              onChange={e => {
                                const plans = [...lc.plans];
                                plans[i] = { ...p, amount: e.target.value };
                                setLandingContent({ ...lc, plans });
                              }}
                              style={{ ...inputStyle, fontSize: 20, fontWeight: 900, textAlign: 'center' }}
                              placeholder="99"
                            />
                            <input
                              value={p.per}
                              onChange={e => {
                                const plans = [...lc.plans];
                                plans[i] = { ...p, per: e.target.value };
                                setLandingContent({ ...lc, plans });
                              }}
                              style={{ ...inputStyle, fontSize: 12 }}
                              placeholder="/ Monat · kündbar"
                            />
                          </div>
                          {/* Description */}
                          <textarea
                            value={p.desc}
                            rows={2}
                            onChange={e => {
                              const plans = [...lc.plans];
                              plans[i] = { ...p, desc: e.target.value };
                              setLandingContent({ ...lc, plans });
                            }}
                            style={{ ...taStyle, fontSize: 12, resize: 'none', marginBottom: 8 }}
                            placeholder="Kurzbeschreibung"
                          />
                          {/* Features list */}
                          <div>
                            <label style={labelStyle}>Features</label>
                            {p.features.map((feat, j) => (
                              <div key={j} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                <input
                                  value={feat}
                                  onChange={e => {
                                    const plans = [...lc.plans];
                                    const features = [...p.features];
                                    features[j] = e.target.value;
                                    plans[i] = { ...p, features };
                                    setLandingContent({ ...lc, plans });
                                  }}
                                  style={{ ...inputStyle, fontSize: 12, padding: '5px 8px' }}
                                />
                                <button
                                  onClick={() => {
                                    const plans = [...lc.plans];
                                    plans[i] = { ...p, features: p.features.filter((_, k) => k !== j) };
                                    setLandingContent({ ...lc, plans });
                                  }}
                                  style={{ color: 'var(--muted)', padding: '4px 8px', borderRadius: 6, fontSize: 14, background: 'var(--chip)', border: '1px solid var(--border)', lineHeight: 1 }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const plans = [...lc.plans];
                                plans[i] = { ...p, features: [...p.features, ''] };
                                setLandingContent({ ...lc, plans });
                              }}
                              style={{ background: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0, marginTop: 2 }}
                            >
                              + Feature hinzufügen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom save */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <button onClick={saveLanding} disabled={landingSaving} className="mz-btn-primary">
                      {landingSaving ? 'Speichern…' : 'Alle Änderungen speichern'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Rezept Bearbeiten / Neu — Modal ─────────────────────────────── */}
        {editingRecipe !== null && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px', background: 'rgba(39,31,26,.6)' }}>
            <div style={{ width: '100%', maxWidth: 760, borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0 }}>
                  {editingRecipe === 'new' ? 'Neues Template-Rezept' : `Bearbeiten: ${(editingRecipe as Recipe).name}`}
                </h2>
                <button onClick={() => setEditingRecipe(null)} style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: 24 }}>
                {recipeSaving && <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Speichern…</p>}
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,31,26,.5)' }}>
            <div style={{ borderRadius: 'var(--r-card)', padding: 24, width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>Template-Rezept löschen?</h3>
              <p style={{ fontSize: 13, marginBottom: 4, color: 'var(--ink-2)', fontWeight: 600 }}>
                {recipes.find(r => r.id === deleteRecipeId)?.name}
              </p>
              <p style={{ fontSize: 12, marginBottom: 20, color: 'var(--muted)' }}>
                Die JSON-Datei wird gelöscht. Änderung erst nach Deployment wirksam.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteRecipeId(null)} className="mz-btn-soft">Abbrechen</button>
                <button
                  onClick={() => handleRecipeDelete(deleteRecipeId)}
                  disabled={recipeSaving}
                  style={{ background: '#c62828', color: '#fff', padding: '9px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14, opacity: recipeSaving ? .5 : 1 }}
                >
                  {recipeSaving ? '…' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm modal */}
        {confirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,31,26,.5)' }}>
            <div style={{ borderRadius: 'var(--r-card)', padding: 24, width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>Nutzer löschen?</h3>
              <p style={{ fontSize: 13, marginBottom: 20, color: 'var(--ink-2)' }}>
                <strong>{confirm}</strong> wird endgültig gelöscht und kann nicht wiederhergestellt werden.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirm(null)} className="mz-btn-soft">Abbrechen</button>
                <button
                  onClick={() => del(confirm)}
                  disabled={!!loading}
                  style={{ background: '#c62828', color: '#fff', padding: '9px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14, opacity: loading ? .5 : 1 }}
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
