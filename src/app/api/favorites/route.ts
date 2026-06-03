export const dynamic = 'force-dynamic';

import { NextResponse }              from 'next/server';
import { getSession }                from '@/lib/auth';
import { getFavorites, saveFavorites } from '@/lib/data';

export async function GET() {
  const session = await getSession();
  if (!session?.groupId) return NextResponse.json([]);
  return NextResponse.json(await getFavorites(session.groupId));
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.groupId)
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const { recipeId, favorited } =
    await request.json() as { recipeId?: string; favorited?: boolean };
  if (!recipeId || typeof favorited !== 'boolean')
    return NextResponse.json({ error: 'recipeId und favorited erforderlich' }, { status: 400 });

  const current = await getFavorites(session.groupId);
  const updated = favorited
    ? Array.from(new Set([...current, recipeId]))
    : current.filter((id) => id !== recipeId);

  await saveFavorites(session.groupId, updated);
  return NextResponse.json({ ok: true, count: updated.length });
}
