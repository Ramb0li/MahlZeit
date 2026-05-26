export const dynamic = 'force-dynamic';

import { NextResponse }     from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getGroupById, updateGroup } from '@/lib/groups';

/**
 * POST → Gruppennamen ändern. Nur Owner.
 * Setzt zusätzlich `nameSet: true` — damit verschwindet das Onboarding-Modal.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' },     { status: 403 });
    if (session.groupRole !== 'owner') {
      return NextResponse.json({ error: 'Nur der Hauptuser kann den Gruppennamen ändern.' }, { status: 403 });
    }

    const { name } = await request.json() as { name?: string };
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json({ error: 'Bitte einen Namen mit mindestens 2 Zeichen eingeben.' }, { status: 400 });
    }
    if (trimmed.length > 60) {
      return NextResponse.json({ error: 'Maximal 60 Zeichen.' }, { status: 400 });
    }

    const group = await getGroupById(session.groupId);
    if (!group) return NextResponse.json({ error: 'Gruppe nicht gefunden.' }, { status: 404 });

    const updated = { ...group, name: trimmed, nameSet: true };
    await updateGroup(updated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[rename]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
