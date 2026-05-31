export const dynamic = 'force-dynamic';

import { NextResponse }                       from 'next/server';
import { randomBytes }                        from 'crypto';
import { getUserByEmail, updateUser, setConfirmationTokenIndex } from '@/lib/users';
import { sendConfirmationEmail }              from '@/lib/email';

const TOKEN_TTL_MS    = 24 * 60 * 60 * 1000;
const RATE_LIMIT_SECS = 60; // 1× pro Minute pro E-Mail

// Fix #3: Redis-basiertes Rate-Limit — funktioniert korrekt auf Vercel (mehrere
// serverlose Instanzen pro Region). Fallback auf In-Memory für lokale Entwicklung.
const localFallback = new Map<string, number>(); // nur für dev

async function checkRateLimit(email: string): Promise<{ limited: boolean; waitSeconds: number }> {
  const key = `mz:ratelimit:confirm:${email}`;

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    // Local dev — in-memory
    const last    = localFallback.get(email) ?? 0;
    const waitMs  = RATE_LIMIT_SECS * 1000 - (Date.now() - last);
    return { limited: waitMs > 0, waitSeconds: Math.ceil(waitMs / 1000) };
  }

  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  const redis     = Redis.fromEnv();
  // SET NX: only succeeds if key does not exist yet → means NOT rate-limited
  const result = await redis.set(key, '1', { ex: RATE_LIMIT_SECS, nx: true });
  if (result === null) {
    // Key already existed — rate limited; read remaining TTL
    const ttl = await redis.ttl(key);
    return { limited: true, waitSeconds: ttl > 0 ? ttl : RATE_LIMIT_SECS };
  }
  return { limited: false, waitSeconds: 0 };
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json() as { email?: string };

    if (!email) {
      return NextResponse.json({ error: 'E-Mail erforderlich.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { limited, waitSeconds } = await checkRateLimit(normalizedEmail);
    if (limited) {
      return NextResponse.json(
        { error: `Bitte warte ${waitSeconds} Sekunden bevor du den Link erneut anforderst.` },
        { status: 429 }
      );
    }

    // Also update local fallback for dev consistency
    localFallback.set(normalizedEmail, Date.now());

    const user = await getUserByEmail(normalizedEmail);

    // Aus Datenschutzgründen: identische Antwort, ob User existiert oder nicht
    // (verhindert Email-Enumeration).
    if (!user || user.status !== 'pending' || !user.confirmationToken) {
      return NextResponse.json({ ok: true });
    }

    // Neues Token + 24h Ablauf
    const token     = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const updated   = { ...user, confirmationToken: token, confirmationTokenExpiresAt: expiresAt };

    await updateUser(updated);
    await setConfirmationTokenIndex(token, updated.email); // Fix #11: update token index

    try {
      await sendConfirmationEmail(updated, token);
    } catch (e) {
      console.error('[resend-confirmation] Email-Versand fehlgeschlagen:', e);
      return NextResponse.json({ error: 'E-Mail-Versand fehlgeschlagen.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend-confirmation]', err);
    return NextResponse.json({ error: 'Fehler beim erneuten Senden.' }, { status: 500 });
  }
}
