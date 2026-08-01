export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 *
 * Nimmt Token + neues Passwort entgegen, prüft Token-Gültigkeit,
 * aktualisiert den Passwort-Hash und invalidiert das Token sofort.
 */

import { NextResponse }                                   from 'next/server';
import { getUserByEmail, updateUser }                     from '@/lib/users';
import { ADMIN_EMAIL, signToken, sessionCookieHeader }   from '@/lib/auth';

// ─── Token-Storage (dieselbe Logik wie forgot-password) ─────────────────────

function tokensFilePath(): string {
  const path = require('path') as typeof import('path');
  return path.join(process.cwd(), 'data', 'pwd-reset-tokens.json');
}

async function getToken(
  token: string,
): Promise<{ email: string; expiresAt: number } | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    const fs   = require('fs') as typeof import('fs');
    const file = tokensFilePath();
    if (!fs.existsSync(file)) return null;
    const tokens = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<
      string,
      { email: string; expiresAt: number }
    >;
    return tokens[token] ?? null;
  }
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv().get<{ email: string; expiresAt: number }>(
    `mz:pwd-reset:${token}`,
  );
}

async function deleteToken(token: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    const fs   = require('fs') as typeof import('fs');
    const file = tokensFilePath();
    if (!fs.existsSync(file)) return;
    const tokens = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    delete tokens[token];
    fs.writeFileSync(file, JSON.stringify(tokens, null, 2), 'utf-8');
    return;
  }
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  await Redis.fromEnv().del(`mz:pwd-reset:${token}`);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json() as {
      token?: string;
      password?: string;
    };

    if (!token || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'Bitte gib ein Passwort mit mindestens 8 Zeichen ein.' },
        { status: 400 },
      );
    }

    const stored = await getToken(token);
    if (!stored || Date.now() > stored.expiresAt) {
      return NextResponse.json(
        { error: 'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.' },
        { status: 400 },
      );
    }

    const user = await getUserByEmail(stored.email);
    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 });
    }

    // Neuen Hash berechnen + User aktualisieren
    const { hash } = await import('bcryptjs');
    const passwordHash = await hash(password, 12);

    const wasNewAccount = user.status === 'pending';
    const updatedUser = {
      ...user,
      passwordHash,
      passwordSet: true,   // ab jetzt kennt der User sein Passwort selbst
      // Neues Konto nach Stripe-Zahlung: jetzt aktivieren
      status: wasNewAccount ? ('active' as const) : user.status,
    };
    await updateUser(updatedUser);

    // Token sofort invalidieren (Einmal-Use)
    await deleteToken(token);

    // Neues Konto: direkt einloggen (JWT setzen + Redirect)
    if (wasNewAccount) {
      const jwt = await signToken({
        email:     updatedUser.email,
        plan:      updatedUser.plan,
        status:    'active',
        isAdmin:   updatedUser.email === ADMIN_EMAIL,
        groupId:   updatedUser.groupId,
        groupRole: updatedUser.groupRole,
      });
      return new NextResponse(
        JSON.stringify({ ok: true, redirect: '/app' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie':   sessionCookieHeader(jwt),
          },
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 });
  }
}
