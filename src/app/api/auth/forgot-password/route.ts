export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 *
 * Nimmt eine E-Mail-Adresse entgegen, generiert einen Einmal-Token (1h gültig)
 * und sendet eine Reset-E-Mail.
 *
 * Anti-Spam:
 *  - Rate-Limit pro E-Mail: 1 Request / 15 Minuten (Redis SET NX EX)
 *  - Rate-Limit pro IP:     max. 5 Requests / Stunde (Redis INCR + EX)
 *  - Neutrale Antwort: immer 200 OK — kein Hinweis ob E-Mail existiert
 */

import { NextResponse }          from 'next/server';
import { randomBytes }           from 'crypto';
import { getUserByEmail }        from '@/lib/users';
import { sendPasswordResetEmail } from '@/lib/email';

const TOKEN_TTL_SECS  = 60 * 60;       // 1 Stunde
const EMAIL_RL_SECS   = 15 * 60;       // 15 Minuten pro E-Mail
const IP_RL_MAX       = 5;             // max. 5 Requests pro IP und Stunde
const IP_RL_SECS      = 60 * 60;       // 1 Stunde

// ─── Local-dev In-Memory-Fallback (keine Redis-Instanz nötig) ───────────────
const localEmailRL = new Map<string, number>();
const localIpCounts = new Map<string, { count: number; resetAt: number }>();

// ─── Token-Storage (lokal: JSON-Datei; Prod: Redis) ─────────────────────────

function tokensFilePath(): string {
  const path = require('path') as typeof import('path');
  return path.join(process.cwd(), 'data', 'pwd-reset-tokens.json');
}

function readLocalTokens(): Record<string, { email: string; expiresAt: number }> {
  const fs   = require('fs') as typeof import('fs');
  const file = tokensFilePath();
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
}

function writeLocalTokens(tokens: Record<string, { email: string; expiresAt: number }>): void {
  const fs = require('fs') as typeof import('fs');
  fs.writeFileSync(tokensFilePath(), JSON.stringify(tokens, null, 2), 'utf-8');
}

async function saveToken(token: string, email: string): Promise<void> {
  const expiresAt = Date.now() + TOKEN_TTL_SECS * 1000;

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    // Veraltete Tokens im gleichen Zug bereinigen
    const existing = readLocalTokens();
    const cleaned: typeof existing = {};
    for (const [t, v] of Object.entries(existing)) {
      if (v.expiresAt > Date.now()) cleaned[t] = v;
    }
    cleaned[token] = { email, expiresAt };
    writeLocalTokens(cleaned);
    return;
  }

  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  await Redis.fromEnv().set(
    `mz:pwd-reset:${token}`,
    { email, expiresAt },
    { ex: TOKEN_TTL_SECS },
  );
}

// ─── Rate-Limit helpers ──────────────────────────────────────────────────────

/** Gibt true zurück wenn die Anfrage erlaubt ist (nicht limitiert). */
async function allowEmail(email: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    const last = localEmailRL.get(email) ?? 0;
    if (Date.now() - last < EMAIL_RL_SECS * 1000) return false;
    localEmailRL.set(email, Date.now());
    return true;
  }
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  const key    = `mz:ratelimit:pwdreset:email:${email}`;
  const result = await Redis.fromEnv().set(key, '1', { ex: EMAIL_RL_SECS, nx: true });
  return result !== null; // null = Key existierte bereits = rate-limited
}

async function allowIp(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    const now  = Date.now();
    const entry = localIpCounts.get(ip);
    if (!entry || entry.resetAt <= now) {
      localIpCounts.set(ip, { count: 1, resetAt: now + IP_RL_SECS * 1000 });
      return true;
    }
    if (entry.count >= IP_RL_MAX) return false;
    entry.count++;
    return true;
  }
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  const redis = Redis.fromEnv();
  const key   = `mz:ratelimit:pwdreset:ip:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, IP_RL_SECS);
  return count <= IP_RL_MAX;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true }); // neutral
    }

    // IP-Rate-Limit
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    if (!(await allowIp(ip))) {
      return NextResponse.json({ ok: true }); // neutral — kein Info-Leak
    }

    // E-Mail-Rate-Limit
    if (!(await allowEmail(email))) {
      return NextResponse.json({ ok: true }); // neutral
    }

    // User suchen — kein Info-Leak ob vorhanden
    const user = await getUserByEmail(email);
    if (!user) return NextResponse.json({ ok: true });

    // Token generieren + speichern
    const token = randomBytes(32).toString('hex');
    await saveToken(token, email);

    // E-Mail senden (im Hintergrund, Fehler loggen aber nicht dem Client melden)
    sendPasswordResetEmail(user.firstName, email, token).catch((err) =>
      console.error('[forgot-password] E-Mail-Versand:', err),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ ok: true }); // immer neutral
  }
}
