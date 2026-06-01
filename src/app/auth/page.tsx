'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter }    from 'next/navigation';
import Link                              from 'next/link';
import Image                             from 'next/image';

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

  // Query-param Banner (Confirm-Flow)
  const confirmed  = params.get('confirmed') === '1';
  const tokenError = params.get('error'); // 'invalid_token' | 'expired_token'

  // Passwort-Reset via URL-Token
  const resetToken = params.get('token');
  const isResetMode = params.get('mode') === 'reset' && !!resetToken;

  const [tab,     setTab]     = useState<'login' | 'register'>(initialTab);
  const [mode,    setMode]    = useState<'default' | 'forgot' | 'reset'>(
    isResetMode ? 'reset' : 'default',
  );
  const [plan,    setPlan]    = useState<'trial' | 'lifetime' | 'abo'>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Pending confirmation (nach Register oder Login mit unbestätigter E-Mail)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending,    setResending]    = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  // Login fields
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');

  // Forgot-password fields
  const [forgotEmail,    setForgotEmail]    = useState('');
  const [forgotSent,     setForgotSent]     = useState(false);

  // Reset-password fields
  const [resetPw,        setResetPw]        = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resetDone,      setResetDone]      = useState(false);

  useEffect(() => {
    const p = params.get('plan') as 'trial' | 'lifetime' | 'abo' | null;
    if (p) { setPlan(p); setTab('register'); }
  }, [params]);

  /* ── Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setResendNotice(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsConfirmation && data.email) setPendingEmail(data.email);
        setError(data.error ?? 'Fehler');
        return;
      }
      setPendingEmail(null);
      router.push(data.redirect ?? '/app');
    } finally { setLoading(false); }
  };

  /* ── Register ── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setResendNotice('');
    if (regPassword !== regConfirm) { setError('Passwörter stimmen nicht überein.'); return; }
    if (regPassword.length < 8)     { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ firstName, lastName, email: regEmail, password: regPassword, plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      if (data.pendingConfirmation) { setPendingEmail(data.email ?? regEmail); setTab('login'); return; }
      if (data.stripeUrl) { window.location.href = data.stripeUrl; return; }
      if (data.redirect)  { router.push(data.redirect); }
    } finally { setLoading(false); }
  };

  /* ── Resend confirmation ── */
  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true); setResendNotice('');
    try {
      const res  = await fetch('/api/auth/resend-confirmation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      setResendNotice(res.ok ? 'Bestätigungs-E-Mail wurde erneut gesendet.' : (data.error ?? 'Fehler beim Versand'));
    } finally { setResending(false); }
  };

  /* ── Forgot password ── */
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email: forgotEmail }),
      });
      // Immer Erfolg zeigen — kein Info-Leak ob E-Mail existiert
      setForgotSent(true);
    } finally { setLoading(false); }
  };

  /* ── Reset password ── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (resetPw !== resetPwConfirm) { setError('Passwörter stimmen nicht überein.'); return; }
    if (resetPw.length < 8)         { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ token: resetToken, password: resetPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      setResetDone(true);
    } finally { setLoading(false); }
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: '#b5614a', color: '#fff', border: 'none',
    borderRadius: '12px', padding: '11px 0', fontSize: '14px',
    fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1, width: '100%',
  };
  const linkBtn: React.CSSProperties = {
    color: '#b5614a', fontSize: 13, fontWeight: 600,
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  };

  return (
    <div className="lp-login-page">
      <Link href="/" className="lp-login-back">← Zurück zur Startseite</Link>

      <div className="lp-login-card" style={{ maxWidth: 480 }}>

        {/* Logo */}
        <div className="lp-login-logo">
          <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={56} height={56} style={{ objectFit: 'contain' }} priority />
          <div className="lp-login-logo-text">
            Mahl<span style={{ color: '#b5614a' }}>Zeit</span>
          </div>
          <div className="lp-login-logo-sub">Menüplaner</div>
        </div>

        {/* ── PASSWORT ZURÜCKSETZEN (via Link aus E-Mail) ── */}
        {mode === 'reset' && (
          <>
            {resetDone ? (
              <div className="space-y-4 text-center">
                <div className="text-4xl">✅</div>
                <p className="font-semibold" style={{ color: '#2c2420' }}>Passwort gespeichert!</p>
                <p className="text-sm" style={{ color: '#9c8c84' }}>
                  Du kannst dich jetzt mit deinem neuen Passwort anmelden.
                </p>
                <button style={btnStyle} onClick={() => { setMode('default'); setResetDone(false); }}>
                  Zur Anmeldung →
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-semibold mb-1" style={{ color: '#2c2420' }}>
                  Neues Passwort festlegen
                </h2>
                <p className="text-sm mb-5" style={{ color: '#9c8c84' }}>
                  Wähle ein sicheres Passwort mit mindestens 8 Zeichen.
                </p>
                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="lp-login-label">Neues Passwort</label>
                    <StyledInput
                      type="password" autoComplete="new-password" placeholder="••••••••"
                      value={resetPw} onChange={(e) => setResetPw(e.target.value)} required
                    />
                  </div>
                  <div>
                    <label className="lp-login-label">Passwort bestätigen</label>
                    <StyledInput
                      type="password" autoComplete="new-password" placeholder="••••••••"
                      value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)} required
                    />
                  </div>
                  <button type="submit" style={btnStyle} disabled={loading}>
                    {loading ? 'Wird gespeichert…' : 'Passwort speichern →'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* ── PASSWORT VERGESSEN (E-Mail eingeben) ── */}
        {mode === 'forgot' && (
          <>
            {forgotSent ? (
              <div className="space-y-4">
                <div
                  className="px-4 py-4 rounded-xl text-sm flex items-start gap-3"
                  style={{ backgroundColor: '#eef4ee', color: '#2e5a32', border: '1px solid #c8d8c8' }}
                >
                  <span style={{ fontSize: 20 }}>📧</span>
                  <div>
                    <strong>Falls diese Adresse bekannt ist, haben wir einen Link gesendet.</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>
                      Bitte prüfe dein Postfach (auch Spam-Ordner). Der Link ist 1 Stunde gültig.
                    </p>
                  </div>
                </div>
                <button
                  style={{ ...linkBtn, display: 'block', marginTop: 8 }}
                  onClick={() => { setMode('default'); setForgotSent(false); setForgotEmail(''); }}
                >
                  ← Zurück zur Anmeldung
                </button>
              </div>
            ) : (
              <>
                <button
                  style={{ ...linkBtn, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => { setMode('default'); setError(''); }}
                >
                  ← Zurück
                </button>
                <h2 className="text-base font-semibold mb-1" style={{ color: '#2c2420' }}>
                  Passwort vergessen?
                </h2>
                <p className="text-sm mb-5" style={{ color: '#9c8c84' }}>
                  Gib deine E-Mail-Adresse ein. Falls sie bei uns registriert ist,
                  erhältst du einen Link zum Zurücksetzen.
                </p>
                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="lp-login-label">E-Mail</label>
                    <StyledInput
                      type="email" autoComplete="email" placeholder="deine@email.ch"
                      value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required
                    />
                  </div>
                  <button type="submit" style={btnStyle} disabled={loading}>
                    {loading ? 'Wird gesendet…' : 'Reset-Link senden →'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* ── STANDARD-MODUS: Login / Register ── */}
        {mode === 'default' && (
          <>
            {/* Confirm-Flow Banner */}
            {confirmed && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
                style={{ backgroundColor: '#e8f2e8', color: '#2e5a32', border: '1px solid #c8d8c8' }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <div>
                  <strong>E-Mail bestätigt!</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>Du kannst dich jetzt anmelden.</p>
                </div>
              </div>
            )}
            {tokenError === 'invalid_token' && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                <strong>Ungültiger Bestätigungslink.</strong>
                <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>Bitte fordere unten einen neuen Link an.</p>
              </div>
            )}
            {tokenError === 'expired_token' && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
                <strong>Link abgelaufen.</strong>
                <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>
                  Der Bestätigungslink war nur 24 Stunden gültig — bitte logge dich ein und fordere einen neuen Link an.
                </p>
              </div>
            )}

            {/* Pending-Confirmation Hinweis */}
            {pendingEmail && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: '#eef4ee', color: '#2e5a32', border: '1px solid #c8d8c8' }}>
                <strong>📧 Bitte E-Mail prüfen und bestätigen</strong>
                <p style={{ margin: '4px 0 8px', fontSize: 13, opacity: 0.85 }}>
                  Wir haben dir einen Bestätigungslink an <strong>{pendingEmail}</strong> gesendet.
                </p>
                <button onClick={handleResend} disabled={resending} className="text-xs font-semibold underline"
                  style={{ color: '#4a7a4e', cursor: resending ? 'not-allowed' : 'pointer', opacity: resending ? 0.6 : 1 }}>
                  {resending ? 'Wird gesendet…' : 'E-Mail erneut senden'}
                </button>
                {resendNotice && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4a7a4e' }}>{resendNotice}</p>}
              </div>
            )}

            {/* Tabs */}
            <div className="flex rounded-2xl p-1 mb-6" style={{ backgroundColor: '#efe9df' }}>
              {(['login', 'register'] as const).map((t) => (
                <button key={t} onClick={() => { setTab(t); setError(''); }}
                  className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
                  style={tab === t
                    ? { backgroundColor: '#fff9f3', color: '#2c2420', boxShadow: '0 1px 6px rgba(44,36,32,0.10)' }
                    : { color: '#9c8c84', backgroundColor: 'transparent' }}>
                  {t === 'login' ? 'Anmelden' : 'Registrieren'}
                </button>
              ))}
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                {error}
              </div>
            )}

            {/* ── LOGIN FORM ── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="lp-login-label">E-Mail</label>
                  <StyledInput type="email" autoComplete="email" placeholder="deine@email.ch"
                    value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="lp-login-label">Passwort</label>
                  <StyledInput type="password" autoComplete="current-password" placeholder="••••••••"
                    value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  {/* Passwort vergessen Link */}
                  <div className="text-right mt-1">
                    <button type="button" style={linkBtn}
                      onClick={() => { setMode('forgot'); setError(''); setForgotEmail(loginEmail); }}>
                      Passwort vergessen?
                    </button>
                  </div>
                </div>
                <button type="submit" style={btnStyle} disabled={loading}>
                  {loading ? 'Anmelden…' : 'Anmelden →'}
                </button>
              </form>
            )}

            {/* ── REGISTER FORM ── */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="lp-login-label">Vorname</label>
                    <StyledInput type="text" placeholder="Max" value={firstName}
                      onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="lp-login-label">Nachname</label>
                    <StyledInput type="text" placeholder="Muster" value={lastName}
                      onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="lp-login-label">E-Mail</label>
                  <StyledInput type="email" autoComplete="email" placeholder="deine@email.ch"
                    value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="lp-login-label">Passwort (mind. 8 Zeichen)</label>
                  <StyledInput type="password" autoComplete="new-password" placeholder="••••••••"
                    value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="lp-login-label">Passwort bestätigen</label>
                  <StyledInput type="password" autoComplete="new-password" placeholder="••••••••"
                    value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} required />
                </div>
                <div>
                  <label className="lp-login-label" style={{ marginBottom: 8 }}>Plan wählen</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PLANS.map((p) => (
                      <button key={p.id} type="button" onClick={() => setPlan(p.id)}
                        className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-all"
                        style={plan === p.id
                          ? { border: `2px solid ${p.color}`, backgroundColor: `${p.color}18` }
                          : { border: '1.5px solid #e0d8ce', backgroundColor: '#f7f4ee' }}>
                        <span style={{ fontSize: 20 }}>{p.icon}</span>
                        <span className="text-xs font-bold" style={{ color: plan === p.id ? p.color : '#2c2420' }}>{p.name}</span>
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
          </>
        )}

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
