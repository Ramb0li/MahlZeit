import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';

const COLLAGE = [
  { cls: 'mz-cc1', src: '/images/recipes/cuiselin-taboule.jpeg',             alt: 'Taboulé'           },
  { cls: 'mz-cc2', src: '/images/recipes/cuiselin-gurken-ananas-salat.jpeg', alt: 'Gurken-Ananas-Salat'},
  { cls: 'mz-cc3', src: '/images/recipes/cuiselin-granola.jpg',              alt: 'Granola'            },
  { cls: 'mz-cc4', src: '/images/recipes/cuiselin-pesto-genovese.jpg',       alt: 'Pesto Genovese'    },
];

const WEEK = [
  { name: 'Mo', meal: 'Overnight Oats',  sub: '5 min',   today: false },
  { name: 'Di', meal: 'Pasta al Limone', sub: '25 min',  today: true  },
  { name: 'Mi', meal: 'Buddha Bowl',     sub: '20 min',  today: false },
  { name: 'Do', meal: 'Gemüse Curry',    sub: '35 min',  today: false },
  { name: 'Fr', meal: 'Pizza Bianca',    sub: '30 min',  today: false },
  { name: 'Sa', meal: 'Risotto',         sub: '40 min',  today: false },
  { name: 'So', meal: 'Linsensuppe',     sub: '25 min',  today: false },
];

const REVIEWS = [
  { text: '«Endlich plane ich die Woche durch — kein tägliches Grübeln mehr. Die Einkaufsliste spart mir jedes Mal Zeit.»', name: 'Sarah M.',  role: 'Mutter, Basel'     },
  { text: '«Ich esse seit MahlZeit viel abwechslungsreicher. Die Rezeptvorschläge passen wirklich zu mir — und alles ist vegan.»', name: 'Lukas B.',  role: 'Student, Zürich'   },
  { text: '«Das UI ist aufgeräumt und es läuft. Ich habe viele Apps ausprobiert — MahlZeit ist die erste, die ich täglich nutze.»', name: 'Mia K.',    role: 'Grafikerin, Bern'  },
];

const PLANS = [
  {
    badge: 'Gratis starten', name: 'Testwoche', cur: 'CHF', amount: '0', per: '7 Tage kostenlos',
    desc: 'Voller Zugang. Kein Kreditkarteneintrag.',
    features: ['Wochenplaner', 'Rezeptbibliothek', 'Einkaufsliste', 'KI-Vorschläge'],
    href: '/auth?plan=trial', featured: false,
  },
  {
    badge: 'Flexibel', name: 'Monatsabo', cur: 'CHF', amount: '3', per: '/ Monat · kündbar',
    desc: 'Monatlich kündbar.',
    features: ['Alles aus Testwoche', 'Unbegrenzte Rezepte', 'PDF-Export', 'Kündigung jederzeit'],
    href: '/auth?plan=abo', featured: false,
  },
  {
    badge: 'Beliebteste Wahl', name: 'Lifetime', cur: 'CHF', amount: '99', per: 'einmalig · für immer',
    desc: 'Einmal zahlen, für immer nutzen. Alle Updates inklusive.',
    features: ['Alles aus Jahresabo', 'Alle zukünftigen Features', 'Keine Folgekosten', 'Priority Support'],
    href: '/auth?plan=lifetime', featured: true,
  },
  {
    badge: 'Bester Wert', name: 'Jahresabo', cur: 'CHF', amount: '30', per: '/ Jahr · 2 Monate gratis',
    desc: 'Spare gegenüber dem Monatsabo.',
    features: ['Alles aus Monatsabo', 'Priorisierter Support', '2 Monate gespart', 'Exklusive Rezepte'],
    href: '/auth?plan=yearly', featured: false,
  },
];

export default function LandingPage() {
  return (
    <div className="mz-lp">

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="mz-lp-nav">
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={28} height={28} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/auth" className="mz-lp-login">Anmelden</Link>
          <Link href="/auth?plan=trial" className="mz-btn-primary" style={{ fontSize: 14, padding: '9px 18px' }}>
            Gratis starten
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="mz-lp-hero">
        <div>
          <div className="mz-lp-kicker">
            <div className="mz-lp-kicker-dot" />
            Dein schlauer Menüplaner
          </div>
          <h1 className="mz-lp-h1">
            Deine Woche.<br /><em>Dein</em> Essen.
          </h1>
          <p className="mz-lp-lead">
            MahlZeit erstellt deinen Wochenplan, schlägt Rezepte vor und schreibt
            automatisch deine Einkaufsliste. Alles verknüpft. Alles automatisiert.
          </p>
          <div className="mz-lp-hero-cta">
            <Link href="/auth?plan=trial" className="mz-btn-primary lg">
              7 Tage gratis testen
            </Link>
            <Link href="#features" className="mz-btn-soft lg" style={{ padding: '14px 22px', fontSize: 15 }}>
              Mehr erfahren
            </Link>
          </div>
          <p className="mz-lp-hero-note" style={{ marginTop: 14 }}>
            Kein Abo-Zwang · 🇨🇭 Made in Switzerland
          </p>
        </div>

        <div className="mz-lp-hero-collage">
          {COLLAGE.map(({ cls, src, alt }) => (
            <div
              key={cls}
              className={`mz-cc ${cls}`}
              style={{ backgroundImage: `url(${src})` }}
              aria-label={alt}
            />
          ))}
          <div className="mz-cc-badge">
            <span className="mz-cc-badge-num">172+</span>
            <span>Rezepte</span>
          </div>
        </div>
      </div>

      {/* ── Statement ─────────────────────────────────────────────────── */}
      <div className="mz-lp-statement">
        <h2>Schluss mit der Frage<br />«<em>Was koche ich heute?</em>»</h2>
      </div>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <div className="mz-lp-features" id="features">
        <p className="mz-eyebrow">Was dich erwartet</p>
        <h2 className="mz-lp-h2" style={{ marginTop: 10 }}>
          Alles, was du für<br />deine Woche <em>brauchst.</em>
        </h2>
        <div className="mz-lp-feat-grid">
          {[
            { n: '01', title: 'Smarte Vorschläge',       text: 'MahlZeit schlägt Gerichte vor, die zu deinen Vorlieben, der Saison und dem Wetter passen. Kein Kopfzerbrechen mehr.' },
            { n: '02', title: 'Wochenplaner',             text: 'Sieben Tage, alle Mahlzeiten, übersichtlich dargestellt. Änderungen aktualisieren die Einkaufsliste sofort.' },
            { n: '03', title: 'Rezeptbibliothek',         text: '172+ Rezepte von @cuiseline, kuratiert und laufend erweitert. Eigene Rezepte hinzufügen und importieren.' },
            { n: '04', title: 'Automatische Einkaufsliste', text: 'Alle Zutaten des Wochenplans, zusammengefasst nach Kategorien. Als PDF exportieren oder direkt teilen.' },
          ].map(({ n, title, text }) => (
            <div key={n} className="mz-lp-feat">
              <div className="mz-lp-feat-num">{n}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full-bleed image ───────────────────────────────────────────── */}
      <div
        className="mz-lp-bleed"
        style={{ backgroundImage: 'url(/images/recipes/cuiselin-taboule.jpeg)' }}
      >
        <div className="mz-lp-bleed-card">
          <span className="mz-lp-bleed-tag">Heute Abend</span>
          <div className="mz-lp-bleed-name">Taboulé</div>
          <div className="mz-lp-bleed-meta">20 min · Vegan · Frischer Levante-Salat</div>
        </div>
      </div>

      {/* ── Week preview ──────────────────────────────────────────────── */}
      <div className="mz-lp-week">
        <p className="mz-eyebrow">Wochenplan</p>
        <h2 className="mz-lp-h2" style={{ marginTop: 10 }}>
          Deine Woche, <em>geplant.</em>
        </h2>
        <div className="mz-lp-week-grid">
          {WEEK.map(({ name, meal, sub, today }) => (
            <div key={name} className={`mz-lp-wd${today ? ' today' : ''}`}>
              <div className="mz-lp-wd-day">{name}</div>
              <div className="mz-lp-wd-meal">{meal}</div>
              <div className="mz-lp-wd-sub">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-col: recipe highlight ─────────────────────────────────── */}
      <div className="mz-lp-two">
        <div
          className="mz-lp-two-img"
          style={{ backgroundImage: 'url(/images/recipes/cuiselin-pesto-genovese.jpg)' }}
        />
        <div className="mz-lp-two-txt">
          <p className="mz-eyebrow">Rezepte die passen</p>
          <h3 style={{ marginTop: 10 }}>
            Nicht irgendwelche Rezepte — <em>deine.</em>
          </h3>
          <p>
            Saisonal, wetterabhängig, auf deine Diät und deine Familie abgestimmt.
            Sonnig? MahlZeit schlägt leichte Sommerküche vor.
          </p>
          <div className="mz-lp-tagrow">
            {['🌱 Vegan', '⏱ Unter 30 Min', '🔥 Saisonal', '💪 Proteinreich', '👨‍👩‍👧 Familienküche'].map(tag => (
              <span key={tag} className="mz-chip" style={{ cursor: 'default' }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reviews ───────────────────────────────────────────────────── */}
      <div className="mz-lp-reviews">
        <p className="mz-eyebrow" style={{ textAlign: 'center' }}>Stimmen</p>
        <h2 className="mz-lp-h2" style={{ marginTop: 10, textAlign: 'center' }}>
          Was <em>andere</em> sagen.
        </h2>
        <div className="mz-lp-rev-grid" style={{ marginTop: 32 }}>
          {REVIEWS.map(({ text, name, role }) => (
            <div key={name} className="mz-lp-rev">
              <div className="mz-lp-stars">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.4 6.1 21l1.2-6.5L2.5 9.9l6.6-1z" />
                  </svg>
                ))}
              </div>
              <p>{text}</p>
              <div className="mz-lp-rev-author">
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-tint)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                  {name.slice(0, 1)}
                </div>
                <div>
                  {name}
                  <em>{role}</em>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <div className="mz-lp-pricing" id="pricing">
        <p className="mz-eyebrow" style={{ color: 'rgba(255,255,255,.6)' }}>Preise</p>
        <h2 className="mz-lp-h2" style={{ color: '#fff', marginTop: 10 }}>
          Einfach. Fair. Dein Preis.
        </h2>
        <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 17, marginTop: 14 }}>
          Starte kostenlos — wähle danach was zu dir passt.
        </p>
        <div className="mz-lp-plans">
          {PLANS.map((p) => (
            <div key={p.name} className={`mz-lp-plan${p.featured ? ' featured' : ''}`}>
              <span className="mz-lp-plan-badge">{p.badge}</span>
              <div className="mz-lp-plan-name">{p.name}</div>
              <div className="mz-lp-plan-price">
                <span className="mz-lp-plan-cur">{p.cur}</span>
                <span className="mz-lp-plan-amt">{p.amount}</span>
              </div>
              <div className="mz-lp-plan-per">{p.per}</div>
              <p className="mz-lp-plan-desc">{p.desc}</p>
              <ul className="mz-lp-plan-feats">
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={14} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={p.featured ? 'mz-btn-primary' : 'mz-btn-ghost-light'} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '11px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
                {p.featured ? 'Jetzt kaufen →' : 'Auswählen →'}
              </Link>
            </div>
          ))}
        </div>
        <p className="mz-lp-trust">
          🔒 Sichere Zahlung via Stripe &nbsp;·&nbsp; 🇨🇭 Made in Switzerland &nbsp;·&nbsp; Kein Abo-Zwang bei Lifetime
        </p>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="mz-lp-footer">
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={24} height={24} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
          </span>
        </Link>
        <div className="mz-lp-foot-links">
          <a>Datenschutz</a>
          <a>Impressum</a>
          <a>Nutzungsbedingungen</a>
          <a>Kontakt</a>
        </div>
        <span className="mz-lp-foot-copy">© 2025 MahlZeit · @cuiseline</span>
      </footer>

      {/* ── Mobile sticky CTA ─────────────────────────────────────────── */}
      <div className="mz-lp-mobile-cta">
        <Link href="/auth?plan=trial" className="mz-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          7 Tage gratis testen
        </Link>
        <p className="mz-lp-mobile-cta-note">Kein Kreditkarteneintrag nötig</p>
      </div>

    </div>
  );
}
