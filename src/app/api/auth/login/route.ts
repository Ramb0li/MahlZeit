export const dynamic = 'force-dynamic';

import { NextResponse }                                from 'next/server';
import bcrypt                                          from 'bcryptjs';
import { ADMIN_EMAIL, signToken, sessionCookieHeader } from '@/lib/auth';
import { getUserByEmail, updateUser }                  from '@/lib/users';
import { createGroup, newGroupId }                     from '@/lib/groups';

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

    // E-Mail noch nicht bestätigt
    if (user.status === 'pending' && user.confirmationToken) {
      return NextResponse.json(
        {
          error:               'Bitte bestätige zuerst deine E-Mail. Link nochmals senden?',
          needsConfirmation:   true,
          email:               user.email,
        },
        { status: 403 }
      );
    }

    // E-Mail bestätigt, aber Zahlung noch ausstehend (paid plans nach confirm)
    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Zahlung noch ausstehend.', redirect: `/auth?pending=1&email=${encodeURIComponent(user.email)}` },
        { status: 402 }
      );
    }

    // Abgelaufene Trials dürfen sich weiterhin einloggen — die App läuft dann
    // im gesperrten Freemium-Modus (siehe getAccessState in lib/users.ts).

    // Auto-Migration: User ohne Gruppe bekommen beim Login automatisch eine Solo-Gruppe.
    // (Für Bestands-User aus der Pre-Groups-Era.)
    if (!user.groupId) {
      const groupId = newGroupId();
      await createGroup({
        id:         groupId,
        name:       'Meine Familie',
        nameSet:    false,
        ownerEmail: user.email,
        createdAt:  new Date().toISOString(),
      });
      user.groupId   = groupId;
      user.groupRole = 'owner';
    }

    // Jeder Login schreibt den User-Datensatz neu — heilt automatisch den
    // Global-Index (mz:users:all) falls der nach Tabula Rasa o.Ä. inkonsistent war.
    await updateUser(user);

    const token = await signToken({
      email:     user.email,
      plan:      user.plan,
      status:    user.status,
      isAdmin:   user.email === ADMIN_EMAIL,
      groupId:   user.groupId,
      groupRole: user.groupRole,
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
