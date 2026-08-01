export const dynamic = 'force-dynamic';

import { NextResponse }                  from 'next/server';
import { ADMIN_EMAIL }                       from '@/lib/auth';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getUserByEmail, updateUser, getUsersByGroup } from '@/lib/users';
import { createGroup, newGroupId }                     from '@/lib/groups';

/**
 * GET → Liste aller Members einer Gruppe (für Settings UI).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' },     { status: 403 });

    const members = await getUsersByGroup(session.groupId);
    // sensitive Felder filtern
    // Fix #6: also strip confirmationTokenExpiresAt — no reason to expose it to clients.
    const safe = members.map(
      ({ passwordHash: _pw, confirmationToken: _c, confirmationTokenExpiresAt: _exp, ...rest }) => rest
    );
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

/**
 * DELETE → Owner entfernt ein Mitglied aus der Gruppe.
 *
 * Das Konto bleibt bestehen und bekommt eine eigene Solo-Gruppe (gleiches Muster
 * wie die Auto-Migration beim Login). Früher rief diese Route deleteUser() auf und
 * löschte damit das komplette Konto — obwohl der Bestätigungsdialog nur von
 * "aus der Gruppe entfernen" sprach.
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.groupRole !== 'owner') {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const { email } = await request.json() as { email: string };
    if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 });

    // Owner kann sich nicht selbst entfernen
    if (email.toLowerCase() === session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Hauptuser kann sich nicht selbst entfernen.' }, { status: 400 });
    }
    // Admin nicht entfernbar (Schutz)
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Admin-Account kann nicht entfernt werden.' }, { status: 403 });
    }

    const target = await getUserByEmail(email);
    if (!target || target.groupId !== session.groupId) {
      return NextResponse.json({ error: 'Mitglied nicht in dieser Gruppe.' }, { status: 404 });
    }

    // Eigene Solo-Gruppe anlegen, damit das Konto weiter nutzbar bleibt.
    const soloGroupId = newGroupId();
    await createGroup({
      id:         soloGroupId,
      name:       `${target.firstName}s Haushalt`,
      nameSet:    false,
      ownerEmail: target.email,
      createdAt:  new Date().toISOString(),
    });
    await updateUser({ ...target, groupId: soloGroupId, groupRole: 'owner' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[members delete]', err);
    return NextResponse.json({ error: 'Fehler beim Entfernen' }, { status: 500 });
  }
}
