export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getRecipes, saveRecipes } from '@/lib/data';
import type { Recipe } from '@/types';

export async function GET() {
  try {
    const recipes = await getRecipes();
    return NextResponse.json(recipes);
  } catch {
    return NextResponse.json({ error: 'Fehler beim Laden der Rezepte' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const recipe: Recipe = await request.json();
    const recipes = await getRecipes();
    recipes.push(recipe);
    await saveRecipes(recipes);
    return NextResponse.json(recipe, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const updated: Recipe = await request.json();
    const recipes = await getRecipes();
    const idx = recipes.findIndex((r) => r.id === updated.id);
    if (idx === -1) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    recipes[idx] = updated;
    await saveRecipes(recipes);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const recipes = await getRecipes();
    const filtered = recipes.filter((r) => r.id !== id);
    await saveRecipes(filtered);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
