export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getShoppingGroups, saveShoppingGroups } from '@/lib/data';
import type { ShoppingGroups } from '@/types';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    const groups = await getShoppingGroups(weekId, session.groupId);
    return NextResponse.json(groups);
  } catch (err) {
    console.error('[shopping-groups GET]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 403 });

    const { weekId, groups } = await request.json() as { weekId: string; groups: ShoppingGroups };
    if (!weekId || !groups) return NextResponse.json({ error: 'weekId und groups erforderlich' }, { status: 400 });

    // Validierung: max 7 Gruppen, dayIndices 1–7
    if (groups.length > 7) return NextResponse.json({ error: 'Max. 7 Gruppen' }, { status: 400 });
    for (const g of groups) {
      if (!g.id || !Array.isArray(g.dayIndices)) {
        return NextResponse.json({ error: 'Ungültige Gruppen-Struktur' }, { status: 400 });
      }
      for (const d of g.dayIndices) {
        if (d < 1 || d > 7) return NextResponse.json({ error: `Ungültiger Tag: ${d}` }, { status: 400 });
      }
    }

    await saveShoppingGroups(weekId, session.groupId, groups);
    return NextResponse.json({ ok: true, groups });
  } catch (err) {
    console.error('[shopping-groups POST]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
