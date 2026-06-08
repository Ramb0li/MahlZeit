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

type EditUserForm = {
  plan:        'trial' | 'lifetime' | 'abo' | 'beta';
  status:      'active' | 'inactive' | 'pending';
  accessUntil: string;
};

const PLAN_LABEL: Record<string, string> = {
  trial:    '7-Tage Test',
  lifetime: 'Lifetime',
  abo:      'Monatsabo',
  yearly:   'Jahresabo',
  beta:     'Beta-Tester',
};

const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  trial:    { bg: '#fff3e0', color: '#e65100' },
  lifetime: { bg: '#e8f5e9', color: '#2e7d32' },
  abo:      { bg: '#e3f2fd', color: '#1565c0' },
  yearly:   { bg: '#e3f2fd', color: '#1565c0' },
  beta:     { bg: '#f3e5f5', color: '#6a1b9a' },
};

type UserFilter = 'all' | 'active' | 'pending' | 'inactive' | 'lifetime';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#e8f5e9', color: '#2e7d32' },
  inactive: { bg: '#fce4ec', color: '#c62828' },
  pending:  { bg: '#fff3e0', color: '#e65100' },
};

/** Einheitliche Tab-Definition für Desktop-Nav und Mobile-BottomNav. */
function ADMIN_TABS(
  users: SafeUser[],
  recipes: Recipe[],
  userRecipes: { length: number } | null,
  isAdmin: (email: string) => boolean,
) {
  return [
    { id: 'users',        label: `Nutzer (${users.filter(u => !isAdmin(u.email)).length})`,           shortLabel: 'Nutzer'   },
    { id: 'recipes',      label: `Rezepte (${recipes.length})`,                                        shortLabel: 'Rezepte'  },
    { id: 'user-recipes', label: `Nutzer-Rezepte${userRecipes ? ` (${userRecipes.length})` : ''}`,    shortLabel: 'Nutzer-R.'},
    { id: 'landing',      label: 'Landing',                                                            shortLabel: 'Landing'  },
    { id: 'howto',        label: 'How-To',                                                             shortLabel: 'How-To'   },
  ] as const;
}

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

  // ── User Filter ─────────────────────────────────────────────────────────────
  const [userFilter, setUserFilter] = useState<UserFilter>('all');

  // ── User bearbeiten ──────────────────────────────────────────────────────────
  const [editingUser,    setEditingUser]    = useState<SafeUser | null>(null);
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserForm,   setEditUserForm]   = useState<EditUserForm | null>(null);
  const [editUserNotice, setEditUserNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const router = useRouter();

  // ── Tab-State ───────────────────────────────────────────────────────────────
  type AdminTab = 'users' | 'recipes' | 'user-recipes' | 'landing' | 'howto';
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // ── Nutzer-Rezepte-State ─────────────────────────────────────────────────────
  type UserRecipeRow = { groupId: string; groupName: string; recipe: Recipe };
  const [userRecipes,        setUserRecipes]        = useState<UserRecipeRow[] | null>(null);
  const [userRecipesLoading, setUserRecipesLoading] = useState(false);
  const [editingUserRecipe,  setEditingUserRecipe]  = useState<UserRecipeRow | null>(null);
  const [userRecipeSaving,   setUserRecipeSaving]   = useState(false);

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

  useEffect(() => {
    if (activeTab !== 'user-recipes' || userRecipes !== null) return;
    setUserRecipesLoading(true);
    fetch('/api/admin/group-recipes')
      .then(r => r.json())
      .then((data: UserRecipeRow[]) => setUserRecipes(data))
      .catch(() => setUserRecipes([]))
      .finally(() => setUserRecipesLoading(false));
  }, [activeTab, userRecipes]);

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
  const [showSeedModal,   setShowSeedModal]   = useState(false);

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
    // "new" = explizit neues Rezept; importierte Rezepte haben eine neue ID,
    // existieren aber noch nicht in Redis → ebenfalls POST verwenden
    const isNew = editingRecipe === 'new' || !recipes.some(r => r.id === recipe.id);
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

  const handleUserRecipeSave = async (recipe: Recipe) => {
    if (!editingUserRecipe) return;
    setUserRecipeSaving(true);
    setRecipeNotice(null);
    try {
      const res = await fetch('/api/admin/group-recipes', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ groupId: editingUserRecipe.groupId, recipe }),
      });
      const data = await res.json() as { ok?: boolean; recipe?: Recipe; error?: string };
      if (!res.ok) {
        setRecipeNotice({ type: 'err', text: data.error ?? 'Fehler beim Speichern.' });
        return;
      }
      setUserRecipes(prev => prev
        ? prev.map(row =>
            row.groupId === editingUserRecipe.groupId && row.recipe.id === recipe.id
              ? { ...row, recipe }
              : row
          )
        : prev
      );
      setEditingUserRecipe(null);
      setRecipeNotice({ type: 'ok', text: `"${recipe.name}" gespeichert.` });
      setTimeout(() => setRecipeNotice(null), 3000);
    } catch {
      setRecipeNotice({ type: 'err', text: 'Netzwerkfehler.' });
    } finally {
      setUserRecipeSaving(false);
    }
  };

  const seedRedis = async () => {
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

  const openEditUser = (u: SafeUser) => {
    setEditingUser(u);
    setEditUserForm({
      plan:        (u.plan as EditUserForm['plan']) ?? 'trial',
      status:      u.status,
      accessUntil: u.accessUntil?.slice(0, 10) ?? '',
    });
    setEditUserNotice(null);
  };

  const saveEditUser = async () => {
    if (!editingUser || !editUserForm) return;
    setEditUserSaving(true);
    setEditUserNotice(null);
    try {
      const body: Record<string, unknown> = {
        email:  editingUser.email,
        plan:   editUserForm.plan,
        status: editUserForm.status,
      };
      if (editUserForm.plan === 'trial' || editUserForm.plan === 'abo') {
        body.accessUntil = editUserForm.accessUntil || null;
      }
      const res  = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setEditUserNotice({ type: 'err', text: data.error ?? 'Fehler beim Speichern.' });
        return;
      }
      setUsers(prev => prev.map(u =>
        u.email === editingUser.email
          ? {
              ...u,
              plan:        editUserForm.plan,
              status:      editUserForm.status,
              accessUntil: (editUserForm.plan === 'trial' || editUserForm.plan === 'abo')
                ? (editUserForm.accessUntil || undefined)
                : undefined,
            }
          : u
      ));
      setEditUserNotice({ type: 'ok', text: 'Gespeichert.' });
      setTimeout(() => { setEditingUser(null); setEditUserForm(null); setEditUserNotice(null); }, 1200);
    } catch {
      setEditUserNotice({ type: 'err', text: 'Netzwerkfehler.' });
    } finally {
      setEditUserSaving(false);
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
        <nav className="mz-admin-topnav">
          {ADMIN_TABS(users, recipes, userRecipes, isAdmin).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as AdminTab)}
              className={`mz-admin-topnav-btn${activeTab === id ? ' on' : ''}`}
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

      <div className="mz-admin-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {activeTab === 'users' && <>

        {/* Stats row — klickbar zum Filtern */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {(() => {
            const customers = users.filter(u => !isAdmin(u.email));
            return [
              { label: 'Aktiv',      value: customers.filter((u) => u.status === 'active').length,   color: '#2e7d32', bg: '#e8f5e9', filter: 'active'   as UserFilter },
              { label: 'Ausstehend', value: customers.filter((u) => u.status === 'pending').length,  color: '#e65100', bg: '#fff3e0', filter: 'pending'  as UserFilter },
              { label: 'Inaktiv',    value: customers.filter((u) => u.status === 'inactive').length, color: '#c62828', bg: '#fce4ec', filter: 'inactive' as UserFilter },
              { label: 'Lifetime',   value: customers.filter((u) => u.plan === 'lifetime').length,   color: PLAN_COLOR.lifetime.color, bg: PLAN_COLOR.lifetime.bg, filter: 'lifetime' as UserFilter },
            ];
          })().map(({ label, value, color, bg, filter }) => (
            <div
              key={label}
              onClick={() => setUserFilter(prev => prev === filter ? 'all' : filter)}
              style={{
                background: bg, borderRadius: 'var(--r-card)', padding: '16px 20px', cursor: 'pointer',
                border: userFilter === filter ? `2px solid ${color}` : '1px solid var(--border)',
                transition: 'border .15s',
                userSelect: 'none',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-display)', color }}>{value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color }}>
                {label}{userFilter === filter ? ' ×' : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ borderRadius: 'var(--r-card)', overflow: 'auto', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
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

                const toShow = rendered.filter(({ user: u }) => {
                  if (isAdmin(u.email)) return true;
                  if (userFilter === 'all')      return true;
                  if (userFilter === 'active')   return u.status === 'active';
                  if (userFilter === 'pending')  return u.status === 'pending';
                  if (userFilter === 'inactive') return u.status === 'inactive';
                  if (userFilter === 'lifetime') return u.plan === 'lifetime';
                  return true;
                });

                return toShow.map(({ user: u, isMember }) => {
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
                        {(() => {
                          const pc = PLAN_COLOR[u.plan] ?? { bg: 'var(--chip)', color: 'var(--ink-2)' };
                          return (
                            <span style={{ background: pc.bg, color: pc.color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {PLAN_LABEL[u.plan] ?? u.plan}
                            </span>
                          );
                        })()}
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
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => openEditUser(u)}
                              style={{ background: 'var(--bg-2)', color: 'var(--sage)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                            >
                              Bearbeiten
                            </button>
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

        {/* Notice — tabübergreifend (Rezepte + Nutzer-Rezepte) */}
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

        {/* ── Rezepte-Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'recipes' && (
          <div>

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
              <button onClick={() => setShowSeedModal(true)} disabled={seeding} className="mz-btn-soft" title="Bundle-Rezepte nach Redis schreiben (überschreibt Prod-Daten)">
                {seeding ? 'Laden…' : 'Seed Redis'}
              </button>
              <button onClick={() => setEditingRecipe('new')} className="mz-btn-primary">
                + Neues Rezept
              </button>
            </div>

            {/* Rezepte-Tabelle */}
            <div style={{ borderRadius: 'var(--r-card)', overflow: 'auto', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Rezept', 'Kategorie', 'Zeit', 'Bild', 'Quelle', 'Aktionen'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)', fontSize: 13 }}>
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
                        <td style={{ padding: '10px 16px' }}>
                          {r.imageUrl
                            ? <img src={r.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                            : <span style={{ color: 'var(--muted)', fontSize: 11 }}>–</span>}
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

                  {/* ── Allgemeine Texte (meta) ── */}
                  <div style={{ marginBottom: 36 }}>
                    <h3 style={sectionHeadStyle}>Allgemeine Texte</h3>
                    <div style={cardStyle}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Rezept-Anzahl (Badge)</label>
                          <input
                            value={lc.meta.recipeCount}
                            onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, recipeCount: e.target.value } })}
                            style={inputStyle}
                            placeholder="200+"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Footer-Jahr</label>
                          <input
                            value={lc.meta.footerYear}
                            onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, footerYear: e.target.value } })}
                            style={inputStyle}
                            placeholder="2025"
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <label style={labelStyle}>Hero-Titel (Zeilenumbruch = neue Zeile · *Wort* = hervorgehoben)</label>
                        <textarea
                          value={lc.meta.heroTitle}
                          onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, heroTitle: e.target.value } })}
                          style={taStyle}
                          rows={2}
                          placeholder={'Deine Woche.\n*Dein* Essen.'}
                        />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <label style={labelStyle}>Hero-Lead (Einleitungstext)</label>
                        <textarea
                          value={lc.meta.heroLead}
                          onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, heroLead: e.target.value } })}
                          style={taStyle}
                          rows={3}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                        <div>
                          <label style={labelStyle}>Eyebrow: Features</label>
                          <input value={lc.meta.eyebrowFeatures} onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, eyebrowFeatures: e.target.value } })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Eyebrow: Wochenplan</label>
                          <input value={lc.meta.eyebrowWeek} onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, eyebrowWeek: e.target.value } })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Eyebrow: Rezepte</label>
                          <input value={lc.meta.eyebrowRecipes} onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, eyebrowRecipes: e.target.value } })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Eyebrow: Stimmen</label>
                          <input value={lc.meta.eyebrowReviews} onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, eyebrowReviews: e.target.value } })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Eyebrow: Preise</label>
                          <input value={lc.meta.eyebrowPricing} onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, eyebrowPricing: e.target.value } })} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <label style={labelStyle}>Trust-Zeile (unter den Preisen)</label>
                        <textarea
                          value={lc.meta.footerTrust}
                          onChange={e => setLandingContent({ ...lc, meta: { ...lc.meta, footerTrust: e.target.value } })}
                          style={taStyle}
                          rows={2}
                        />
                      </div>
                    </div>
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

        {/* ── Nutzer-Rezepte Tab ───────────────────────────────────────────── */}
        {activeTab === 'user-recipes' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>Nutzer-Rezepte</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Von Nutzern erstellte Gruppenrezepte. Du kannst sie in die offizielle Template-Liste übernehmen oder löschen.
              </p>
            </div>
            {userRecipesLoading && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Lade…</p>}
            {!userRecipesLoading && userRecipes !== null && userRecipes.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Noch keine Nutzer-Rezepte vorhanden.</p>
            )}
            {!userRecipesLoading && userRecipes && userRecipes.length > 0 && (
              <div style={{ borderRadius: 'var(--r-card)', overflow: 'auto', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Gruppe', 'Rezept', 'Kategorie', 'Bild', 'Aktionen'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {userRecipes.map(({ groupId, groupName, recipe }) => (
                      <tr key={`${groupId}-${recipe.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>{groupName}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)' }}>{recipe.name}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {recipe.category && (
                            <span style={{
                              background: CAT_COLOR[recipe.category]?.bg ?? 'var(--bg-2)',
                              color:      CAT_COLOR[recipe.category]?.color ?? 'var(--ink)',
                              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            }}>
                              {recipe.category}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {recipe.imageUrl
                            ? <img src={recipe.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                            : <span style={{ color: 'var(--muted)', fontSize: 11 }}>–</span>}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              style={{ background: 'var(--bg-2)', color: 'var(--sage)', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                              onClick={() => setEditingUserRecipe({ groupId, groupName, recipe })}
                            >
                              Bearbeiten
                            </button>
                            <button
                              className="mz-btn-primary"
                              style={{ fontSize: 12, padding: '5px 12px' }}
                              onClick={async () => {
                                const res  = await fetch('/api/admin/group-recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, recipeId: recipe.id }) });
                                const data = await res.json() as { ok?: boolean; recipe?: Recipe; error?: string };
                                if (res.ok && data.recipe) {
                                  setRecipes(prev => [...prev.filter(r => r.id !== data.recipe!.id), data.recipe!]);
                                  setUserRecipes(prev => prev ? prev.filter(r => !(r.groupId === groupId && r.recipe.id === recipe.id)) : prev);
                                  setRecipeNotice({ type: 'ok', text: `"${recipe.name}" in offizielle Liste übernommen.` });
                                  setTimeout(() => setRecipeNotice(null), 3000);
                                } else {
                                  setRecipeNotice({ type: 'err', text: data.error ?? 'Fehler beim Übernehmen.' });
                                }
                              }}
                            >
                              In offizielle Liste
                            </button>
                            <button
                              className="mz-btn-soft"
                              style={{ fontSize: 12, padding: '5px 12px', color: '#c62828' }}
                              onClick={async () => {
                                if (!window.confirm(`"${recipe.name}" aus der Gruppe "${groupName}" löschen?`)) return;
                                const res = await fetch('/api/admin/group-recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, recipeId: recipe.id }) });
                                if (res.ok) {
                                  setUserRecipes(prev => prev ? prev.filter(r => !(r.groupId === groupId && r.recipe.id === recipe.id)) : prev);
                                  setRecipeNotice({ type: 'ok', text: `"${recipe.name}" gelöscht.` });
                                  setTimeout(() => setRecipeNotice(null), 2500);
                                }
                              }}
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── How-To Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'howto' && (
          <div style={{ maxWidth: 760 }}>
            <div style={{ borderRadius: 'var(--r-card)', border: '1px solid var(--border)', background: 'var(--card)', padding: '32px 40px', boxShadow: 'var(--shadow-sm)', lineHeight: 1.7 }}>
              <h1 style={{ fontWeight: 800, fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>MahlZeit — Rezeptverwaltung</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>Admin-Panel How-To · <strong>mahlzeit.o-v-k.ch/admin</strong></p>

              {[
                { title: 'Rezept bearbeiten', body: 'In der Tabelle auf den Stift klicken. Felder anpassen und Speichern klicken — Änderung ist sofort live.' },
                { title: 'Neues Rezept erstellen', body: 'Button "+ Neues Rezept" klicken. Pflichtfelder: ID (z.B. linsen-curry, nur Kleinbuchstaben/Bindestriche), Name, Kategorie, Zutaten, Anleitung.' },
                { title: 'Bild hochladen', body: 'Im Rezept-Formular auf ein Bildfeld klicken → Datei wählen (JPG/PNG, max 8 MB). Bild wird automatisch hochgeladen. Danach Speichern klicken.' },
                { title: 'Rezept löschen', body: 'Papierkorb-Icon in der Tabelle → Bestätigen. Das Rezept verschwindet sofort aus Redis. Damit es dauerhaft aus dem Code entfernt wird: Export JSON → npm run recipes:sync → git push → Seed Redis (siehe unten).' },
                { title: 'Rezepte per KI importieren', body: 'Button "Importieren" → URL einer Rezept-Website oder Screenshot/Foto hochladen. Die KI befüllt das Formular automatisch. Felder prüfen → Speichern.' },
                { title: 'Nutzer-Rezepte übernehmen', body: 'Tab "Nutzer-Rezepte" öffnen. Dort siehst du alle von Nutzern erstellten Rezepte. Mit "In offizielle Liste" wird das Rezept als Template für alle verfügbar.' },
              ].map(({ title, body }) => (
                <div key={title} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>{body}</p>
                </div>
              ))}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />
              <h2 style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Technische Funktionen (nur Admin)</h2>

              <div style={{ borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', overflow: 'hidden', fontSize: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ink)', background: 'var(--bg-2)' }}>Export JSON</div>
                  <div style={{ padding: '12px 16px', color: 'var(--ink-2)' }}>
                    Lädt alle aktuellen Rezepte aus Redis als JSON-Datei herunter. Immer als ersten Schritt ausführen, bevor Änderungen ins Repo übernommen werden.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ink)', background: 'var(--bg-2)' }}>Seed Redis</div>
                  <div style={{ padding: '12px 16px', color: 'var(--ink-2)' }}>Überschreibt Redis mit dem aktuellen Deployment-Bundle. Nur nach einem erfolgreichen <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>git push</code> + Vercel-Deployment verwenden. Vorher immer Export JSON!</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr' }}>
                  <div style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ink)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center' }}>Vollständiger Workflow</div>
                  <div style={{ padding: '12px 16px', color: 'var(--ink-2)' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: 13 }}>Nach Bearbeitungen, Löschungen oder Bild-Uploads im Admin:</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2 }}>
                      <li>Hier auf <strong>Export JSON</strong> klicken → Datei als <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>data/recipes.json</code> ins Repo-Verzeichnis speichern</li>
                      <li>Terminal öffnen (<kbd style={{ background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11 }}>cmd+Leertaste</kbd> → Terminal) und eingeben:</li>
                    </ol>
                    <pre style={{ margin: '8px 0', background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, padding: '10px 14px', fontSize: 12, lineHeight: 1.6, overflowX: 'auto', userSelect: 'all' }}>{`cd ~/Documents/Claude/Cowork/Wochenplaner\\ Essen/mahlzeitplaner\nnpm run recipes:sync\ngit add -A\ngit commit -m "Rezepte aktualisiert"\ngit push`}</pre>
                    <ol start={3} style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2 }}>
                      <li>Ca. 2 Minuten warten bis Vercel das Deployment abgeschlossen hat</li>
                      <li>Hier auf <strong>Seed Redis</strong> klicken → sollte <code style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>{`{ ok: true, count: 189 }`}</code> zurückgeben</li>
                    </ol>
                    <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--muted)' }}>
                      <strong>recipes:sync</strong> erkennt automatisch neu hinzugefügte Bilder, geänderte Felder und gelöschte Rezepte — kein manuelles Bearbeiten von Einzeldateien nötig.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--accent-tint)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                Alle Änderungen sind sofort live. Kein Neustart nötig.
              </div>
            </div>
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

        {/* ── Nutzer-Rezept bearbeiten — Modal ────────────────────────────── */}
        {editingUserRecipe !== null && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px', background: 'rgba(39,31,26,.6)' }}>
            <div style={{ width: '100%', maxWidth: 760, borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h2 style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0 }}>
                    Bearbeiten: {editingUserRecipe.recipe.name}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Gruppe: {editingUserRecipe.groupName}
                  </div>
                </div>
                <button onClick={() => setEditingUserRecipe(null)} style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: 24 }}>
                {userRecipeSaving && <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Speichern…</p>}
                <RecipeForm
                  recipe={editingUserRecipe.recipe}
                  onSave={handleUserRecipeSave}
                  onCancel={() => setEditingUserRecipe(null)}
                  uploadEndpoint="/api/admin/upload"
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

        {/* ── Nutzer bearbeiten — Modal ────────────────────────────────────── */}
        {editingUser && editUserForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,31,26,.5)' }}>
            <div style={{ borderRadius: 'var(--r-card)', padding: 28, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0 }}>Nutzer bearbeiten</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {editingUser.firstName} {editingUser.lastName} · {editingUser.email}
                  </div>
                </div>
                <button
                  onClick={() => { setEditingUser(null); setEditUserForm(null); setEditUserNotice(null); }}
                  style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1, marginLeft: 12 }}
                >✕</button>
              </div>

              {/* Plan */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                  Plan
                </label>
                <select
                  value={editUserForm.plan}
                  onChange={e => setEditUserForm(prev => prev && ({ ...prev, plan: e.target.value as EditUserForm['plan'] }))}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                >
                  <option value="trial">7-Tage Test</option>
                  <option value="lifetime">Lifetime</option>
                  <option value="abo">Monatsabo</option>
                  <option value="beta">Beta-Tester</option>
                </select>
              </div>

              {/* Status */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                  Status
                </label>
                <select
                  value={editUserForm.status}
                  onChange={e => setEditUserForm(prev => prev && ({ ...prev, status: e.target.value as EditUserForm['status'] }))}
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                  <option value="pending">Ausstehend</option>
                </select>
              </div>

              {/* accessUntil — nur für trial/abo */}
              {(editUserForm.plan === 'trial' || editUserForm.plan === 'abo') && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                    Zugang bis <span style={{ fontWeight: 400, textTransform: 'none' }}>(leer = kein Ablaufdatum)</span>
                  </label>
                  <input
                    type="date"
                    value={editUserForm.accessUntil}
                    onChange={e => setEditUserForm(prev => prev && ({ ...prev, accessUntil: e.target.value }))}
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* Notice */}
              {editUserNotice && (
                <div style={{
                  marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--r-sm)', fontSize: 13,
                  ...(editUserNotice.type === 'ok'
                    ? { background: '#e8f5e9', color: '#2e7d32' }
                    : { background: '#fce4ec', color: '#c62828' }),
                }}>
                  {editUserNotice.text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setEditingUser(null); setEditUserForm(null); setEditUserNotice(null); }}
                  className="mz-btn-soft"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveEditUser}
                  disabled={editUserSaving}
                  className="mz-btn-primary"
                >
                  {editUserSaving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Seed Redis — Bestätigung ─────────────────────────────────────── */}
        {showSeedModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,31,26,.5)' }}>
            <div style={{ borderRadius: 'var(--r-card)', padding: 28, width: '100%', maxWidth: 460, boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--ink)', fontSize: 16 }}>Redis überschreiben?</h3>
              <p style={{ fontSize: 13, marginBottom: 8, color: 'var(--ink-2)' }}>
                Alle manuell in Produktion vorgenommenen Rezept-Änderungen gehen verloren und werden mit dem aktuellen Code-Bundle überschrieben.
              </p>
              <p style={{ fontSize: 13, marginBottom: 20, color: 'var(--ink-2)', fontWeight: 600 }}>
                Hast du deine aktuellen Menüs bereits exportiert und lokal gespeichert?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSeedModal(false)} className="mz-btn-soft">
                  Abbrechen
                </button>
                <a
                  href="/api/admin/recipes/export"
                  download
                  className="mz-btn-soft"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Aktuelle Menüs als Export JSON
                </a>
                <button
                  onClick={() => { setShowSeedModal(false); seedRedis(); }}
                  disabled={seeding}
                  className="mz-btn-primary"
                >
                  Bestätigen
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mz-admin-botnav">
        {ADMIN_TABS(users, recipes, userRecipes, isAdmin).map(({ id, shortLabel }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as AdminTab)}
            className={`mz-admin-botnav-btn${activeTab === id ? ' on' : ''}`}
          >
            {shortLabel}
          </button>
        ))}
      </nav>

    </div>
  );
}
