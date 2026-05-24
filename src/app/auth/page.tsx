'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter }    from 'next/navigation';
import Link                              from 'next/link';

/* ─── Plan cards ─────────────────────────────────────────────────────────── */

const PLANS = [
  {
    id:      'trial' as const,
    icon:    '🎁',
    name:    'Testwoche',
    price:   'Gratis',
    detail:  '7 Tage kostenlos · kein Kreditkarteneintrag',
    color:   '#c49a6c',
  },
  {
    id:      'lifetime' as const,
    icon:    '⭐',
    name:    'Lifetime',
    price:   'CHF 35',
    detail:  'einmalig · für immer · alle Updates',
    color:   '#b5614a',
    featured: true,
  },
  {
    id:      'abo' as const,
    icon:    '📅',
    name:    'Monatsabo',
    price:   'CHF 3/Mt.',
    detail:  'jederzeit kündbar',
    color:   '#5a4e48',
  },
];

/* ─── Input style ─────────────────────────────────────────────────────────── */

const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all';
const inputStyle = {
  border:          '1px solid #e0d8ce',
  backgroundColor: '#f7f4ee',
  color:           '#2c2420',
};
const inputFocusStyle = {
  border:          '1.5px solid #b5614a',
  backgroundColor: '#fff9f3',
};

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className={inputCls}
      style={focused ? inputFocusStyle : inputStyle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

/* ─── Auth form inner ─────────────────────────────────────────────────────── */

function AuthInner() {
  const params = useSearchParams();
  const router = useRouter();

  const initialTab  = params.get('tab') === 'register' ? 'register' : 'login';
  const initialPlan = (params.get('plan') as 'trial' | 'lifetime' | 'abo') ?? 'trial';

  const [tab,       setTab]       = useState<'login' | 'register'>(initialTab);
  const [plan,      setPlan]      = useState<'trial' | 'lifetime' | 'abo'>(initialPlan);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Login fields
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [regEmail,     setRegEmail]     = useState('');
  const [regPassword,  setRegPassword]  = useState('');
  const [regConfirm,   setRegConfirm]   = useState('');

  useEffect(() => {
    const p = params.get('plan') as 'trial' | 'lifetime' | 'abo' | null;
    if (p) { setPlan(p); setTab('register'); }
  }, [params]);

  /* ── Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      router.push(data.redirect ?? '/app');
    } finally {
      setLoading(false);
    }
  };

  /* ── Register ── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword !== regConfirm) { setError('Passwörter stimmen nicht überein.'); return; }
    if (regPassword.length < 8)     { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ firstName, lastName, email: regEmail, password: regPassword, plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      if (data.stripeUrl)  { window.location.href = data.stripeUrl; return; }
      if (data.redirect)   { router.push(data.redirect); }
    } finally {
      setLoading(false);
    }
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: '#b5614a',
    color:           '#fff',
    border:          'none',
    borderRadius:    '12px',
    padding:         '11px 0',
    fontSize:        '14px',
    fontWeight:      700,
    cursor:          loading ? 'not-allowed' : 'pointer',
    opacity:         loading ? 0.7 : 1,
    width:           '100%',
  };

  return (
    <div className="lp-login-page">

      {/* Back link */}
      <Link href="/" className="lp-login-back">← Zurück zur Startseite</Link>

      <div className="lp-login-card" style={{ maxWidth: 480 }}>

        {/* Logo */}
        <div className="lp-login-logo">
          <div className="lp-login-logo-icon">🍽</div>
          <div className="lp-login-logo-text">
            Mahl<span style={{ color: '#b5614a' }}>Zeit</span>
          </div>
          <div className="lp-login-logo-sub">Menüplaner</div>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-2xl p-1 mb-6"
          style={{ backgroundColor: '#efe9df' }}
        >
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
              style={tab === t
                ? { backgroundColor: '#fff9f3', color: '#2c2420', boxShadow: '0 1px 6px rgba(44,36,32,0.10)' }
                : { color: '#9c8c84', backgroundColor: 'transparent' }}
            >
              {t === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: '#fce4ec', color: '#c62828' }}
          >
            {error}
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="lp-login-label">E-Mail</label>
              <StyledInput
                type="email"
                autoComplete="email"
                placeholder="deine@email.ch"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lp-login-label">Passwort</label>
              <StyledInput
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'Anmelden…' : 'Anmelden →'}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lp-login-label">Vorname</label>
                <StyledInput
                  type="text" placeholder="Max" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} required
                />
              </div>
              <div>
                <label className="lp-login-label">Nachname</label>
                <StyledInput
                  type="text" placeholder="Muster" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="lp-login-label">E-Mail</label>
              <StyledInput
                type="email" autoComplete="email" placeholder="deine@email.ch"
                value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required
              />
            </div>

            {/* Password */}
            <div>
              <label className="lp-login-label">Passwort (mind. 8 Zeichen)</label>
              <StyledInput
                type="password" autoComplete="new-password" placeholder="••••••••"
                value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required
              />
            </div>

            {/* Confirm */}
            <div>
              <label className="lp-login-label">Passwort bestätigen</label>
              <StyledInput
                type="password" autoComplete="new-password" placeholder="••••••••"
                value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} required
              />
            </div>

            {/* Plan selector */}
            <div>
              <label className="lp-login-label" style={{ marginBottom: 8 }}>Plan wählen</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-all"
                    style={plan === p.id
                      ? { border: `2px solid ${p.color}`, backgroundColor: `${p.color}18` }
                      : { border: '1.5px solid #e0d8ce', backgroundColor: '#f7f4ee' }}
                  >
                    <span style={{ fontSize: 20 }}>{p.icon}</span>
                    <span className="text-xs font-bold" style={{ color: plan === p.id ? p.color : '#2c2420' }}>
                      {p.name}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: p.color }}>{p.price}</span>
                    <span className="text-[10px] leading-tight" style={{ color: '#9c8c84' }}>{p.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'Wird verarbeitet…'
                : plan === 'trial'    ? 'Kostenlos starten →'
                : plan === 'lifetime' ? 'Jetzt kaufen (CHF 35) →'
                : 'Abo starten (CHF 3/Mt.) →'}
            </button>

            <p className="text-[11px] text-center" style={{ color: '#9c8c84' }}>
              {plan === 'trial'
                ? '7 Tage gratis, danach wähle ein Abo — kein automatisches Upgrade.'
                : 'Du wirst nach dem Klick zu Stripe weitergeleitet. 🔒 Sichere Zahlung.'}
            </p>
          </form>
        )}

        {/* Footer links */}
        <div className="lp-login-footer" style={{ marginTop: 24 }}>
          {tab === 'login'
            ? <span>Noch kein Konto? <button onClick={() => setTab('register')} className="font-semibold" style={{ color: '#b5614a' }}>Registrieren</button></span>
            : <span>Bereits registriert? <button onClick={() => setTab('login')} className="font-semibold" style={{ color: '#b5614a' }}>Anmelden</button></span>
          }
        </div>

      </div>
    </div>
  );
}

/* ─── Page wrapper with Suspense for useSearchParams ─────────────────────── */

export default function AuthPage() {
  return (
    <Suspense>
      <AuthInner />
    </Suspense>
  );
}
