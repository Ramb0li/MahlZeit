export const dynamic = 'force-dynamic';

import { NextResponse }                  from 'next/server';
import { randomBytes }                   from 'crypto';
import bcrypt                            from 'bcryptjs';
import { createUser, getUserByEmail }    from '@/lib/users';
import { sendConfirmationEmail }         from '@/lib/email';
import type { PlanType, AppUser }        from '@/lib/users';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(request: Request) {
  try {
    const { firstName, lastName, email, password, plan } = await request.json() as {
      firstName: string;
      lastName:  string;
      email:     string;
      password:  string;
      plan:      PlanType;
    };

    // Validation
    if (!firstName || !lastName || !email || !password || !plan) {
      return NextResponse.json({ error: 'Alle Felder sind erforderlich.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 });
    }

    // Check duplicate
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token        = randomBytes(32).toString('hex');
    const expiresAt    = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    // Alle Pläne starten als pending — Bestätigung per E-Mail ist Pflicht.
    // accessUntil wird nach Confirmation gesetzt (für Trial 7 Tage).
    const user: AppUser = {
      id:                          `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      firstName,
      lastName,
      email:                       email.toLowerCase(),
      passwordHash,
      plan,
      status:                      'pending',
      registeredAt:                new Date().toISOString(),
      confirmationToken:           token,
      confirmationTokenExpiresAt:  expiresAt,
    };

    await createUser(user);

    // Bestätigungsmail senden (loggt nur lokal ohne RESEND_API_KEY)
    try {
      await sendConfirmationEmail(user, token);
    } catch (e) {
      console.error('[register] Email-Versand fehlgeschlagen:', e);
      // Wir lassen die Registrierung trotzdem durchgehen — User kann via Resend erneut anfordern.
    }

    return NextResponse.json({
      ok:                   true,
      pendingConfirmation:  true,
      email:                user.email,
    }, { status: 201 });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 });
  }
}
