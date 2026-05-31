export const dynamic = 'force-dynamic';

import { NextResponse }                                  from 'next/server';
import bcrypt                                            from 'bcryptjs';
import { ADMIN_EMAIL, signToken, sessionCookieHeader }   from '@/lib/auth';
import { createUser, getUserByEmail }                    from '@/lib/users';
import { getInviteByToken, deleteInvite }                from '@/lib/invites';
import { getGroupById }                                  from '@/lib/groups';

/**
 * GET → Invite-Token validieren, vor Anzeige des Formulars.
 *   ?token=XXX → { email, groupName }
 */
export async function GET(request: Request) {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 });

  const invite = await getInviteByToken(token);
  if (!invite) return NextResponse.json({ error: 'Einladung ungültig oder bereits eingelöst.' }, { status: 404 });

  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Einladung abgelaufen.' }, { status: 410 });
  }

  const group = await getGroupById(invite.groupId);
  return NextResponse.json({
    email:      invite.email,
    groupName:  group?.name ?? 'Familie',
    invitedBy:  invite.invitedBy,
  });
}

/**
 * POST → Eingeladene Person setzt Vorname/Nachname/Passwort und tritt der Gruppe bei.
 *   Body: { token, firstName, lastName, password }
 *   Erstellt neuen User mit groupId+groupRole='member', Status active, ohne Plan.
 *   Setzt Session-Cookie und redirected zur App.
 */
export async function POST(request: Request) {
  try {
    const { token, firstName, lastName, password } = await request.json() as {
      token:     string;
      firstName: string;
      lastName:  string;
      password:  string;
    };

    if (!token || !firstName || !lastName || !password) {
      return NextResponse.json({ error: 'Alle Felder sind erforderlich.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 });
    }

    const invite = await getInviteByToken(token);
    if (!invite) return NextResponse.json({ error: 'Einladung ungültig.' }, { status: 404 });
    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Einladung abgelaufen.' }, { status: 410 });
    }

    // Verifizieren, dass es noch keinen Account mit dieser Email gibt
    const existing = await getUserByEmail(invite.email);
    if (existing) return NextResponse.json({ error: 'Konto existiert bereits.' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    // Fix #4: Inherit the owner's current plan instead of hardcoding 'lifetime'.
    // NOTE: if the owner's plan changes later (e.g. abo cancelled), the member's
    // stored plan becomes stale. A full solution would re-check on each login,
    // but for this family-scale app the owner manages membership manually.
    const owner       = await getUserByEmail(invite.invitedBy);
    const memberPlan  = (owner?.plan === 'lifetime' || owner?.plan === 'abo')
      ? owner.plan
      : 'lifetime'; // fallback: owner deleted or plan unknown → keep access

    const user = {
      id:           `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      firstName,
      lastName,
      email:        invite.email,
      passwordHash,
      plan:         memberPlan,
      status:       'active' as const,
      registeredAt: new Date().toISOString(),
      groupId:      invite.groupId,
      groupRole:    'member' as const,
    };

    await createUser(user);
    await deleteInvite(invite.id);

    const jwt = await signToken({
      email:     user.email,
      plan:      user.plan,
      status:    user.status,
      isAdmin:   user.email === ADMIN_EMAIL,
      groupId:   user.groupId,
      groupRole: user.groupRole,
    });

    return new NextResponse(
      JSON.stringify({ redirect: '/app' }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie':   sessionCookieHeader(jwt),
        },
      }
    );
  } catch (err) {
    console.error('[accept-invite]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
