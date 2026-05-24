export const dynamic = 'force-dynamic';

import { NextResponse }                            from 'next/server';
import bcrypt                                      from 'bcryptjs';
import { ADMIN_EMAIL, signToken, sessionCookieHeader } from '@/lib/auth';
import { getUserByEmail }                          from '@/lib/users';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'E-Mail und Passwort erforderlich.' }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'E-Mail oder Passwort falsch.' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'E-Mail oder Passwort falsch.' }, { status: 401 });
    }

    if (user.status === 'inactive') {
      return NextResponse.json({ error: 'Dein Konto wurde deaktiviert.' }, { status: 403 });
    }

    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Zahlung noch ausstehend.', redirect: `/auth?pending=1&email=${encodeURIComponent(user.email)}` },
        { status: 402 }
      );
    }

    // Check trial expiry
    if (user.plan === 'trial' && user.accessUntil && new Date(user.accessUntil) < new Date()) {
      return NextResponse.json(
        { error: 'Deine 7-Tage-Testphase ist abgelaufen.', redirect: '/auth?plan=lifetime' },
        { status: 403 }
      );
    }

    const token = await signToken({
      email:   user.email,
      plan:    user.plan,
      status:  user.status,
      isAdmin: user.email === ADMIN_EMAIL,
    });

    return new NextResponse(
      JSON.stringify({ redirect: user.email === ADMIN_EMAIL ? '/admin' : '/app' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': sessionCookieHeader(token),
        },
      }
    );
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Anmeldung fehlgeschlagen.' }, { status: 500 });
  }
}
