'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter }    from 'next/navigation';
import Link                              from 'next/link';
import Image                             from 'next/image';
import { ChevronLeft, X }                from 'lucide-react';
import type { LandingPlan }              from '@/lib/content';

/* ─── Plan cards ─────────────────────────────────────────────────────────── */

type PlanId = 'trial' | 'abo' | 'yearly' | 'lifetime';

type AuthPlan = { id: PlanId; star: string; name: string; price: string; per: string; feat: string; featured?: boolean };

function cmsToAuthPlan(p: LandingPlan): AuthPlan {
  const id  = (p.href.match(/[?&]plan=([^&]+)/)?.[1] ?? 'trial') as PlanId;
  const price = p.amount === '0' ? 'Gratis' : `${p.cur} ${p.amount}`;
  return {
    id,
    star:     p.badge,
    name:     p.name,
    price,
    per:      p.per,
    feat:     p.features[0] ?? p.desc,
    featured: p.featured,
  };
}

const COLLAGE_IMGS = [
  '/images/recipes/cuiselin-taboule.jpeg',
  '/images/recipes/cuiselin-pesto-genovese.jpg',
  '/images/recipes/cuiselin-granola.jpg',
  '/images/recipes/cuiselin-gruener-linsensalat.jpg',
];

/* ─── Banner helper ──────────────────────────────────────────────────────── */

function Banner({ type, children, onClose }: { type: 'success' | 'error' | 'warn'; children: React.ReactNode; onClose?: () => void }) {
  const colors = {
    success: { bg: '#e8f2e8', border: '#c8d8c8', color: '#2e5a32' },
    error:   { bg: '#fce4ec', border: '#f5c0c0', color: '#c62828' },
    warn:    { bg: '#fff3e0', border: '#f5d8a0', color: '#e65100' },
  }[type];
  return (
    <div className="mz-auth-banner" style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.color }}>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && (
        <button onClick={onClose} style={{ flexShrink: 0, color: 'inherit', opacity: 0.7 }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ─── Auth form inner ─────────────────────────────────────────────────────── */

function AuthInnerContent({ cmsPlans }: { cmsPlans: LandingPlan[] }) {
  const params = useSearchParams();
  const router = useRouter();

  const PLANS = cmsPlans.map(cmsToAuthPlan);

  const initialTab  = params.get('tab') === 'register' ? 'register' : 'login';
  const initialPlan = (params.get('plan') as PlanId) ?? 'trial';

  const confirmed     = params.get('confirmed') === '1';
  const setupSuccess  = params.get('setup') === '1';
  const stripeError   = params.get('stripe_error') === '1';
  const tokenError    = params.get('error');
  const resetToken    = params.get('token');
  const isSetupMode   = params.get('setup') === '1' && !!resetToken;
  const isResetMode   = params.get('mode') === 'reset' && !!resetToken;

  const [tab,     setTab]     = useState<'login' | 'register'>(initialTab);
  const [mode,    setMode]    = useState<'default' | 'forgot' | 'reset'>(isResetMode ? 'reset' : 'default');
  const [plan,    setPlan]    = useState<PlanId>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending,    setResending]    = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm,  setRegConfirm]  = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent,  setForgotSent]  = useState(false);

  const [resetPw,        setResetPw]        = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resetDone,      setResetDone]      = useState(false);

  useEffect(() => {
    const p = params.get('plan') as PlanId | null;
    if (p) { setPlan(p); setTab('register'); }
  }, [params]);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setResendNotice('');
    if (!isPaidPlan) {
      if (regPassword !== regConfirm) { setError('Passwörter stimmen nicht überein.'); return; }
      if (regPassword.length < 8)     { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    }
    setLoading(true);
    try {
      const body: Record<string, string> = { firstName, lastName, email: regEmail, plan };
      if (!isPaidPlan) body.password = regPassword;
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      if (data.pendingConfirmation) { setPendingEmail(data.email ?? regEmail); setTab('login'); return; }
      if (data.stripeUrl) { window.location.href = data.stripeUrl; return; }
      if (data.redirect)  { router.push(data.redirect); }
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true); setResendNotice('');
    try {
      const res  = await fetch('/api/auth/resend-confirmation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      setResendNotice(res.ok ? 'E-Mail wurde erneut gesendet.' : (data.error ?? 'Fehler beim Versand'));
    } finally { setResending(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } finally { setLoading(false); }
  };

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
      // Neues Konto nach Stripe-Zahlung: direkt weiterleiten
      if (data.redirect) { window.location.href = data.redirect; return; }
      setResetDone(true);
    } finally { setLoading(false); }
  };

  const isPaidPlan = plan !== 'trial';

  const submitLabel =
    loading          ? 'Wird verarbeitet…'   :
    tab === 'login'  ? 'Anmelden →'          :
    plan === 'trial' ? 'Kostenlos starten →' :
    'Weiter zu Stripe →';

  return (
    <div className="mz-auth-bg">
      {/* Food-photo background collage */}
      <div className="mz-auth-collage">
        {COLLAGE_IMGS.map((src, i) => (
          <div key={i} className="mz-auth-col-cell" style={{ backgroundImage: `url(${src})` }} />
        ))}
      </div>
      <div className="mz-auth-scrim" />

      {/* Back link */}
      <Link href="/" className="mz-auth-back">
        <ChevronLeft size={14} />
        Startseite
      </Link>

      <div className="mz-auth-card">

        {/* Logo */}
        <div className="mz-auth-logo">
          <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={52} height={52} style={{ objectFit: 'contain' }} priority />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
          </span>
          <span className="mz-auth-logo-sub">Familienmenüplaner</span>
        </div>

        {/* ── RESET PASSWORD (via email link) ── */}
        {mode === 'reset' && (
          <div className="mz-auth-form">
            {resetDone ? (
              <>
                <Banner type="success">
                  <strong>Passwort gespeichert!</strong> Du kannst dich jetzt anmelden.
                </Banner>
                <button className="mz-btn-primary mz-auth-submit" onClick={() => { setMode('default'); setResetDone(false); }}>
                  Zur Anmeldung →
                </button>
              </>
            ) : (
              <>
                <div className="mz-auth-forgot-head">
                  <h3>{isSetupMode ? 'Konto einrichten' : 'Neues Passwort'}</h3>
                  <p>{isSetupMode
                    ? 'Fast geschafft! Lege dein Passwort fest und lege direkt los.'
                    : 'Wähle ein sicheres Passwort mit mindestens 8 Zeichen.'
                  }</p>
                </div>
                {error && <Banner type="error" onClose={() => setError('')}>{error}</Banner>}
                <form onSubmit={handleReset} className="mz-auth-form">
                  <div className="mz-auth-field">
                    <label>Neues Passwort</label>
                    <input type="password" autoComplete="new-password" placeholder="••••••••" value={resetPw} onChange={e => setResetPw(e.target.value)} required />
                  </div>
                  <div className="mz-auth-field">
                    <label>Passwort bestätigen</label>
                    <input type="password" autoComplete="new-password" placeholder="••••••••" value={resetPwConfirm} onChange={e => setResetPwConfirm(e.target.value)} required />
                  </div>
                  <button type="submit" className="mz-btn-primary mz-auth-submit" disabled={loading}>
                    {loading ? 'Wird gespeichert…' : 'Passwort speichern →'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <div className="mz-auth-form">
            {forgotSent ? (
              <>
                <Banner type="success">
                  <strong>Falls diese Adresse bekannt ist, haben wir einen Link gesendet.</strong>
                  <br /><span style={{ fontSize: 12, opacity: 0.85 }}>Bitte prüfe dein Postfach (auch Spam). Der Link ist 1 Stunde gültig.</span>
                </Banner>
                <button className="mz-auth-link" onClick={() => { setMode('default'); setForgotSent(false); setForgotEmail(''); }}>
                  <ChevronLeft size={13} /> Zurück zur Anmeldung
                </button>
              </>
            ) : (
              <>
                <div className="mz-auth-forgot-head">
                  <h3>Passwort vergessen?</h3>
                  <p>Gib deine E-Mail ein. Falls sie bei uns registriert ist, erhältst du einen Reset-Link.</p>
                </div>
                {error && <Banner type="error" onClose={() => setError('')}>{error}</Banner>}
                <form onSubmit={handleForgot} className="mz-auth-form">
                  <div className="mz-auth-field">
                    <label>E-Mail</label>
                    <input type="email" autoComplete="email" placeholder="deine@email.ch" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                  </div>
                  <button type="submit" className="mz-btn-primary mz-auth-submit" disabled={loading}>
                    {loading ? 'Wird gesendet…' : 'Reset-Link senden →'}
                  </button>
                </form>
                <button className="mz-auth-link" onClick={() => { setMode('default'); setError(''); }}>
                  <ChevronLeft size={13} /> Zurück
                </button>
              </>
            )}
          </div>
        )}

        {/* ── DEFAULT: Login / Register ── */}
        {mode === 'default' && (
          <>
            {confirmed && (
              <Banner type="success" onClose={() => {}}>
                <strong>E-Mail bestätigt!</strong> Du kannst dich jetzt anmelden.
              </Banner>
            )}
            {setupSuccess && !resetToken && (
              <Banner type="success" onClose={() => {}}>
                <strong>Zahlung erfolgreich!</strong> Wir haben dir eine E-Mail mit deinem Einrichtungslink gesendet. Bitte prüfe dein Postfach.
              </Banner>
            )}
            {stripeError && (
              <Banner type="error" onClose={() => {}}>
                <strong>Zahlung konnte nicht verarbeitet werden.</strong> Bitte versuche es erneut oder kontaktiere uns.
              </Banner>
            )}
            {tokenError === 'invalid_token' && (
              <Banner type="error">
                <strong>Ungültiger Bestätigungslink.</strong> Bitte fordere unten einen neuen an.
              </Banner>
            )}
            {tokenError === 'expired_token' && (
              <Banner type="warn">
                <strong>Link abgelaufen.</strong> Bitte logge dich ein und fordere einen neuen Link an.
              </Banner>
            )}
            {pendingEmail && (
              <Banner type="success">
                <strong>E-Mail bestätigen</strong>
                <br />Wir haben einen Bestätigungslink an <strong>{pendingEmail}</strong> gesendet.
                <br />
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{ marginTop: 6, fontSize: 12, fontWeight: 600, textDecoration: 'underline', color: 'inherit', opacity: resending ? 0.6 : 1 }}
                >
                  {resending ? 'Wird gesendet…' : 'E-Mail erneut senden'}
                </button>
                {resendNotice && <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{resendNotice}</span>}
              </Banner>
            )}

            {/* Tabs */}
            <div className="mz-auth-tabs">
              {(['login', 'register'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={`mz-auth-tab${tab === t ? ' on' : ''}`}
                >
                  {t === 'login' ? 'Anmelden' : 'Registrieren'}
                </button>
              ))}
            </div>

            {error && <Banner type="error" onClose={() => setError('')}>{error}</Banner>}

            {/* ── LOGIN FORM ── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="mz-auth-form">
                <div className="mz-auth-field">
                  <label>E-Mail</label>
                  <input type="email" autoComplete="email" placeholder="deine@email.ch"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                </div>
                <div className="mz-auth-field">
                  <label>Passwort</label>
                  <input type="password" autoComplete="current-password" placeholder="••••••••"
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  <button
                    type="button"
                    className="mz-auth-link"
                    style={{ alignSelf: 'flex-end', marginTop: 4, fontSize: 12 }}
                    onClick={() => { setMode('forgot'); setError(''); setForgotEmail(loginEmail); }}
                  >
                    Passwort vergessen?
                  </button>
                </div>
                <button type="submit" className="mz-btn-primary mz-auth-submit" disabled={loading}>
                  {loading ? 'Anmelden…' : 'Anmelden →'}
                </button>
                <div className="mz-auth-divider">oder</div>
                <button type="button" className="mz-auth-skip" onClick={() => setTab('register')}>
                  Noch kein Konto? Jetzt registrieren →
                </button>
              </form>
            )}

            {/* ── REGISTER FORM ── */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="mz-auth-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="mz-auth-field">
                    <label>Vorname</label>
                    <input type="text" placeholder="Max" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="mz-auth-field">
                    <label>Nachname</label>
                    <input type="text" placeholder="Muster" value={lastName} onChange={e => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="mz-auth-field">
                  <label>E-Mail</label>
                  <input type="email" autoComplete="email" placeholder="deine@email.ch"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                </div>
                {!isPaidPlan && (
                  <>
                    <div className="mz-auth-field">
                      <label>Passwort (mind. 8 Zeichen)</label>
                      <input type="password" autoComplete="new-password" placeholder="••••••••"
                        value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                    </div>
                    <div className="mz-auth-field">
                      <label>Passwort bestätigen</label>
                      <input type="password" autoComplete="new-password" placeholder="••••••••"
                        value={regConfirm} onChange={e => setRegConfirm(e.target.value)} required />
                    </div>
                  </>
                )}

                {/* Plan selection */}
                <div>
                  <p className="mz-auth-plans-lbl">Plan wählen</p>
                  <div className="mz-auth-plans-row">
                    {PLANS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        className={`mz-auth-plan${p.featured ? ' feat' : ''}${plan === p.id ? ' on' : ''}`}
                      >
                        <span className="mz-auth-plan-star">{p.star}</span>
                        <span className="mz-auth-plan-name">{p.name}</span>
                        <span className="mz-auth-plan-price">{p.price}</span>
                        <span className="mz-auth-plan-per">{p.per}</span>
                        <span className="mz-auth-plan-feat">{p.feat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" className="mz-btn-primary mz-auth-submit" disabled={loading}>
                  {submitLabel}
                </button>
                <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--muted)', margin: 0 }}>
                  {isPaidPlan
                    ? 'Sichere Zahlung via Stripe · Passwort wird nach Zahlung per E-Mail eingerichtet'
                    : '7 Tage gratis · kein automatisches Upgrade'}
                </p>
                <div className="mz-auth-divider">oder</div>
                <button type="button" className="mz-auth-skip" onClick={() => setTab('login')}>
                  Bereits registriert? Anmelden →
                </button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
}

/* ─── Suspense wrapper (exported) ────────────────────────────────────────── */

export function AuthInner({ cmsPlans }: { cmsPlans: LandingPlan[] }) {
  return (
    <Suspense>
      <AuthInnerContent cmsPlans={cmsPlans} />
    </Suspense>
  );
}
