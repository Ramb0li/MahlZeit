export const dynamic = 'force-dynamic';

import { NextResponse }                    from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getPantry, savePantry }            from '@/lib/data';
import type { PantryItem }                  from '@/types';

export async function GET() {
  const session = await getSession();
  if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!session.groupId) return NextResponse.json([]);
  return NextResponse.json(await getPantry(session.groupId));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' },     { status: 403 });

  const { name, amount } = await request.json() as { name?: string; amount?: string };
  if (!name?.trim()) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 });

  const items = await getPantry(session.groupId);
  const item: PantryItem = {
    id:      `pi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name:    name.trim(),
    addedAt: new Date().toISOString(),
    ...(amount?.trim() ? { amount: amount.trim() } : {}),
  };
  await savePantry(session.groupId, [...items, item]);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe' },     { status: 403 });

  const { id } = await request.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });

  const items = await getPantry(session.groupId);
  await savePantry(session.groupId, items.filter((i) => i.id !== id));
  return NextResponse.json({ ok: true });
}
