export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getShoppingListState, saveShoppingListState } from '@/lib/data';
import { applyShoppingListDelta, type ShoppingListDelta } from '@/lib/shoppingListState';
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

/**
 * PATCH /api/shopping-list/state?weekId=<weekId>
 *
 * Body: ShoppingListDelta — nur die tatsächlichen Änderungen.
 *
 * Früher schickte der Client den kompletten State und jedes gelieferte Feld
 * wurde ersetzt. Haken zwei Haushaltsmitglieder gleichzeitig verschiedene
 * Positionen ab, überschrieb der letzte Schreibvorgang den anderen — genau der
 * Alltagsfall, für den die geteilte Liste gedacht ist.
 *
 * Legacy-Fallback: schickt ein älterer Client noch den vollen State (Feld
 * `checked` als Array), wird weiterhin ersetzt. Das hält einen laufenden
 * Rolling-Deploy funktionsfähig.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    const body = (await request.json()) as ShoppingListDelta & Partial<ShoppingListState>;
    const existing = await getShoppingListState(session.groupId, weekId);

    const isLegacyFullState =
      Array.isArray(body.checked) || Array.isArray(body.userPantry) ||
      Array.isArray(body.customItems) || (body.overrides !== undefined);

    const updated: ShoppingListState = isLegacyFullState
      ? {
          checked:     body.checked     ?? existing.checked,
          userPantry:  body.userPantry  ?? existing.userPantry,
          overrides:   body.overrides   ?? existing.overrides,
          customItems: body.customItems ?? existing.customItems,
          updatedAt:   new Date().toISOString(),
        }
      : applyShoppingListDelta(existing, body);

    await saveShoppingListState(session.groupId, weekId, updated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[shopping-list/state PATCH]', err);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
