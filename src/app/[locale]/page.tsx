export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { Check, Leaf, Clock, Flame } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link }                              from '@/i18n/navigation';
import { LandingBleed }                      from '@/components/landing/LandingBleed';
import { SiteFooter }                        from '@/components/landing/SiteFooter';
import { PwaInstallButton }                  from '@/components/landing/PwaInstallButton';
import { getLandingContent }                 from '@/lib/content';
import { getTemplateRecipes }               from '@/lib/data';
import type { LandingFeature }               from '@/lib/content';
import { getSession }                        from '@/lib/auth';

const COLLAGE = [
  { cls: 'mz-cc1', src: '/images/recipes/cuiselin-taboule.jpeg',             alt: 'Taboulé'           },
  { cls: 'mz-cc2', src: '/images/recipes/cuiselin-gurken-ananas-salat.jpeg', alt: 'Gurken-Ananas-Salat'},
  { cls: 'mz-cc3', src: '/images/recipes/cuiselin-granola.jpg',              alt: 'Granola'            },
  { cls: 'mz-cc4', src: '/images/recipes/cuiselin-pesto-genovese.jpg',       alt: 'Pesto Genovese'    },
];

// Heutiger Wochentag dynamisch (Serverzeit)
const todayIdx   = new Date().getDay();
const DAY_SHORT  = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const todayShort = DAY_SHORT[todayIdx];

const WEEK = [
  { name: 'Mo', meal: 'Overnight Oats',  sub: '5 min'  },
  { name: 'Di', meal: 'Pasta al Limone', sub: '25 min' },
  { name: 'Mi', meal: 'Buddha Bowl',     sub: '20 min' },
  { name: 'Do', meal: 'Gemüse Curry',    sub: '35 min' },
  { name: 'Fr', meal: 'Pizza Bianca',    sub: '30 min' },
  { name: 'Sa', meal: 'Risotto',         sub: '40 min' },
  { name: 'So', meal: 'Linsensuppe',     sub: '25 min' },
].map(d => ({ ...d, today: d.name === todayShort }));

function renderRichTitle(raw: string) {
  return raw.split('\n').map((line, li, arr) => (
    <span key={li}>
      {line.split(/(\*[^*]+\*)/g).map((part, pi) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 1
          ? <em key={pi}>{part.slice(1, -1)}</em>
          : <span key={pi}>{part}</span>
      )}
      {li < arr.length - 1 && <br />}
    </span>
  ));
}

function renderFeatureText(f: LandingFeature) {
  if (!f.link) return f.text;
  const idx = f.text.indexOf(f.link.text);
  if (idx === -1) return f.text;
  return (
    <>
      {f.text.slice(0, idx)}
      <a href={f.link.url} target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
        {f.link.text}
      </a>
      {f.text.slice(idx + f.link.text.length)}
    </>
  );
}

interface Props { params: Promise<{ locale: string }> }

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [{ reviews, features, plans, meta }, session, t] = await Promise.all([
    getLandingContent(),
    getSession().catch(() => null),
    getTranslations('Landing'),
  ]);

  let recipeCountDisplay = meta.recipeCount;
  if (meta.recipeCountAuto && process.env.UPSTASH_REDIS_REST_URL) {
    const templates = await getTemplateRecipes();
    const approved  = templates.filter(r => r.approved === true).length;
    const rounded   = Math.floor(approved / 50) * 50;
    if (rounded > 0) recipeCountDisplay = `${rounded}+`;
  }

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
          {session ? (
            <Link href="/app" className="mz-btn-primary" style={{ fontSize: 14, padding: '9px 18px' }}>
              {t('navToPlanner')}
            </Link>
          ) : (
            <>
              <Link href="/auth" className="mz-lp-login">{t('navLogin')}</Link>
              <Link href="/auth?plan=trial" className="mz-btn-primary" style={{ fontSize: 14, padding: '9px 18px' }}>
                {t('navStartFree')}
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="mz-lp-hero">
        <div>
          <div className="mz-lp-kicker">
            <div className="mz-lp-kicker-dot" />
            {t('kicker')}
          </div>
          <h1 className="mz-lp-h1">
            {renderRichTitle(meta.heroTitle)}
          </h1>
          <p className="mz-lp-lead">
            {meta.heroLead}
          </p>
          <div className="mz-lp-hero-cta">
            <Link href="#features" className="mz-btn-soft lg" style={{ padding: '14px 22px', fontSize: 15 }}>
              {t('heroCta')}
            </Link>
            <PwaInstallButton />
          </div>
          <p className="mz-lp-hero-note" style={{ marginTop: 14 }}>
            {t('heroNote')}
          </p>
        </div>

        <div className="mz-lp-hero-collage">
          {COLLAGE.map(({ cls, src, alt }) => (
            <div key={cls} className={`mz-cc ${cls}`} style={{ backgroundImage: `url(${src})` }} aria-label={alt} />
          ))}
          <div className="mz-cc-badge">
            <span className="mz-cc-badge-num">{recipeCountDisplay}<span style={{ fontSize: '0.45em', verticalAlign: 'super' }}>*</span></span>
            <span>Rezepte</span>
            <span style={{ fontSize: 9, opacity: 0.8, lineHeight: 1.2, marginTop: 2 }}>*laufend mehr</span>
          </div>
        </div>
      </div>

      {/* ── Statement ─────────────────────────────────────────────────── */}
      <div className="mz-lp-statement">
        <h2>{t('statement1')}<br /><em>{t('statement2')}</em></h2>
      </div>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <div className="mz-lp-features" id="features">
        <p className="mz-eyebrow">{meta.eyebrowFeatures}</p>
        <h2 className="mz-lp-h2" style={{ marginTop: 10 }}>
          Alles, was du für<br />deine Woche <em>brauchst.</em>
        </h2>
        <div className="mz-lp-feat-grid">
          {features.map((f) => (
            <div key={f.n} className="mz-lp-feat">
              <div className="mz-lp-feat-num">{f.n}</div>
              <h3>{f.title}</h3>
              <p>{renderFeatureText(f)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full-bleed image ──────────────────────────────────────────── */}
      <LandingBleed />

      {/* ── Week preview ──────────────────────────────────────────────── */}
      <div className="mz-lp-week">
        <p className="mz-eyebrow">{meta.eyebrowWeek}</p>
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
        <div className="mz-lp-two-img" style={{ backgroundImage: 'url(/images/recipes/cuiselin-gruener-linsensalat.jpg)' }} />
        <div className="mz-lp-two-txt">
          <p className="mz-eyebrow">{meta.eyebrowRecipes}</p>
          <h3 style={{ marginTop: 10 }}>
            Rezepte,<br /><em>die passen.</em>
          </h3>
          <p>
            Nicht irgendwelche — sondern solche, die zu deinen Vorlieben, der Zeit,
            der Saison und dem aktuellen Wetter passen. Sonnig? MahlZeit schlägt
            ein leichtes Sommermenü vor.
          </p>
          <div className="mz-lp-tagrow">
            {[
              { icon: <Leaf  size={13} />, label: 'Vegan'        },
              { icon: <Clock size={13} />, label: 'Unter 30 Min' },
              { icon: <Flame size={13} />, label: 'Saisonal'     },
              { icon: null,                label: 'Proteinreich'  },
            ].map(({ icon, label }) => (
              <span key={label} className="mz-chip" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {icon}{label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reviews ───────────────────────────────────────────────────── */}
      <div className="mz-lp-reviews">
        <p className="mz-eyebrow" style={{ textAlign: 'center' }}>{meta.eyebrowReviews}</p>
        <h2 className="mz-lp-h2" style={{ marginTop: 10, textAlign: 'center' }}>
          Was <em>andere</em> sagen.
        </h2>
        <div className="mz-lp-rev-grid" style={{ marginTop: 32 }}>
          {reviews.map(({ text, name, role }) => (
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
        <p className="mz-eyebrow" style={{ color: 'rgba(255,255,255,.6)' }}>{meta.eyebrowPricing}</p>
        <h2 className="mz-lp-h2" style={{ color: '#fff', marginTop: 10 }}>
          Einfach. Fair. <em>Dein</em> Preis.
        </h2>
        <div className="mz-lp-plans">
          {plans.map((p) => (
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
                  <li key={f}><Check size={14} />{f}</li>
                ))}
              </ul>
              <Link href={p.href} className={`mz-lp-plan-cta ${p.featured ? 'mz-btn-primary' : 'mz-btn-ghost-light'}`}
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '11px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
                {p.featured ? t('planBuy') : t('planSelect')}
              </Link>
            </div>
          ))}
        </div>
        <p className="mz-lp-trust">{meta.footerTrust}</p>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <SiteFooter year={meta.footerYear} />

      {/* ── Mobile sticky CTA ─────────────────────────────────────────── */}
      <div className="mz-lp-mobile-cta">
        <Link href="/auth?plan=trial" className="mz-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          {t('mobileCta')}
        </Link>
        <p className="mz-lp-mobile-cta-note">{t('mobileCtaNote')}</p>
      </div>

    </div>
  );
}
