import Link from 'next/link';

/* ─── Static data ──────────────────────────────────────────────────── */

const PHOTO_CELLS = [
  { cls: 'lp-food-hero-1',                     image: '/images/recipes/cuiselin-taboule.jpeg',              alt: 'Taboulé'              },
  { cls: 'lp-food-hero-3 lp-photo-cell-center', image: '/images/recipes/cuiselin-pesto-genovese.jpg',       alt: 'Pesto Genovese'       },
  { cls: 'lp-food-hero-2',                     image: '/images/recipes/cuiselin-gurken-ananas-salat.jpeg',  alt: 'Gurken-Ananas-Salat'  },
  { cls: 'lp-food-hero-2',                     image: '/images/recipes/cuiselin-granola.jpg',                alt: 'Granola'               },
  { cls: 'lp-food-hero-1',                     image: '/images/recipes/cuiselin-gruener-linsensalat.jpg',   alt: 'Grüner Linsensalat'   },
];

const MOCK_SHOPPING = [
  { done: true,  name: 'Pasta',        qty: '500g'   },
  { done: true,  name: 'Zitronen',     qty: '3×'     },
  { done: false, name: 'Avocados',     qty: '2×'     },
  { done: false, name: 'Kichererbsen', qty: '1 Dose' },
  { done: false, name: 'Haferflocken', qty: '1kg'    },
];

const MOCK_WEEK = [
  { name: 'Mo', meal: 'Overnight Oats', sub: 'Linsensuppe',  today: false },
  { name: 'Di', meal: 'Birchermüesli',  sub: 'Pasta Limone', today: true  },
  { name: 'Mi', meal: 'Avocado Toast',  sub: 'Buddha Bowl',  today: false },
  { name: 'Do', meal: 'Smoothie Bowl',  sub: 'Gemüse Curry', today: false },
  { name: 'Fr', meal: 'Porridge',       sub: 'Pizza Bianca', today: false },
  { name: 'Sa', meal: 'Pancakes',       sub: 'Risotto',      today: false },
  { name: 'So', meal: 'French Toast',   sub: 'Tajine',       today: false },
];

const REVIEWS = [
  { text: '"Endlich plane ich die Woche durch — kein tägliches Grübeln mehr was ich kochen soll. Die Einkaufsliste spart mir jedes Mal Zeit."', name: 'Sarah M.',  handle: 'Beta-Testerin', emoji: '👩'    },
  { text: '"Ich esse seit MahlZeit viel abwechslungsreicher. Die Rezeptvorschläge sind wirklich gut — und alles ist vegan."',                 name: 'Lukas B.',  handle: 'Beta-Tester',   emoji: '🧑'    },
  { text: '"Das UI ist so aufgeräumt. Ich habe viele Apps ausprobiert — MahlZeit ist die erste, die ich wirklich täglich nutze."',           name: 'Mia K.',    handle: 'Beta-Testerin', emoji: '👩‍💼' },
  { text: '"Die Verknüpfung von Wochenplan und Einkaufsliste ist das Killer-Feature. Einfach genialer Ansatz."',                             name: 'Tobias R.', handle: 'Beta-Tester',   emoji: '👨‍🍳' },
];

const PLANS = [
  {
    badge: 'Gratis starten',
    badgeMuted: true,
    icon: '🎁',
    name: 'Testwoche',
    amount: '0',
    free: true,
    currency: 'CHF',
    period: '7 Tage kostenlos',
    desc: 'Voller Zugang. Kein Kreditkarteneintrag. Danach wähle ein Abo.',
    features: [
      'Wochenplaner (7 Tage)',
      'Rezeptbibliothek',
      'Automatische Einkaufsliste',
      'Wetter-Vorschläge',
    ],
    btn: 'Jetzt gratis testen →',
    btnStyle: 'ghost',
    href: '/planner',
  },
  {
    badge: 'Beliebteste Wahl',
    badgeMuted: false,
    icon: '⭐',
    name: 'Lifetime',
    amount: '35',
    free: false,
    currency: 'CHF',
    period: 'einmalig · für immer',
    desc: 'Einmal zahlen, für immer nutzen. Alle zukünftigen Updates inklusive.',
    features: [
      'Alles aus der Testwoche',
      'Unbegrenzte Rezepte',
      'PDF-Export & Drucken',
      'Alle zukünftigen Features',
    ],
    btn: 'Jetzt kaufen →',
    btnStyle: 'secondary',
    href: '/login',
    featured: true,
  },
  {
    badge: 'Flexibel',
    badgeMuted: true,
    icon: '📅',
    name: 'Monatsabo',
    amount: '3',
    free: false,
    currency: 'CHF',
    period: '/ Monat · jederzeit kündbar',
    desc: 'Monatlich kündbar. Ideal wenn du erst reinschnuppern möchtest.',
    features: [
      'Alles aus der Testwoche',
      'Unbegrenzte Rezepte',
      'PDF-Export & Drucken',
      'Kündigung jederzeit',
    ],
    btn: 'Abo starten →',
    btnStyle: 'primary',
    href: '/login',
  },
];

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="lp-page">

      {/* ══════════════════════════════════════════════════════════════
          HERO — full viewport
      ══════════════════════════════════════════════════════════════ */}
      <div className="lp-full-hero">

        {/* Fixed nav */}
        <nav className="lp-full-hero-nav">
          <Link href="/" className="lp-nav-logo">Mahl<em>Zeit</em></Link>
          <Link href="/login" className="lp-nav-login">Anmelden</Link>
        </nav>

        {/* Stage */}
        <div className="lp-full-hero-stage">

          {/* Food-photo collage */}
          <div className="lp-photo-grid">
            {PHOTO_CELLS.map(({ cls, image, alt }, i) => (
              <div
                key={i}
                className={`lp-photo-cell ${cls}`}
                style={{
                  backgroundImage: `url(${image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                aria-label={alt}
              />
            ))}
          </div>

          {/* Frosted-glass logo */}
          <div className="lp-hero-logo-panel">
            <div className="lp-hero-logo-icon">🍽</div>
            <div className="lp-hero-logo-text">
              Mahl<span style={{ color: '#b5614a' }}>Zeit</span>
            </div>
            <div className="lp-hero-logo-sub">Menüplaner</div>
          </div>

          {/* Scroll hint */}
          <div className="lp-scroll-hint">Mehr entdecken</div>

          {/* Bottom-right CTA — scrolls to pricing */}
          <div className="lp-corner-cta">
            <Link href="#pricing" className="lp-corner-cta-btn">
              Bereit für deinen persönlichen Menüplaner? →
            </Link>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          STATEMENT — "Deine Woche. Dein Essen."
      ══════════════════════════════════════════════════════════════ */}
      <div className="lp-statement">
        <div className="lp-statement-h1">
          Deine Woche.<br />
          <em>Dein</em> Essen.
        </div>
        <p className="lp-statement-sub">
          MahlZeit plant deinen Wochenplan, schlägt Rezepte vor und erstellt
          automatisch deine Einkaufsliste. Alles verknüpft. Alles einfach.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════════ */}
      <div className="lp-wrap" id="features">
        <div className="lp-section">
          <span className="lp-label">Was dich erwartet</span>
          <h2 style={{ marginTop: 12 }}>
            Alles, was du<br />für deine Woche<br /><em>brauchst.</em>
          </h2>
          <ul className="lp-feature-list">
            <li className="lp-feature-item">
              <div className="lp-feature-num">01</div>
              <div className="lp-feature-content">
                <h3>Smarte Menü-Vorschläge</h3>
                <p>MahlZeit schlägt dir Gerichte vor, die zu deinen Vorlieben, der Saison und deinem Vorrat passen. Kein Kopfzerbrechen mehr — einfach auswählen und loslegen.</p>
              </div>
            </li>
            <li className="lp-feature-item">
              <div className="lp-feature-num">02</div>
              <div className="lp-feature-content">
                <h3>Wochenplaner auf einen Blick</h3>
                <p>Sieben Tage, alle Mahlzeiten, übersichtlich dargestellt. Automatisch ausgewogen. Änderungen aktualisieren sofort die Einkaufsliste.</p>
              </div>
            </li>
            <li className="lp-feature-item">
              <div className="lp-feature-num">03</div>
              <div className="lp-feature-content">
                <h3>Deine Rezeptbibliothek</h3>
                <p>Speichere deine Lieblingsrezepte mit Anleitungen, Zutaten und Variationen — von @cuiseline kuratiert und laufend erweitert.</p>
              </div>
            </li>
            <li className="lp-feature-item">
              <div className="lp-feature-num">04</div>
              <div className="lp-feature-content">
                <h3>Automatische Einkaufsliste</h3>
                <p>Alle Zutaten deines Wochenplans — zusammengefasst, nach Kategorien sortiert, direkt aufs Handy. Kein Vergessen mehr, kein doppeltes Kaufen.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Full-bleed banner */}
      <div className="lp-full-img">
        <div
          className="lp-full-img-inner"
          style={{
            backgroundImage: 'url(/images/recipes/cuiselin-taboule.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="lp-food-img-overlay">
            <div>
              <div className="lp-food-img-title">Taboulé</div>
              <div className="lp-food-img-meta">20 min · Vegan · Frischer Levante-Salat</div>
            </div>
            <div className="lp-food-img-tag">Heute Abend</div>
          </div>
        </div>
      </div>

      {/* App mockup + week preview */}
      <div className="lp-wrap">
        <div className="lp-section">
          <span className="lp-label">Wochenplan</span>
          <h2 style={{ marginTop: 12 }}>Deine Woche,<br /><em>geplant.</em></h2>
          <p style={{ marginTop: 12, maxWidth: 440 }}>Ein Blick, und du weisst was auf den Tisch kommt.</p>

          {/* App mockup */}
          <div className="lp-hero-mockup" style={{ marginTop: 32 }}>
            <div className="lp-hero-mockup-inner">
              <div className="lp-mock-nav">
                <div className="lp-mock-logo">Mahl<em>Zeit</em></div>
                <div className="lp-mock-pills">
                  <div className="lp-mock-pill active">Wochenplan</div>
                  <div className="lp-mock-pill">Rezepte</div>
                  <div className="lp-mock-pill">Einkaufen</div>
                </div>
              </div>
              <div className="lp-mock-body">
                <div className="lp-mock-col">
                  <div className="lp-mock-col-label">Heute · Di</div>
                  <div className="lp-mock-meal featured">
                    <div className="lp-mock-meal-emoji">🍝</div>
                    <div>
                      <div className="lp-mock-meal-name">Pasta al Limone</div>
                      <div className="lp-mock-meal-meta">Abend · 25 min</div>
                    </div>
                  </div>
                  <div className="lp-mock-meal">
                    <div className="lp-mock-meal-emoji">🥣</div>
                    <div>
                      <div className="lp-mock-meal-name">Overnight Oats</div>
                      <div className="lp-mock-meal-meta">Morgen · 5 min</div>
                    </div>
                  </div>
                </div>
                <div className="lp-mock-col">
                  <div className="lp-mock-col-label">Mi – Do</div>
                  <div className="lp-mock-meal">
                    <div className="lp-mock-meal-emoji">🥗</div>
                    <div>
                      <div className="lp-mock-meal-name">Buddha Bowl</div>
                      <div className="lp-mock-meal-meta">Mi Abend</div>
                    </div>
                  </div>
                  <div className="lp-mock-meal">
                    <div className="lp-mock-meal-emoji">🍛</div>
                    <div>
                      <div className="lp-mock-meal-name">Gemüse Curry</div>
                      <div className="lp-mock-meal-meta">Do Abend</div>
                    </div>
                  </div>
                </div>
                <div className="lp-mock-col">
                  <div className="lp-mock-col-label">Einkaufsliste</div>
                  {MOCK_SHOPPING.map(({ done, name, qty }) => (
                    <div key={name} className="lp-mock-shop-item">
                      <div className={`lp-mock-check${done ? ' done' : ''}`}>{done ? '✓' : ''}</div>
                      <span className={`lp-mock-shop-name${done ? ' done' : ''}`}>{name}</span>
                      <span className="lp-mock-shop-qty">{qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Week preview */}
          <div className="lp-week-preview" style={{ marginTop: 32 }}>
            <div className="lp-wp-header">
              <div className="lp-wp-title">KW 21 · Mai 2025</div>
              <Link href="/planner" className="lp-wp-action">Plan anpassen →</Link>
            </div>
            <div className="lp-wp-grid">
              {MOCK_WEEK.map(({ name, meal, sub, today }) => (
                <div key={name} className={`lp-wp-day${today ? ' today' : ''}`}>
                  <div className="lp-wp-day-name">{name}{today ? ' — Heute' : ''}</div>
                  <div className="lp-wp-meal">{meal}</div>
                  <div className="lp-wp-meal-sm">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two-col: recipes */}
        <div className="lp-two-col">
          <div
            className="lp-two-col-img"
            style={{
              backgroundImage: 'url(/images/recipes/cuiselin-pesto-genovese.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="lp-two-col-text">
            <h3>Rezepte,<br />die <em>passen.</em></h3>
            <p>Nicht irgendwelche Rezepte — sondern solche, die zu deinen Vorlieben, der Zeit und der Saison passen.</p>
            <div className="lp-tag-row">
              <span className="lp-tag-pill">🌱 Vegan</span>
              <span className="lp-tag-pill warm">⏱ Unter 30 Min</span>
              <span className="lp-tag-pill">🔥 Saisonal</span>
              <span className="lp-tag-pill warm">💪 Proteinreich</span>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="lp-section">
          <span className="lp-label">Bewertungen</span>
          <h2 style={{ marginTop: 12 }}><em>Was andere</em><br />sagen.</h2>
          <div className="lp-reviews-grid">
            {REVIEWS.map(({ text, name, handle, emoji }) => (
              <div key={name} className="lp-review-card">
                <div className="lp-review-stars">★★★★★</div>
                <div className="lp-review-text">{text}</div>
                <div className="lp-review-author">
                  <div className="lp-review-avatar">{emoji}</div>
                  <div>
                    <div className="lp-review-name">{name}</div>
                    <div className="lp-review-handle">{handle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════════════════ */}
      <div className="lp-pricing" id="pricing">
        <div className="lp-pricing-wrap">
          <div className="lp-pricing-label">Preise</div>
          <div className="lp-pricing-headline">Einfach. Fair. Dein Preis.</div>
          <p className="lp-pricing-sub">
            Starte kostenlos und wähle danach, was zu dir passt.
          </p>

          <div className="lp-pricing-cards">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`lp-plan-card${plan.featured ? ' featured' : ''}`}>
                <div className={`lp-plan-badge${plan.badgeMuted ? ' muted' : ''}`}>{plan.badge}</div>
                <span className="lp-plan-icon">{plan.icon}</span>
                <div className="lp-plan-name">{plan.name}</div>
                <div className="lp-plan-price">
                  <span className="lp-plan-currency">{plan.currency}</span>
                  <span className={`lp-plan-amount${plan.free ? ' free' : ''}`}>{plan.amount}</span>
                </div>
                <div className="lp-plan-period">{plan.period}</div>
                <p className="lp-plan-desc">{plan.desc}</p>
                <ul className="lp-plan-features">
                  {plan.features.map((f) => (
                    <li key={f} className="lp-plan-feature">
                      <div className="lp-plan-check">✓</div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`lp-plan-btn ${plan.btnStyle}`}>
                  {plan.btn}
                </Link>
              </div>
            ))}
          </div>

          <div className="lp-pricing-trust">
            🔒 Sichere Zahlung via Stripe &nbsp;·&nbsp; 🇨🇭 Made in Switzerland
            &nbsp;·&nbsp; Kein Abo-Zwang bei Lifetime
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="lp-footer">
        <Link href="/" className="lp-footer-logo">Mahl<em>Zeit</em></Link>
        <div className="lp-footer-links">
          <Link href="#">Datenschutz</Link>
          <Link href="#">Impressum</Link>
          <Link href="#">Nutzungsbedingungen</Link>
          <Link href="#">Kontakt</Link>
        </div>
        <div className="lp-footer-copy">© 2025 MahlZeit · @cuiseline</div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="lp-sticky-cta">
        <div>
          <div className="lp-sticky-cta-text">MahlZeit</div>
          <div className="lp-sticky-cta-sub">7 Tage gratis testen</div>
        </div>
        <Link href="#pricing" className="lp-btn-main" style={{ fontSize: 14, padding: '12px 24px' }}>
          Pläne ansehen →
        </Link>
      </div>

    </div>
  );
}
