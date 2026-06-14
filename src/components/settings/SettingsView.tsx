'use client';
import { useState, useEffect, useContext, createContext, useRef, useCallback } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Search, X, Users, Mail, Edit3, RefreshCw } from 'lucide-react';
import { THEME_DEFS, toDataTheme } from '@/lib/themes';
import type { ThemeId } from '@/lib/themes';
import type { AppSettings, DayConstraint, Child, StoreId } from '@/types';
import type { Group, GroupRole } from '@/lib/groups';
import { ALLERGENS, PRESET_AVERSIONS } from '@/lib/allergens-config';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CONSTRAINT_LABELS = {
  maxTime: 'Max. Zeit',
  mealprep: 'Mealprep',
  custom: 'Anpassen',
};

const WEEK_SWITCH_OPTIONS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

const PRESET_COLORS = [
  '#c0533f', '#b5614a', '#c49a6c', '#5a4e48',
  '#1565c0', '#ad1457', '#6a4c93', '#37474f',
];

const SWISS_STORES: { id: StoreId; name: string; color: string; bg: string }[] = [
  { id: 'migros', name: 'Migros',      color: '#e65100', bg: '#fff3e0' },
  { id: 'coop',   name: 'Coop',        color: '#c62828', bg: '#fce4ec' },
  { id: 'denner', name: 'Denner',      color: '#7b1fa2', bg: '#f3e5f5' },
  { id: 'aldi',   name: 'Aldi Suisse', color: '#1565c0', bg: '#e3f2fd' },
  { id: 'lidl',   name: 'Lidl',        color: '#f57f17', bg: '#fffde7' },
  { id: 'volg',   name: 'Volg',        color: '#2e7d32', bg: '#e8f5e9' },
];

const sectionCard = {
  backgroundColor: '#fff9f3',
  border: '1px solid #e0d8ce',
  borderRadius: '16px',
  overflow: 'hidden',
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

// Stile für SettingsSection – auf Modul-Ebene damit keine Re-Renders ausgelöst werden
const h2Style  = { fontSize: '15px', fontWeight: 600, color: '#2c2420' } as const;
const subStyle = { fontSize: '12px', color: '#9c8c84', display: 'block', marginTop: '2px' } as const;

// Context für collapsible Sections – stabile Referenz verhindert Scroll-Sprünge bei Re-Renders
interface SectionCtxValue { openSections: Set<string>; toggleSection: (id: string) => void; }
const SectionCtx = createContext<SectionCtxValue>({ openSections: new Set(), toggleSection: () => {} });

function SettingsSection({ id, title, sub, children, action }: {
  id: string; title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  const { openSections, toggleSection } = useContext(SectionCtx);
  const open = openSections.has(id);
  return (
    <section style={sectionCard}>
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-6 py-4 transition-colors"
        style={{ backgroundColor: open ? 'transparent' : '#fffdf9' }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = '#fffdf9'; }}
      >
        <div className="text-left">
          <h2 style={h2Style}>{title}</h2>
          {sub && <span style={subStyle}>{sub}</span>}
        </div>
        <div className="flex items-center gap-3">
          {action && open && <div onClick={e => e.stopPropagation()}>{action}</div>}
          {open ? <ChevronUp size={16} style={{ color: '#9c8c84' }} /> : <ChevronDown size={16} style={{ color: '#9c8c84' }} />}
        </div>
      </button>
      {open && (
        <div className="px-6 pb-5" style={{ borderTop: '1px solid #f0ebe3' }}>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </section>
  );
}

interface MemberSummary {
  email:     string;
  firstName: string;
  lastName:  string;
  groupRole: GroupRole;
}

interface PendingInviteSummary {
  id:    string;
  email: string;
}

interface SettingsViewProps {
  initialSettings: AppSettings;
  initialConstraints: DayConstraint[];
  isPremium?: boolean;
  userPlan?: string;
  group?: Group | null;
  groupRole?: GroupRole;
  onSettingsChange?: (settings: AppSettings) => void;
  onConstraintsChange?: (constraints: DayConstraint[]) => void;
  onGroupChange?: (group: Group) => void;
}

function CatLabel({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1">
      <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: '#c49a6c' }}>
        {label}
      </p>
    </div>
  );
}

export function SettingsView({
  initialSettings,
  initialConstraints,
  isPremium = false,
  userPlan = 'trial',
  group = null,
  groupRole = 'member',
  onSettingsChange,
  onConstraintsChange,
  onGroupChange,
}: SettingsViewProps) {
  const isOwner = groupRole === 'owner';
  const [settings, setSettings]           = useState<AppSettings>(initialSettings);
  const [constraints, setConstraints]     = useState<DayConstraint[]>(initialConstraints);
  const [saved, setSaved]                 = useState(false);
  const [openSections, setOpenSections]   = useState<Set<string>>(new Set(['theme', 'meals']));
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError]     = useState<string | null>(null);
  const [aversionSearch, setAversionSearch] = useState('');
  const [promoRefreshing, setPromoRefreshing] = useState(false);
  const [promoError, setPromoError]           = useState<string | null>(null);
  const [promoLastUpdated, setPromoLastUpdated] = useState<string | null>(null);

  // Konto löschen
  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [deletePw, setDeletePw]           = useState('');
  const [deletePw2, setDeletePw2]         = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);

  // Weather autocomplete
  interface GeoResult { name: string; admin1?: string; country?: string; latitude: number; longitude: number; }
  const [locationSuggestions, setLocationSuggestions] = useState<GeoResult[]>([]);
  const [locationLoading, setLocationLoading]         = useState(false);
  const [showSuggestions, setShowSuggestions]         = useState(false);
  const locationWrapperRef = useRef<HTMLDivElement>(null);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedLocationRef = useRef(initialSettings.weather?.location ?? '');
  // Auto-save refs
  const isInitialMount  = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schließe Dropdown bei Klick außerhalb
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (locationWrapperRef.current && !locationWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-save: settings oder constraints geändert → nach 800ms automatisch speichern
  // (nicht beim ersten Mount feuern)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, constraints }),
      }).catch(() => {});
      onSettingsChange?.(settings);
      onConstraintsChange?.(constraints);
    }, 800);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [settings, constraints]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLocationSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setLocationSuggestions([]); setLocationLoading(false); return; }
    setLocationLoading(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=de&format=json`
      );
      if (!res.ok) return;
      const data = await res.json() as { results?: GeoResult[] };
      setLocationSuggestions(data.results ?? []);
      setShowSuggestions(true);
    } catch {
      setLocationSuggestions([]);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // Group state
  const [groupName, setGroupName]       = useState(group?.name ?? '');
  const [renaming, setRenaming]         = useState(false);
  const [members, setMembers]           = useState<MemberSummary[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteSummary[]>([]);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviting, setInviting]         = useState(false);
  const [familyNotice, setFamilyNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Mitglieder + offene Einladungen laden, wenn Section geöffnet wird
  useEffect(() => {
    if (!group) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/groups/members');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMembers(data as MemberSummary[]);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [group]);

  const reloadMembers = async () => {
    try {
      const res = await fetch('/api/groups/members');
      if (res.ok) setMembers(await res.json());
    } catch {}
  };

  const handleRenameGroup = async () => {
    if (!groupName.trim() || groupName.trim() === group?.name) return;
    setRenaming(true);
    setFamilyNotice(null);
    try {
      const res  = await fetch('/api/groups/rename', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: groupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setFamilyNotice({ type: 'err', text: data.error ?? 'Fehler' }); return; }
      onGroupChange?.(data as Group);
      setFamilyNotice({ type: 'ok', text: 'Gruppenname aktualisiert.' });
    } finally { setRenaming(false); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.includes('@')) { setFamilyNotice({ type: 'err', text: 'Ungültige E-Mail.' }); return; }
    setInviting(true);
    setFamilyNotice(null);
    try {
      const res  = await fetch('/api/groups/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setFamilyNotice({ type: 'err', text: data.error ?? 'Fehler' }); return; }
      setFamilyNotice({ type: 'ok', text: `Einladung an ${inviteEmail} versendet.` });
      setPendingInvites(prev => [...prev, { id: data.invite.id, email: data.invite.email }]);
      setInviteEmail('');
    } finally { setInviting(false); }
  };

  const handleRemoveMember = async (email: string) => {
    if (!confirm(`${email} wirklich aus der Gruppe entfernen?`)) return;
    setFamilyNotice(null);
    try {
      const res  = await fetch('/api/groups/members', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setFamilyNotice({ type: 'err', text: data.error ?? 'Fehler' }); return; }
      await reloadMembers();
      setFamilyNotice({ type: 'ok', text: `${email} entfernt.` });
    } catch {}
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const res = await fetch('/api/groups/invite', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ inviteId }),
      });
      if (res.ok) setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch {}
  };

  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const arr = Array.from(prev);
      const n = new Set(arr);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const portionFactor = (age: number) => {
    if (age < 3) return '0.25×';
    if (age <= 6) return '0.5×';
    if (age <= 12) return '0.75×';
    return '1×';
  };

  const totalPortions = () => {
    const childPortions = settings.household.children.reduce((sum, c) => {
      const f = c.age < 3 ? 0.25 : c.age <= 6 ? 0.5 : c.age <= 12 ? 0.75 : 1;
      return sum + f;
    }, 0);
    return settings.household.adults + childPortions;
  };

  const addChild = () => {
    const newChild: Child = { id: `child-${Date.now()}`, age: 5 };
    setSettings((s) => ({ ...s, household: { ...s.household, children: [...s.household.children, newChild] } }));
  };

  const updateChild = (id: string, age: number) =>
    setSettings((s) => ({ ...s, household: { ...s.household, children: s.household.children.map((c) => (c.id === id ? { ...c, age } : c)) } }));

  const removeChild = (id: string) =>
    setSettings((s) => ({ ...s, household: { ...s.household, children: s.household.children.filter((c) => c.id !== id) } }));

  const addConstraint = () => {
    const newC: DayConstraint = { id: `c-${Date.now()}`, dayOfWeek: 1, label: 'Neues Event', color: '#c0533f', mealType: 'dinner', constraint: 'maxTime', maxTimeMinutes: 30 };
    setConstraints((prev) => [...prev, newC]);
    setOpenSections(prev => new Set([...Array.from(prev), 'constraints']));
  };

  const updateConstraint = (id: string, updates: Partial<DayConstraint>) =>
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));

  const removeConstraint = (id: string) =>
    setConstraints((prev) => prev.filter((c) => c.id !== id));

  const handleCheckout = async (plan: 'abo' | 'yearly' | 'lifetime') => {
    setCheckoutLoading(plan);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) { setCheckoutError(data.error ?? 'Fehler beim Checkout'); return; }
      window.location.href = data.url;
    } catch {
      setCheckoutError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Load last-updated timestamp for promotions on mount
  useEffect(() => {
    fetch('/api/promotions')
      .then(r => r.json())
      .then((d: { lastUpdated?: string | null }) => { if (d.lastUpdated) setPromoLastUpdated(d.lastUpdated); })
      .catch(() => {});
  }, []);

  const handlePromoRefresh = async () => {
    setPromoRefreshing(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/promotions/refresh', { method: 'POST' });
      const data = await res.json() as { success?: boolean; lastUpdated?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Unbekannter Fehler');
      if (data.lastUpdated) setPromoLastUpdated(data.lastUpdated);
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Fehler beim Laden der Aktionen.');
    } finally {
      setPromoRefreshing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePw || deletePw !== deletePw2) {
      setDeleteError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePw }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error ?? 'Löschung fehlgeschlagen.'); return; }
      window.location.href = '/';
    } catch {
      setDeleteError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSave = async () => {
    // Ausstehenden Auto-Save-Timer canceln, um Doppel-Request zu vermeiden
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    const locationChanged = settings.weather.location.trim() !== lastSavedLocationRef.current.trim();
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings, constraints }) });
    onSettingsChange?.(settings);
    onConstraintsChange?.(constraints);
    lastSavedLocationRef.current = settings.weather.location;
    // Standort geändert → Wetter sofort im Hintergrund neu laden
    if (locationChanged) fetch('/api/weather?refresh=true').catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const labelStyle = { fontSize: '13px', fontWeight: 500, color: '#5a4e48', display: 'block', marginBottom: '4px' } as const;

  // SettingsSection liest openSections/toggleSection via SectionCtx – stabile Modul-Referenz
  const Section = SettingsSection;

  const PLAN_LABELS: Record<string, string> = {
    trial: 'Testwoche', abo: 'Monatsabo', yearly: 'Jahresabo', lifetime: 'Lifetime', beta: 'Beta',
  };

  return (
    <SectionCtx.Provider value={{ openSections, toggleSection }}>
    <div className="max-w-3xl space-y-3">

      {/* ── Haushalt & Ernährung ─────────────────────────────────────────── */}
      <CatLabel label="Haushalt & Ernährung" />
      {/* ── Haushaltsgrösse ──────────────────────────────────────────────── (war unten) */}
      <Section id="household" title="Haushaltsgrösse" sub={`Gesamtportionen: ${totalPortions()}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm" style={{ color: '#5a4e48' }}>Erwachsene</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSettings((s) => ({ ...s, household: { ...s.household, adults: Math.max(1, s.household.adults - 1) } }))}
                className="w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors"
                style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >–</button>
              <span className="w-6 text-center font-semibold" style={{ color: '#2c2420' }}>{settings.household.adults}</span>
              <button
                onClick={() => setSettings((s) => ({ ...s, household: { ...s.household, adults: s.household.adults + 1 } }))}
                className="w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors"
                style={{ border: '1px solid #e0d8ce', color: '#5a4e48' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#efe9df')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >+</button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm" style={{ color: '#5a4e48' }}>Kinder</label>
              <button onClick={addChild} className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--accent)' }}>
                <Plus size={14} />Kind hinzufügen
              </button>
            </div>
            {settings.household.children.length === 0 && (
              <p className="text-xs" style={{ color: '#9c8c84' }}>Noch keine Kinder</p>
            )}
            <div className="space-y-2">
              {settings.household.children.map((child) => (
                <div key={child.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f7f4ee' }}>
                  <span className="text-sm flex-1" style={{ color: '#5a4e48' }}>Kind · {child.age} Jahre</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff9f3', color: '#9c8c84', border: '1px solid #e0d8ce' }}>
                    {portionFactor(child.age)} Portion
                  </span>
                  <input
                    type="number" min={0} max={18} value={child.age}
                    onChange={(e) => updateChild(child.id, Number(e.target.value))}
                    style={{ ...inputStyle, width: '56px', textAlign: 'center', padding: '4px 8px' }}
                  />
                  <button
                    onClick={() => removeChild(child.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#9c8c84' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Ernährungsweise ──────────────────────────────────────────────── (verschoben) */}
      <Section id="diet" title="Ernährungsweise" sub="Filtert Rezeptvorschläge und den Menü-Picker.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(
            [
              { value: 'alle',          emoji: '🍽',  label: 'Alle',           sub: 'Kein Filter' },
              { value: 'fleischhaltig', emoji: '🥩',  label: 'Fleischhaltig',  sub: 'Inkl. Fleischgerichte' },
              { value: 'flexitarisch',  emoji: '🌾',  label: 'Flexitarisch',   sub: 'Max. 1× Fleisch/Woche' },
              { value: 'pescetarisch',  emoji: '🐟',  label: 'Pescetarisch',   sub: 'Kein Fleisch' },
              { value: 'vegetarisch',   emoji: '🥗',  label: 'Vegetarisch',    sub: 'Kein Fleisch, kein Fisch' },
              { value: 'vegan',         emoji: '🌿',  label: 'Vegan',          sub: 'Nur pflanzlich' },
            ] as const
          ).map(({ value, emoji, label, sub }) => {
            const isActive = (settings.dietPreference ?? 'alle') === value;
            return (
              <button
                key={value}
                onClick={() => setSettings((s) => ({ ...s, dietPreference: value }))}
                className="flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all"
                style={isActive
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-tint)' }
                  : { borderColor: '#e0d8ce' }
                }
              >
                <span className="text-2xl">{emoji}</span>
                <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? 'var(--accent)' : '#2c2420' }}>{label}</p>
                <p className="text-[10px]" style={{ color: '#9c8c84' }}>{sub}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Allergien & Abneigungen ──────────────────────────────────────── (verschoben) */}
      <Section id="allergies" title="Allergien & Abneigungen" sub="Rezepte mit diesen Zutaten werden ausgegraut und nicht vorgeschlagen.">
        {(() => {
          const selected = settings.allergiesAndAversions ?? [];
          const toggle = (id: string) =>
            setSettings(s => ({
              ...s,
              allergiesAndAversions: selected.includes(id)
                ? selected.filter(x => x !== id)
                : [...selected, id],
            }));
          const customAversions = selected.filter(
            id => !ALLERGENS.some(a => a.id === id) && !PRESET_AVERSIONS.map(p => p.toLowerCase()).includes(id)
          );
          const filteredPresets = PRESET_AVERSIONS.filter(p =>
            aversionSearch === '' || p.toLowerCase().includes(aversionSearch.toLowerCase())
          );
          return (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: '#5a4e48' }}>Allergene & Intoleranzen</p>
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map(({ id, label, emoji }) => {
                    const active = selected.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggle(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                        style={active
                          ? { borderColor: '#b5614a', backgroundColor: '#fce8e3', color: '#b5614a' }
                          : { borderColor: '#e0d8ce', backgroundColor: '#f7f4ee', color: '#5a4e48' }
                        }
                      >
                        <span>{emoji}</span>{label}{active && <X size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: '#5a4e48' }}>Sonstige Abneigungen</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {filteredPresets.map(p => {
                    const id = p.toLowerCase();
                    const active = selected.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggle(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                        style={active
                          ? { borderColor: '#b5614a', backgroundColor: '#fce8e3', color: '#b5614a' }
                          : { borderColor: '#e0d8ce', backgroundColor: '#f7f4ee', color: '#5a4e48' }
                        }
                      >
                        {p}{active && <X size={10} />}
                      </button>
                    );
                  })}
                  {customAversions.map(id => (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                      style={{ borderColor: '#b5614a', backgroundColor: '#fce8e3', color: '#b5614a' }}
                    >
                      {id}<X size={10} />
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9c8c84' }} />
                  <input
                    type="text" value={aversionSearch}
                    onChange={e => setAversionSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && aversionSearch.trim()) {
                        const id = aversionSearch.trim().toLowerCase();
                        if (!selected.includes(id)) toggle(id);
                        setAversionSearch('');
                      }
                    }}
                    placeholder="Suchen oder hinzufügen (Enter)"
                    style={{ ...inputStyle, width: '100%', paddingLeft: '32px' }}
                  />
                </div>
                {aversionSearch && filteredPresets.length === 0 && (
                  <p className="text-xs mt-1.5" style={{ color: '#9c8c84' }}>
                    Enter drücken um &quot;{aversionSearch}&quot; hinzuzufügen
                  </p>
                )}
              </div>
              {selected.length > 0 && (
                <p className="text-xs" style={{ color: '#9c8c84' }}>
                  {selected.length} Einschränkung{selected.length !== 1 ? 'en' : ''} aktiv — Rezepte mit diesen Zutaten werden ausgegraut.
                </p>
              )}
            </div>
          );
        })()}
      </Section>

      <CatLabel label="Wochenplan" />
      {/* ── Mahlzeiten ───────────────────────────────────────────────────── (verschoben) */}
      <Section id="meals" title="Mahlzeiten im Wochenplan" sub="Klicke auf eine Mahlzeit um sie ein- oder auszublenden.">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3">
          {(
            [
              { key: 'showBreakfast' as const, emoji: '☕', label: 'Frühstück',   def: false },
              { key: 'showLunch'     as const, emoji: '🥗', label: 'Mittagessen', def: false },
              { key: 'showDinner'    as const, emoji: '🍽', label: 'Abendessen',  def: true  },
            ]
          ).map(({ key, emoji, label, def }) => {
            const isActive = settings[key] ?? def;
            return (
              <button
                key={key}
                onClick={() => setSettings((s) => ({ ...s, [key]: !isActive }))}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                style={isActive
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-tint)' }
                  : { borderColor: '#e0d8ce', opacity: 0.55 }
                }
              >
                <span className="text-2xl">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: isActive ? 'var(--accent)' : '#2c2420' }}>{label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9c8c84' }}>{isActive ? 'Aktiv' : 'Ausgeblendet'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Wochenstartag ────────────────────────────────────────────────── */}
      <Section id="weekswitch" title="Wochenstartag" sub="Wähle, mit welchem Tag deine Planungswoche beginnt. KW basiert auf ISO-Standard (Donnerstag-Regel).">
        <div className="flex flex-wrap gap-2">
          {WEEK_SWITCH_OPTIONS.map(({ value, label }) => {
            const isActive = (settings.weekSwitchDay ?? 1) === value;
            return (
              <button
                key={value}
                onClick={() => setSettings(s => ({ ...s, weekSwitchDay: value }))}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2"
                style={isActive
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }
                  : { borderColor: '#e0d8ce', color: '#5a4e48' }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Events & Constraints ─────────────────────────────────────────── */}
      <Section
        id="constraints"
        title="Wöchentliche Events & Constraints"
        sub="Im Wochenplan kannst du Events für eine einzelne Woche durchstreichen."
        action={
          <button
            onClick={addConstraint}
            className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            <Plus size={14} />
            Event hinzufügen
          </button>
        }
      >
        <div className="space-y-3">
          {constraints.map((c) => (
            <div key={c.id} className="p-4 rounded-xl space-y-3" style={{ backgroundColor: '#f7f4ee' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={c.dayOfWeek}
                  onChange={(e) => updateConstraint(c.id, { dayOfWeek: Number(e.target.value) })}
                  style={{ ...inputStyle, padding: '6px 8px' }}
                >
                  {DAY_LABELS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                </select>
                <input
                  type="text" value={c.label}
                  onChange={(e) => updateConstraint(c.id, { label: e.target.value })}
                  style={{ ...inputStyle, flex: 1, minWidth: '96px', padding: '6px 8px' }}
                  placeholder="Event-Name"
                />
                <select
                  value={c.constraint}
                  onChange={(e) => updateConstraint(c.id, { constraint: e.target.value as DayConstraint['constraint'] })}
                  style={{ ...inputStyle, padding: '6px 8px' }}
                >
                  {Object.entries(CONSTRAINT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {c.constraint === 'maxTime' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" value={c.maxTimeMinutes ?? 30} min={5} max={120} step={5}
                      onChange={(e) => updateConstraint(c.id, { maxTimeMinutes: Number(e.target.value) })}
                      style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '6px 8px' }}
                    />
                    <span className="text-xs" style={{ color: '#9c8c84' }}>min</span>
                  </div>
                )}
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateConstraint(c.id, { color })}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: color,
                        transform: c.color === color ? 'scale(1.25)' : 'scale(1)',
                        outline: c.color === color ? '2px solid #9c8c84' : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => removeConstraint(c.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#9c8c84' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {constraints.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: '#9c8c84' }}>Noch keine Events. Klicke auf &quot;Event hinzufügen&quot;.</p>
          )}
        </div>
      </Section>

      <CatLabel label="App & Design" />
      {/* ── Theme picker ─────────────────────────────────────────────────── */}
      <Section id="theme" title="Design" sub="Sofort angewendet.">
        <div className="mz-theme-tiles">
          {THEME_DEFS.map((t) => {
            const activeTheme = toDataTheme(settings.theme as ThemeId);
            const isActive = activeTheme === t.dataTheme;
            return (
              <button
                key={t.id}
                onClick={() => {
                  const newSettings = { ...settings, theme: t.id as ThemeId };
                  setSettings(newSettings);
                  document.documentElement.setAttribute('data-theme', t.dataTheme);
                  try { localStorage.setItem('mz-theme', t.dataTheme); } catch {}
                }}
                className={`mz-theme-tile${isActive ? ' on' : ''}`}
              >
                <div className="mz-theme-preview" style={{ background: t.previewBg }}>
                  <div className="mz-theme-accent-bar" style={{ background: t.accentColor }} />
                  {isActive && (
                    <div className="mz-theme-check">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="mz-theme-info">
                  <span className="mz-theme-name">{t.label}</span>
                  <span className="mz-theme-mode">{t.mode}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Weather ──────────────────────────────────────────────────────── */}
      <Section id="weather" title="Standort und Wetter" sub="MahlZeit schlägt bei warmem Wetter leichte Gerichte vor — bei Kälte Wärmendes.">
        <div>
          <label style={labelStyle}>Standort</label>
          <div ref={locationWrapperRef} style={{ position: 'relative' }}>
            <input
              type="text"
              value={settings.weather.location}
              onChange={(e) => {
                const val = e.target.value;
                setSettings((s) => ({ ...s, weather: { ...s.weather, location: val } }));
                if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
                if (val.trim().length >= 2) {
                  setLocationLoading(true);
                  locationDebounceRef.current = setTimeout(() => fetchLocationSuggestions(val), 280);
                } else {
                  setLocationSuggestions([]);
                  setShowSuggestions(false);
                  setLocationLoading(false);
                }
              }}
              onFocus={() => { if (locationSuggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowSuggestions(false); }}
              placeholder="z.B. Luzern, Zürich, Bern …"
              style={{ ...inputStyle, width: '100%', paddingRight: locationLoading ? '30px' : undefined }}
              autoComplete="off"
            />
            {locationLoading && (
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9c8c84' }}>
                …
              </span>
            )}
            {showSuggestions && locationSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                backgroundColor: '#fff', border: '1px solid #e0d8ce', borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(44,36,32,0.12)', overflow: 'hidden',
              }}>
                {locationSuggestions.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSettings((s) => ({ ...s, weather: { ...s.weather, location: r.name } }));
                      setShowSuggestions(false);
                      setLocationSuggestions([]);
                    }}
                    className="w-full text-left px-4 py-2.5 transition-colors"
                    style={{ borderBottom: i < locationSuggestions.length - 1 ? '1px solid #f0ebe3' : 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f4ee'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#2c2420' }}>{r.name}</span>
                    {(r.admin1 || r.country) && (
                      <span style={{ fontSize: '11px', color: '#9c8c84', marginLeft: '6px' }}>
                        {[r.admin1, r.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Aktionen ─────────────────────────────────────────────────────── */}
      <Section id="promotions" title="Aktionen — Supermärkte" sub="Wähle deine Einkaufsläden. Zutaten im Angebot erscheinen grün markiert in der Einkaufsliste.">
        <div className="space-y-4">
          {/* Store toggle grid */}
          <div className="grid grid-cols-2 gap-2">
            {SWISS_STORES.map(({ id, name, color, bg }) => {
              const enabled = (settings.promotions?.enabledStores ?? []).includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSettings((s) => {
                      const current = s.promotions?.enabledStores ?? [];
                      const next = enabled
                        ? current.filter((x) => x !== id)
                        : [...current, id];
                      return { ...s, promotions: { ...s.promotions, enabledStores: next } };
                    });
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    border: enabled ? `1.5px solid ${color}` : '1.5px solid #e0d8ce',
                    backgroundColor: enabled ? bg : '#f7f4ee',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: enabled ? color : '#d0c8be' }}
                  />
                  <span className="text-sm font-medium flex-1" style={{ color: enabled ? '#2c2420' : '#9c8c84' }}>
                    {name}
                  </span>
                  {enabled && (
                    <span className="text-xs font-bold" style={{ color }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Refresh button + last-updated */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs" style={{ color: '#9c8c84' }}>
              {promoLastUpdated
                ? `Aktualisiert: ${new Date(promoLastUpdated).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Noch nicht aktualisiert'}
            </p>
            <button
              type="button"
              onClick={handlePromoRefresh}
              disabled={promoRefreshing || (settings.promotions?.enabledStores ?? []).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ backgroundColor: '#2c2420', color: '#fff', opacity: promoRefreshing ? 0.6 : 1 }}
            >
              <RefreshCw size={12} className={promoRefreshing ? 'animate-spin' : ''} />
              {promoRefreshing ? 'Lädt...' : 'Jetzt aktualisieren'}
            </button>
          </div>
          {promoError && (
            <p className="text-xs" style={{ color: '#c62828' }}>{promoError}</p>
          )}
        </div>
      </Section>

      <CatLabel label="Konto" />
      <div style={{ ...sectionCard, padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 style={h2Style}>Dein Plan</h2>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={isPremium
              ? { backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }
              : { backgroundColor: '#fef3cd', color: '#9a7a1e' }
            }
          >
            {PLAN_LABELS[userPlan] ?? userPlan}
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: '#9c8c84' }}>
          {isPremium
            ? userPlan === 'lifetime'
              ? 'Danke — du hast lebenslangen Zugang zu MahlZeit.'
              : 'Dein Abo ist aktiv.'
            : 'Kostenlose Testphase — upgrade für unbegrenzten Zugang.'
          }
        </p>

        {!isPremium && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {([
                { plan: 'abo',      name: 'Monatsabo',  price: 'CHF 4',   per: '/ Monat',       desc: 'Monatlich kündbar' },
                { plan: 'yearly',   name: 'Jahresabo',  price: 'CHF 40',  per: '/ Jahr',         desc: '2 Monate gratis' },
                { plan: 'lifetime', name: 'Lifetime',   price: 'CHF 129', per: 'einmalig',       desc: 'Für immer', featured: true },
              ] as const).map(({ plan, name, price, per, desc, ...rest }) => { const featured = 'featured' in rest && rest.featured; return (
                <button
                  key={plan}
                  onClick={() => handleCheckout(plan)}
                  disabled={checkoutLoading !== null}
                  className="flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all"
                  style={featured
                    ? { borderColor: '#d9543b', backgroundColor: '#fef7f5' }
                    : { borderColor: '#e0d8ce', backgroundColor: '#fff9f3' }
                  }
                >
                  {featured && (
                    <span className="text-[10px] font-bold uppercase tracking-wide mb-1.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d9543b', color: '#fff' }}>
                      Beliebt
                    </span>
                  )}
                  <p className="font-semibold text-sm" style={{ color: '#271f1a' }}>{name}</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: featured ? '#d9543b' : '#271f1a' }}>{price}</p>
                  <p className="text-xs" style={{ color: '#9a8c80' }}>{per} · {desc}</p>
                  <span
                    className="mt-3 w-full text-center text-xs font-semibold py-1.5 rounded-lg transition-opacity"
                    style={{
                      backgroundColor: featured ? '#d9543b' : '#271f1a',
                      color: '#fff',
                      opacity: checkoutLoading === plan ? 0.6 : 1,
                    }}
                  >
                    {checkoutLoading === plan ? 'Weiterleitung...' : 'Upgrade'}
                  </span>
                </button>
              );} )}
            </div>
            {checkoutError && (
              <p className="text-xs" style={{ color: '#c62828' }}>{checkoutError}</p>
            )}
          </>
        )}
      </div>

      {/* ── Familie & Mitglieder ─────────────────────────────────────────── */}
      {group && (
        <Section
          id="family"
          title="Familie & Mitglieder"
          sub={isOwner
            ? `Lade bis zu 5 Personen ein (aktuell ${members.length} Mitglied${members.length === 1 ? '' : 'er'}${pendingInvites.length ? `, ${pendingInvites.length} offene Einladung${pendingInvites.length === 1 ? '' : 'en'}` : ''}).`
            : `Du bist Mitglied der Gruppe "${group.name}".`
          }
        >
          <div className="space-y-5">
            {/* Notice banner */}
            {familyNotice && (
              <div className="px-3 py-2 rounded-xl text-xs" style={familyNotice.type === 'ok'
                ? { backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)', border: '1px solid var(--border)' }
                : { backgroundColor: '#fce4ec', color: '#c62828' }
              }>
                {familyNotice.text}
              </div>
            )}

            {/* Gruppennamen ändern (nur Owner) */}
            {isOwner && (
              <div>
                <label style={labelStyle}>
                  <Edit3 size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Familienname
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    maxLength={60}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="z.B. Familie Muster"
                  />
                  <button
                    onClick={handleRenameGroup}
                    disabled={renaming || groupName.trim() === group.name}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    {renaming ? '…' : 'Speichern'}
                  </button>
                </div>
              </div>
            )}

            {/* Aktuelle Mitglieder */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9c8c84' }}>
                Aktuelle Mitglieder ({members.length})
              </p>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.email} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ backgroundColor: '#f7f4ee' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: m.groupRole === 'owner' ? 'var(--accent)' : '#c49a6c', color: '#fff' }}>
                      {(m.firstName?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#2c2420' }}>
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: '#9c8c84' }}>{m.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={m.groupRole === 'owner'
                      ? { backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }
                      : { backgroundColor: '#f5ece0', color: '#c49a6c' }
                    }>
                      {m.groupRole === 'owner' ? 'Hauptuser' : 'Mitglied'}
                    </span>
                    {isOwner && m.groupRole !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(m.email)}
                        className="p-1 rounded-lg transition-colors"
                        style={{ color: '#9c8c84' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fce4ec'; (e.currentTarget as HTMLElement).style.color = '#c62828'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c8c84'; }}
                        title="Entfernen"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pending invites */}
            {pendingInvites.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9c8c84' }}>
                  Offene Einladungen ({pendingInvites.length})
                </p>
                <div className="space-y-2">
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ backgroundColor: '#fff3e0' }}>
                      <Mail size={14} style={{ color: '#e65100' }} />
                      <p className="text-sm flex-1 truncate" style={{ color: '#5a4e48' }}>{inv.email}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#ffe0b2', color: '#e65100' }}>
                        Wartet
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
                          className="p-1 rounded-lg" style={{ color: '#9c8c84' }}
                          title="Einladung zurückziehen"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite-Form: nur Owner mit Lifetime/Abo, max 5 total */}
            {isOwner && (
              isPremium ? (
                members.length + pendingInvites.length < 5 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9c8c84' }}>
                      Neue Person einladen
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleInvite()}
                        placeholder="email@beispiel.ch"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-80"
                        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                      >
                        <Mail size={12} />
                        {inviting ? '…' : 'Einladen'}
                      </button>
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: '#9c8c84' }}>
                      Die Person bekommt einen Link per E-Mail und kann ihren Namen + ein Passwort wählen.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
                    Maximum von 5 Personen erreicht. Entferne ein Mitglied, um eine neue Person einzuladen.
                  </p>
                )
              ) : (
                <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: '#efe9df', color: '#9c8c84' }}>
                  🔒 Einladungen sind nur für Lifetime- und Abo-Nutzer verfügbar.
                </p>
              )
            )}
          </div>
        </Section>
      )}

      {/* ── Konto löschen (Danger Zone) ─────────────────────────────────── */}
      <div style={{ ...sectionCard, padding: '20px 24px', borderColor: '#e8b4ab' }}>
        <h2 style={{ ...h2Style, color: '#c62828' }}>Konto löschen</h2>
        <p className="text-xs mt-1 mb-3" style={{ color: '#9c8c84' }}>
          {isOwner
            ? 'Dein Konto wird endgültig gelöscht. Deine Gruppe mit allen Rezepten und Plänen bleibt 30 Tage erhalten — Mitglieder werden informiert und können die Gruppe mit einem Abo übernehmen. Danach wird alles gelöscht.'
            : 'Dein Konto wird endgültig gelöscht. Die Gruppe und ihre Rezepte bleiben für die übrigen Mitglieder erhalten.'}
        </p>
        <button
          onClick={() => { setDeleteOpen(true); setDeletePw(''); setDeletePw2(''); setDeleteError(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ border: '1.5px solid #c62828', color: '#c62828', backgroundColor: 'transparent' }}
        >
          <Trash2 size={13} />
          Konto löschen…
        </button>
      </div>

      {/* Bestätigungsmodal Konto löschen */}
      {deleteOpen && (
        <div className="mz-modal-scrim" onClick={() => setDeleteOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-card)', padding: '24px 24px 20px',
              maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                Konto wirklich löschen?
              </h3>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--muted)', margin: '0 0 16px' }}>
              Dies kann nicht rückgängig gemacht werden. Gib zur Bestätigung zweimal dein Passwort ein.
            </p>
            <div className="space-y-2" style={{ marginBottom: 16 }}>
              <input
                type="password"
                placeholder="Passwort"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              />
              <input
                type="password"
                placeholder="Passwort wiederholen"
                value={deletePw2}
                onChange={(e) => setDeletePw2(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            {deleteError && (
              <p style={{ fontSize: 12, color: '#c62828', margin: '0 0 12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="mz-btn-soft" onClick={() => setDeleteOpen(false)}>
                Abbrechen
              </button>
              <button
                className="mz-btn-primary"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePw || deletePw !== deletePw2}
                style={{ background: '#c62828', opacity: deleteLoading || !deletePw || deletePw !== deletePw2 ? 0.5 : 1 }}
              >
                {deleteLoading ? 'Wird gelöscht…' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={saved
            ? { backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }
            : { backgroundColor: 'var(--accent)', color: '#fff' }
          }
        >
          <Save size={16} />
          {saved ? 'Gespeichert ✓' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
    </SectionCtx.Provider>
  );
}
