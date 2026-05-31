export const dynamic = 'force-dynamic';

/**
 * GET  /api/recipes/ratings?recipeId=xxx  — Alle Bewertungen fuer ein Rezept (kein Auth)
 * POST /api/recipes/ratings               — Bewertung speichern (nur aktive, bezahlende User)
 */

import { NextResponse }      from 'next/server';
import { getSession }        from '@/lib/auth';
import { getRecipeRatings, saveRecipeRating } from '@/lib/data';
import type { RecipeRating } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipeId = searchParams.get('recipeId');
  if (!recipeId) return NextResponse.json({ error: 'recipeId fehlt' }, { status: 400 });
  const ratings = await getRecipeRatings(recipeId);
  return NextResponse.json(ratings);
}

export async function POST(request: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  if (session.status !== 'active') return NextResponse.json({ error: 'Account nicht aktiv' }, { status: 403 });
  // Nur aktive User mit bezahltem Plan koennen bewerten (trial = kostenlos)
  if (session.plan === 'trial') return NextResponse.json({ error: 'Nur fuer Premium-Nutzer' }, { status: 403 });

  const { recipeId, rating, comment } = await request.json() as {
    recipeId: string;
    rating: number;
    comment: string;
  };

  if (!recipeId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Ungueltige Daten' }, { status: 400 });
  }

  const ratingObj: RecipeRating = {
    userId:    session.email,
    userEmail: session.email,
    rating:    Math.round(rating),
    comment:   (comment ?? '').trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  await saveRecipeRating(recipeId, ratingObj);
  return NextResponse.json({ ok: true, rating: ratingObj });
}
