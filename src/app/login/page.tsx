import Link from 'next/link';

export const metadata = {
  title: 'Anmelden · MahlZeit',
};

export default function LoginPage() {
  return (
    <div className="lp-login-page">

      {/* Back link */}
      <Link href="/" className="lp-login-back">
        ← Zurück zur Startseite
      </Link>

      <div className="lp-login-card">

        {/* Logo */}
        <div className="lp-login-logo">
          <div className="lp-login-logo-icon">🍽</div>
          <div className="lp-login-logo-text">
            Mahl<span style={{ color: '#b5614a' }}>Zeit</span>
          </div>
          <div className="lp-login-logo-sub">Menüplaner</div>
        </div>

        {/* Heading */}
        <div className="lp-login-heading">Willkommen zurück</div>
        <div className="lp-login-sub">
          Melde dich mit deinen Zugangsdaten an.
        </div>

        {/* Form — action wired up once auth is live */}
        <form method="post" action="/api/auth/login">
          <div className="lp-login-field">
            <label className="lp-login-label" htmlFor="email">E-Mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="deine@email.ch"
              className="lp-login-input"
              required
            />
          </div>

          <div className="lp-login-field">
            <label className="lp-login-label" htmlFor="password">Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="lp-login-input"
              required
            />
          </div>

          {/* Temporary: go straight to planner until auth is wired */}
          <Link href="/planner" className="lp-login-btn">
            Anmelden →
          </Link>
        </form>

        <div className="lp-login-divider">oder</div>

        {/* New account CTA */}
        <Link href="#pricing" className="lp-login-alt">
          Noch kein Konto? Jetzt gratis starten
        </Link>

        {/* Forgot password */}
        <div className="lp-login-footer">
          <Link href="#">Passwort vergessen?</Link>
          {' · '}
          <Link href="/">Zur Startseite</Link>
        </div>

      </div>
    </div>
  );
}
