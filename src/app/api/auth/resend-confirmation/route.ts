export const dynamic = 'force-dynamic';

import { NextResponse }                       from 'next/server';
import { randomBytes }                        from 'crypto';
import { getUserByEmail, updateUser, setConfirmationTokenIndex } from '@/lib/users';
import { sendConfirmationEmail }              from '@/lib/email';
import { allowOnceWithRetry }                 from '@/lib/rateLimit';

const TOKEN_TTL_MS    = 24 * 60 * 60 * 1000;
const RATE_LIMIT_SECS = 60; // 1× pro Minute pro E-Mail

export async function POST(request: Request) {
  try {
    const { email } = await request.json() as { email?: string };

    if (!email) {
      return NextResponse.json({ error: 'E-Mail erforderlich.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { allowed, retryAfterSecs } = await allowOnceWithRetry(
      'confirm', normalizedEmail, RATE_LIMIT_SECS,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: `Bitte warte ${retryAfterSecs} Sekunden bevor du den Link erneut anforderst.` },
        { status: 429 }
      );
    }

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
