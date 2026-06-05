/**
 * CMS data layer for landing page content.
 * - Local dev (no UPSTASH_REDIS_REST_URL): reads/writes data/landing-content.json
 * - Production (Vercel): reads/writes Upstash Redis at key mz:landing-content
 *
 * Managed content: reviews (testimonials), features, pricing plans.
 * Static content (hero, week preview, images) stays hardcoded in page.tsx.
 */

const USE_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;
const REDIS_KEY = 'mz:landing-content';
const JSON_FILE = 'landing-content.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LandingReview {
  name: string;
  text: string;
  role: string;
}

export interface LandingFeature {
  n: string;
  title: string;
  text: string;
  /** Optional inline link injected into text. Split on link.text and wrap with <a>. */
  link?: { text: string; url: string };
}

export interface LandingPlan {
  badge: string;
  name: string;
  cur: string;
  amount: string;
  per: string;
  desc: string;
  features: string[];
  href: string;
  featured: boolean;
}

export interface LandingMeta {
  /** Hero badge, e.g. "200+" */
  recipeCount:     string;
  /** Hero headline. Convention: "\n" = line break, *word* = <em>word</em> */
  heroTitle:       string;
  heroLead:        string;
  eyebrowFeatures: string;
  eyebrowWeek:     string;
  eyebrowRecipes:  string;
  eyebrowReviews:  string;
  eyebrowPricing:  string;
  footerYear:      string;
  /** Trust line under the pricing cards */
  footerTrust:     string;
}

export interface LandingContent {
  reviews:  LandingReview[];
  features: LandingFeature[];
  plans:    LandingPlan[];
  meta:     LandingMeta;
}

// ─── Defaults (matches page.tsx hardcode, used as fallback) ───────────────────

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  reviews: [
    {
      text: '«Endlich plane ich die Woche durch — kein tägliches Grübeln mehr. Die Einkaufsliste spart mir jedes Mal Zeit.»',
      name: 'Sarah M.',
      role: 'Mutter, Basel',
    },
    {
      text: '«Ich esse seit MahlZeit viel abwechslungsreicher. Die Rezeptvorschläge passen wirklich zu mir — und alles ist vegan.»',
      name: 'Lukas B.',
      role: 'Student, Zürich',
    },
    {
      text: '«Das UI ist aufgeräumt und es läuft. Ich habe viele Apps ausprobiert — MahlZeit ist die erste, die ich täglich nutze.»',
      name: 'Mia K.',
      role: 'Grafikerin, Bern',
    },
  ],
  features: [
    {
      n: '01',
      title: 'Smarte Vorschläge',
      text: 'MahlZeit schlägt Gerichte vor, die zu deinen Vorlieben, der Saison und dem Wetter passen. Kein Kopfzerbrechen mehr.',
    },
    {
      n: '02',
      title: 'Wochenplaner',
      text: 'Plane Wochen im Voraus, in der Wochenübersicht alle Mahlzeiten, übersichtlich dargestellt. Änderungen aktualisieren deine Einkaufslisten sofort und automatisch.',
    },
    {
      n: '03',
      title: 'Rezeptbibliothek',
      text: '200+ Menüs von @cuiseline, kuratiert und laufend erweitert. Speichere deine Lieblingsrezepte mit Anleitungen, Zutaten und Variationen mithilfe unserem KI Tool, welches Fotos oder Rezepte automatisch erkennt und einliest.',
      link: { text: '@cuiseline', url: 'https://www.instagram.com/cuiseline/' },
    },
    {
      n: '04',
      title: 'Automatische Einkaufsliste',
      text: 'Alle Zutaten zusammengefasst, nach Regal sortiert, mit dem ganzen Haushalt geteilt.',
    },
  ],
  plans: [
    {
      badge: 'Gratis starten', name: 'Testwoche', cur: 'CHF', amount: '0',
      per: '7 Tage kostenlos', desc: 'Voller Zugang. Kein Kreditkarteneintrag.',
      features: ['Wochenplaner', 'Rezeptbibliothek', 'Einkaufsliste', 'KI-Vorschläge'],
      href: '/auth?plan=trial', featured: false,
    },
    {
      badge: 'Flexibel', name: 'Monatsabo', cur: 'CHF', amount: '3',
      per: '/ Monat · kündbar', desc: 'Monatlich kündbar.',
      features: ['Alles aus Testwoche', 'Unbegrenzte Rezepte', 'KI Menü-Import', 'Kündigung jederzeit'],
      href: '/auth?plan=abo', featured: false,
    },
    {
      badge: 'Beliebteste Wahl', name: 'Lifetime', cur: 'CHF', amount: '99',
      per: 'einmalig · für immer', desc: 'Einmal zahlen, für immer nutzen. Alle Updates inklusive.',
      features: ['Alles aus Jahresabo', 'Alle zukünftigen Features', 'Keine Folgekosten', 'Priority Support'],
      href: '/auth?plan=lifetime', featured: true,
    },
    {
      badge: 'Bester Wert', name: 'Jahresabo', cur: 'CHF', amount: '30',
      per: '/ Jahr · 2 Monate gratis', desc: 'Spare gegenüber dem Monatsabo.',
      features: ['Alles aus Monatsabo', 'Priorisierter Support', '2 Monate gespart'],
      href: '/auth?plan=yearly', featured: false,
    },
  ],
  meta: {
    recipeCount:     '200+',
    heroTitle:       'Deine Woche.\n*Dein* Essen.',
    heroLead:        'MahlZeit erstellt deinen Wochenplan, schlägt Rezepte vor und schreibt automatisch deine Einkaufsliste. Alles verknüpft. Alles automatisiert.',
    eyebrowFeatures: 'Was dich erwartet',
    eyebrowWeek:     'Wochenplan',
    eyebrowRecipes:  'Rezepte die passen',
    eyebrowReviews:  'Stimmen',
    eyebrowPricing:  'Preise',
    footerYear:      '2025',
    footerTrust:     '🔒 Sichere Zahlung via Stripe  ·  🇨🇭 Made in Switzerland  ·  Kein Abo-Zwang bei Lifetime',
  },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

/** Merge stored content over defaults so older records without newer fields (e.g. `meta`) never crash. */
function withDefaults(stored: Partial<LandingContent> | null | undefined): LandingContent {
  if (!stored) return DEFAULT_LANDING_CONTENT;
  return {
    reviews:  stored.reviews  ?? DEFAULT_LANDING_CONTENT.reviews,
    features: stored.features ?? DEFAULT_LANDING_CONTENT.features,
    plans:    stored.plans    ?? DEFAULT_LANDING_CONTENT.plans,
    meta:     { ...DEFAULT_LANDING_CONTENT.meta, ...(stored.meta ?? {}) },
  };
}

function readJson(): LandingContent {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), 'data', JSON_FILE);
  if (!fs.existsSync(filePath)) return DEFAULT_LANDING_CONTENT;
  try { return withDefaults(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<LandingContent>); }
  catch   { return DEFAULT_LANDING_CONTENT; }
}

function writeJson(data: LandingContent): void {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  fs.writeFileSync(path.join(process.cwd(), 'data', JSON_FILE), JSON.stringify(data, null, 2), 'utf-8');
}

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getLandingContent(): Promise<LandingContent> {
  if (!USE_REDIS) return readJson();
  const stored = await getRedis().get<Partial<LandingContent>>(REDIS_KEY);
  return withDefaults(stored);
}

export async function setLandingContent(content: LandingContent): Promise<void> {
  if (!USE_REDIS) { writeJson(content); return; }
  await getRedis().set(REDIS_KEY, content);
}
