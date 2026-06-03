'use client';
import { useState, useEffect, useContext, createContext, useRef, useCallback } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Search, X, Users, Mail, Edit3 } from 'lucide-react';
import { THEME_DEFS, toDataTheme } from '@/lib/themes';
import type { ThemeId } from '@/lib/themes';
import type { AppSettings, DayConstraint, Child } from '@/types';
import type { Group, GroupRole } from '@/lib/groups';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CONSTRAINT_LABELS = {
  maxTime: 'Max. Zeit',
  mealprep: 'Mealprep',
  custom: 'Anpassen',
};

const ALLERGENS = [
  { id: 'gluten',       label: 'Gluten',       emoji: '🌾' },
  { id: 'weizen',       label: 'Weizen',        emoji: '🌾' },
  { id: 'laktose',      label: 'Laktose',       emoji: '🥛' },
  { id: 'milch',        label: 'Milch',         emoji: '🍼' },
  { id: 'ei',           label: 'Ei',            emoji: '🥚' },
  { id: 'fisch',        label: 'Fisch',         emoji: '🐟' },
  { id: 'schalentiere', label: 'Schalentiere',  emoji: '🦐' },
  { id: 'erdnüsse',     label: 'Erdnüsse',      emoji: '🥜' },
  { id: 'haselnüsse',   label: 'Haselnüsse',    emoji: '🌰' },
  { id: 'walnüsse',     label: 'Walnüsse',      emoji: '🌰' },
  { id: 'soja',         label: 'Soja',          emoji: '🫘' },
  { id: 'sesam',        label: 'Sesam',         emoji: '🌻' },
  { id: 'sellerie',     label: 'Sellerie',      emoji: '🥬' },
  { id: 'senf',         label: 'Senf',          emoji: '🟡' },
  { id: 'lupinen',      label: 'Lupinen',       emoji: '🌿' },
  { id: 'alkohol',      label: 'Alkohol',       emoji: '🍷' },
  { id: 'fruktose',     label: 'Fruktose',      emoji: '🍬' },
  { id: 'sorbit',       label: 'Sorbit',        emoji: '🍬' },
] as const;

const PRESET_AVERSIONS = ['Schweinefleisch', 'Fisch', 'Ersatzprodukte', 'Koriander', 'Rosenkohl', 'Pilze'];

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
  '#4a7a4e', '#b5614a', '#c49a6c', '#5a4e48',
  '#2e7d32', '#1565c0', '#ad1457', '#00695c',
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
  group?: Group | null;
  groupRole?: GroupRole;
  onSettingsChange?: (settings: AppSettings) => void;
  onConstraintsChange?: (constraints: DayConstraint[]) => void;
  onGroupChange?: (group: Group) => void;
}

export function SettingsView({
  initialSettings,
  initialConstraints,
  isPremium = false,
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
  const [aversionSearch, setAversionSearch] = useState('');

  // Weather autocomplete
  interface GeoResult { name: string; admin1?: string; country?: string; latitude: number; longitude: number; }
  const [locationSuggestions, setLocationSuggestions] = useState<GeoResult[]>([]);
  const [locationLoading, setLocationLoading]         = useState(false);
  const [showSuggestions, setShowSuggestions]         = useState(false);
  const locationWrapperRef = useRef<HTMLDivElement>(null);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedLocationRef = useRef(initialSettings.weather?.location ?? '');

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
    const newC: DayConstraint = { id: `c-${Date.now()}`, dayOfWeek: 1, label: 'Neues Event', color: '#4a7a4e', mealType: 'dinner', constraint: 'maxTime', maxTimeMinutes: 30 };
    setConstraints((prev) => [...prev, newC]);
    setOpenSections(prev => new Set([...Array.from(prev), 'constraints']));
  };

  const updateConstraint = (id: string, updates: Partial<DayConstraint>) =>
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));

  const removeConstraint = (id: string) =>
    setConstraints((prev) => prev.filter((c) => c.id !== id));

  const handleSave = async () => {
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

  return (
    <SectionCtx.Provider value={{ openSections, toggleSection }}>
    <div className="max-w-2xl space-y-3">

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
                ? { backgroundColor: '#e8f2e8', color: '#2e5a32', border: '1px solid #c8d8c8' }
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
                    style={{ backgroundColor: '#4a7a4e', color: '#fff' }}
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
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: m.groupRole === 'owner' ? '#4a7a4e' : '#c49a6c', color: '#fff' }}>
                      {(m.firstName?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#2c2420' }}>
                        {m.firstName} {m.lastName}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: '#9c8c84' }}>{m.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={m.groupRole === 'owner'
                      ? { backgroundColor: '#e8f2e8', color: '#4a7a4e' }
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
                        style={{ backgroundColor: '#4a7a4e', color: '#fff' }}
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

      {/* ── Meal toggles ─────────────────────────────────────────────────── */}
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
                  ? { borderColor: '#4a7a4e', backgroundColor: '#e8f2e8' }
                  : { borderColor: '#e0d8ce', opacity: 0.55 }
                }
              >
                <span className="text-2xl">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: isActive ? '#4a7a4e' : '#2c2420' }}>{label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9c8c84' }}>{isActive ? 'Aktiv' : 'Ausgeblendet'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Week switch day ──────────────────────────────────────────────── */}
      <Section id="weekswitch" title="Wochenansicht" sub="Ab welchem Wochentag soll automatisch die nächste Woche angezeigt werden?">
        <div className="flex flex-wrap gap-2">
          {WEEK_SWITCH_OPTIONS.map(({ value, label }) => {
            const isActive = (settings.weekSwitchDay ?? 0) === value;
            return (
              <button
                key={value}
                onClick={() => setSettings(s => ({ ...s, weekSwitchDay: value }))}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2"
                style={isActive
                  ? { borderColor: '#4a7a4e', backgroundColor: '#e8f2e8', color: '#4a7a4e' }
                  : { borderColor: '#e0d8ce', color: '#5a4e48' }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-3" style={{ color: '#9c8c84' }}>
          Standard: Sonntag — ab Sonntag wird die nächste Woche angezeigt.
        </p>
      </Section>

      {/* ── Diet preference ──────────────────────────────────────────────── */}
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
                  ? { borderColor: '#4a7a4e', backgroundColor: '#e8f2e8' }
                  : { borderColor: '#e0d8ce' }
                }
              >
                <span className="text-2xl">{emoji}</span>
                <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? '#4a7a4e' : '#2c2420' }}>{label}</p>
                <p className="text-[10px]" style={{ color: '#9c8c84' }}>{sub}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Allergien & Abneigungen ──────────────────────────────────────── */}
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
              {/* Allergen chips */}
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
                        <span>{emoji}</span>
                        {label}
                        {active && <X size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aversions */}
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
                        {p}
                        {active && <X size={10} />}
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
                      {id}
                      <X size={10} />
                    </button>
                  ))}
                </div>

                {/* Search / add custom aversion */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9c8c84' }} />
                  <input
                    type="text"
                    value={aversionSearch}
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

      {/* ── Household ────────────────────────────────────────────────────── */}
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
              <button onClick={addChild} className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: '#4a7a4e' }}>
                <Plus size={14} />
                Kind hinzufügen
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
          <p className="text-xs mt-1" style={{ color: '#9c8c84' }}>
            Wetterdaten via{' '}
            <a href="https://open-meteo.com" target="_blank" rel="noopener" className="transition-colors hover:underline" style={{ color: '#4a7a4e' }}>
              open-meteo.com
            </a>{' '}
            · Kostenlos, kein API-Key nötig.
          </p>
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
            style={{ color: '#4a7a4e' }}
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

      {/* ── Aktionen ─────────────────────────────────────────────────────── */}
      <Section id="promotions" title="Aktionen (manuelle Eingabe)" sub="Aktuelle Aktionen bei Migros, Coop oder Lidl eintragen.">
        <div>
          {(['migros', 'coop', 'lidl'] as const).map((store) => (
            <div key={store} className="mb-4">
              <label style={labelStyle} className="capitalize">{store}</label>
              <textarea
                value={settings.promotions[`manual${store.charAt(0).toUpperCase() + store.slice(1)}` as keyof typeof settings.promotions]?.join('\n') ?? ''}
                onChange={(e) => {
                  const items = e.target.value.split('\n').filter((x) => x.trim());
                  const key = `manual${store.charAt(0).toUpperCase() + store.slice(1)}` as 'manualMigros' | 'manualCoop' | 'manualLidl';
                  setSettings((s) => ({ ...s, promotions: { ...s.promotions, [key]: items } }));
                }}
                rows={2}
                placeholder="Je ein Produkt pro Zeile (z.B. Lachsfilet)"
                style={{ ...inputStyle, width: '100%', resize: 'none' }}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Save button */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={saved
            ? { backgroundColor: '#e8f2e8', color: '#4a7a4e' }
            : { backgroundColor: '#4a7a4e', color: '#fff' }
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
