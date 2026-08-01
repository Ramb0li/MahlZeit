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
import { allowN, allowOnce, clientIp } from '@/lib/rateLimit';

const TOKEN_TTL_SECS  = 60 * 60;       // 1 Stunde
const EMAIL_RL_SECS   = 15 * 60;       // 15 Minuten pro E-Mail
const IP_RL_MAX       = 5;             // max. 5 Requests pro IP und Stunde
const IP_RL_SECS      = 60 * 60;       // 1 Stunde

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true }); // neutral
    }

    // IP-Rate-Limit
    if (!(await allowN('pwdreset:ip', clientIp(request), IP_RL_MAX, IP_RL_SECS))) {
      return NextResponse.json({ ok: true }); // neutral — kein Info-Leak
    }

    // E-Mail-Rate-Limit
    if (!(await allowOnce('pwdreset:email', email, EMAIL_RL_SECS))) {
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
