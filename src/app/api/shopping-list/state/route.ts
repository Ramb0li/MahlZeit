export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getShoppingListState, saveShoppingListState } from '@/lib/data';
import type { ShoppingListState } from '@/types';

// GET /api/shopping-list/state?weekId=<weekId>
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    const state = await getShoppingListState(session.groupId, weekId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[shopping-list/state GET]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

// PATCH /api/shopping-list/state?weekId=<weekId>
// Body: Partial<ShoppingListState>
// Merge-Strategie: alle übergebenen Felder ersetzen, Rest bleibt erhalten.
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    const partial = (await request.json()) as Partial<ShoppingListState>;

    const existing = await getShoppingListState(session.groupId, weekId);
    const updated: ShoppingListState = {
      checked:     partial.checked     ?? existing.checked,
      userPantry:  partial.userPantry  ?? existing.userPantry,
      overrides:   partial.overrides   ?? existing.overrides,
      customItems: partial.customItems ?? existing.customItems,
      updatedAt:   new Date().toISOString(),
    };

    await saveShoppingListState(session.groupId, weekId, updated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[shopping-list/state PATCH]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
