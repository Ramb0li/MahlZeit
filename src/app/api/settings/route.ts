export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getSettings, saveSettings, getConstraints, saveConstraints } from '@/lib/data';

export async function GET() {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });

    const [settings, constraints] = await Promise.all([
      getSettings(session.groupId),
      getConstraints(session.groupId),
    ]);
    return NextResponse.json({ settings, constraints });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });

    const { settings, constraints } = await request.json();
    await Promise.all([
      settings    ? saveSettings(settings, session.groupId)       : Promise.resolve(),
      constraints ? saveConstraints(constraints, session.groupId) : Promise.resolve(),
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }
}
