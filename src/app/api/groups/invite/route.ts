export const dynamic = 'force-dynamic';

import { NextResponse }                from 'next/server';
import { randomBytes }                 from 'crypto';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getGroupById }                from '@/lib/groups';
import { getUserByEmail, getUsersByGroup } from '@/lib/users';
import { getInvitesByGroup, createInvite } from '@/lib/invites';
import { sendInviteEmail }             from '@/lib/email';

const MAX_GROUP_MEMBERS = 5;
const INVITE_TTL_MS     = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' },     { status: 403 });

    // Nur Owner darf einladen
    if (session.groupRole !== 'owner') {
      return NextResponse.json({ error: 'Nur der Hauptuser kann Mitglieder einladen.' }, { status: 403 });
    }

    // Nur zahlende Pläne dürfen einladen
    if (session.plan !== 'lifetime' && session.plan !== 'abo' && session.plan !== 'beta') {
      return NextResponse.json({ error: 'Einladungen sind nur für Lifetime- und Abo-Nutzer verfügbar.' }, { status: 403 });
    }

    const { email } = await request.json() as { email?: string };
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Group-Daten holen
    const group = await getGroupById(session.groupId);
    if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden.' }, { status: 404 });

    // Limit prüfen: bestehende Members + offene Invites
    const members        = await getUsersByGroup(session.groupId);
    const pendingInvites = await getInvitesByGroup(session.groupId);
    if (members.length + pendingInvites.length >= MAX_GROUP_MEMBERS) {
      return NextResponse.json(
        { error: `Maximal ${MAX_GROUP_MEMBERS} Personen pro Gruppe (inkl. dir).` },
        { status: 403 }
      );
    }

    // Duplikate verhindern
    if (members.some(m => m.email === normalizedEmail)) {
      return NextResponse.json({ error: 'Diese Person ist bereits Mitglied der Gruppe.' }, { status: 409 });
    }
    if (pendingInvites.some(i => i.email === normalizedEmail)) {
      return NextResponse.json({ error: 'Es gibt bereits eine offene Einladung für diese E-Mail.' }, { status: 409 });
    }

    // Wenn die E-Mail bereits einem anderen Account zugeordnet ist → Konflikt
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'Diese E-Mail hat bereits ein eigenes MahlZyt-Konto.' }, { status: 409 });
    }

    // Invite anlegen + Email versenden
    const token = randomBytes(32).toString('hex');
    const invite = {
      id:        `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      groupId:   session.groupId,
      email:     normalizedEmail,
      invitedBy: session.email,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await createInvite(invite);

    // Owner-Name für Email-Personalisierung
    const owner = await getUserByEmail(session.email);
    const inviterName = owner ? `${owner.firstName} ${owner.lastName}` : 'Ein Familienmitglied';

    try {
      await sendInviteEmail(normalizedEmail, group.name, inviterName, token);
    } catch (e) {
      console.error('[invite] Email fehlgeschlagen:', e);
      // Trotzdem 201 zurück — Invite ist erstellt, Email kann später erneut gesendet werden
    }

    return NextResponse.json({ ok: true, invite: { email: normalizedEmail, id: invite.id } }, { status: 201 });
  } catch (err) {
    console.error('[invite]', err);
    return NextResponse.json({ error: 'Einladung fehlgeschlagen.' }, { status: 500 });
  }
}

// Invite zurückziehen
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.groupRole !== 'owner') {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const { inviteId } = await request.json() as { inviteId: string };
    const invites = await getInvitesByGroup(session.groupId!);
    const invite  = invites.find(i => i.id === inviteId);
    if (!invite) return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 });

    const { deleteInvite } = await import('@/lib/invites');
    await deleteInvite(inviteId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[invite delete]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
