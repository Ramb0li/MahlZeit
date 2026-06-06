'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams }              from 'next/navigation';
import { useRouter, Link }              from '@/i18n/navigation';
import Image                             from 'next/image';

function AcceptInviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get('token') ?? '';

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [submitting,setSubmitting]= useState(false);
  const [info, setInfo] = useState<{ email: string; groupName: string; invitedBy: string } | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');

  // Token validieren beim Mount
  useEffect(() => {
    if (!token) { setError('Kein Einladungs-Token in der URL.'); setLoading(false); return; }
    (async () => {
      try {
        const res  = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Einladung ungültig.'); }
        else         { setInfo(data); }
      } finally { setLoading(false); }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return; }
    if (password.length < 8)   { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/accept-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, firstName, lastName, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      router.push(data.redirect ?? '/app');
    } finally { setSubmitting(false); }
  };

  const inputCls   = 'w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all';
  const inputStyle = { border: '1px solid #c8d8c8', backgroundColor: '#f2f6f2', color: '#2c2420' } as const;

  return (
    <div className="lp-login-page">
      <Link href="/" className="lp-login-back">← Zurück zur Startseite</Link>

      <div className="lp-login-card" style={{ maxWidth: 480 }}>
        <div className="lp-login-logo">
          <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={56} height={56} style={{ objectFit: 'contain' }} priority />
          <div className="lp-login-logo-text">
            Mahl<span style={{ color: '#b5614a' }}>Zeit</span>
          </div>
          <div className="lp-login-logo-sub">Einladung annehmen</div>
        </div>

        {loading && (
          <p className="text-center text-sm py-6" style={{ color: '#9c8c84' }}>
            Einladung wird geprüft…
          </p>
        )}

        {!loading && error && !info && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
            <strong>Einladung ungültig.</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>{error}</p>
          </div>
        )}

        {!loading && info && (
          <>
            <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#e8f2e8', color: '#2e5a32', border: '1px solid #c8d8c8' }}>
              <p style={{ fontSize: 14 }}>
                Du wurdest zur Gruppe <strong>{info.groupName}</strong> eingeladen.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>
                Einladung für <strong>{info.email}</strong>
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce4ec', color: '#c62828' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lp-login-label">Vorname</label>
                  <input className={inputCls} style={inputStyle} type="text" required
                    value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Max" />
                </div>
                <div>
                  <label className="lp-login-label">Nachname</label>
                  <input className={inputCls} style={inputStyle} type="text" required
                    value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Muster" />
                </div>
              </div>
              <div>
                <label className="lp-login-label">Passwort (mind. 8 Zeichen)</label>
                <input className={inputCls} style={inputStyle} type="password" autoComplete="new-password" required
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="lp-login-label">Passwort bestätigen</label>
                <input className={inputCls} style={inputStyle} type="password" autoComplete="new-password" required
                  value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: '#4a7a4e', color: '#fff', border: 'none', borderRadius: 12,
                  padding: '11px 0', fontSize: 14, fontWeight: 700, width: '100%',
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Wird beigetreten…' : `Beitreten zu "${info.groupName}" →`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteInner />
    </Suspense>
  );
}
