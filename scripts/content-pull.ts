/**
 * content-pull.ts
 *
 * Zieht den Landing-Page-Inhalt (Texte, Reviews, Features, Preispläne) aus dem
 * PRODUKTIV-Upstash-Redis (Key `mz:landing-content`) und schreibt ihn nach
 * `data/landing-content.json`. So gelangen Admin-Änderungen, die online über das
 * Admin-Panel gemacht wurden, zurück ins Repo (und damit ins lokale Dev).
 *
 * Voraussetzung in `.env.local` (die PROD-Werte):
 *   UPSTASH_REDIS_REST_URL=...
 *   UPSTASH_REDIS_REST_TOKEN=...
 *
 * Ausführen:  npm run content:pull
 * Danach:     data/landing-content.json committen.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Redis } from '@upstash/redis';
import { DEFAULT_LANDING_CONTENT, type LandingContent } from '../src/lib/content';

const REDIS_KEY = 'mz:landing-content';

// ── .env.local laden ────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error('Fehler: UPSTASH_REDIS_REST_URL und UPSTASH_REDIS_REST_TOKEN (PROD) müssen in .env.local gesetzt sein.');
    process.exit(1);
  }

  const redis  = new Redis({ url, token });
  const stored = await redis.get<Partial<LandingContent>>(REDIS_KEY);

  if (!stored) {
    console.error(`Kein Inhalt unter "${REDIS_KEY}" gefunden. Es wurde nichts geschrieben.`);
    process.exit(1);
  }

  // Mit Defaults mergen, damit fehlende (ältere) Felder nie zu kaputtem JSON führen
  const merged: LandingContent = {
    reviews:  stored.reviews  ?? DEFAULT_LANDING_CONTENT.reviews,
    features: stored.features ?? DEFAULT_LANDING_CONTENT.features,
    plans:    stored.plans    ?? DEFAULT_LANDING_CONTENT.plans,
    meta:     { ...DEFAULT_LANDING_CONTENT.meta, ...(stored.meta ?? {}) },
  };

  const outPath = path.join(__dirname, '../data/landing-content.json');
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

  console.log(
    `OK → data/landing-content.json aktualisiert ` +
    `(${merged.reviews.length} Reviews, ${merged.features.length} Features, ${merged.plans.length} Pläne).`,
  );
  console.log('Nicht vergessen: data/landing-content.json committen.');
}

main().catch((e) => { console.error('Unerwarteter Fehler:', e); process.exit(1); });
