export const dynamic = 'force-dynamic';

import { NextResponse }                       from 'next/server';
import { randomBytes }                        from 'crypto';
import { getUserByEmail, updateUser }         from '@/lib/users';
import { sendConfirmationEmail }              from '@/lib/email';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MS = 60_000; // 1× pro Minute pro E-Mail

// In-Memory Rate-Limit (überlebt keinen Server-Restart — ist für Produktion ok bei einer Vercel-Instanz pro Region)
const lastSendAt = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const { email } = await request.json() as { email?: string };

    if (!email) {
      return NextResponse.json({ error: 'E-Mail erforderlich.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate-limit
    const last = lastSendAt.get(normalizedEmail) ?? 0;
    const waitMs = RATE_LIMIT_MS - (Date.now() - last);
    if (waitMs > 0) {
      return NextResponse.json(
        { error: `Bitte warte ${Math.ceil(waitMs / 1000)} Sekunden bevor du den Link erneut anforderst.` },
        { status: 429 }
      );
    }

    const user = await getUserByEmail(normalizedEmail);

    // Aus Datenschutzgründen: identische Antwort, ob User existiert oder nicht
    // (verhindert Email-Enumeration).
    if (!user || user.status !== 'pending' || !user.confirmationToken) {
      lastSendAt.set(normalizedEmail, Date.now());
      return NextResponse.json({ ok: true });
    }

    // Neues Token + 24h Ablauf
    const token     = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const updated   = { ...user, confirmationToken: token, confirmationTokenExpiresAt: expiresAt };

    await updateUser(updated);
    lastSendAt.set(normalizedEmail, Date.now());

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
