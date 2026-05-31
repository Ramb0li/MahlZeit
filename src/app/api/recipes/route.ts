export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup } from '@/lib/session';
import { getRecipes, saveRecipes } from '@/lib/data';
import type { Recipe } from '@/types';

async function requireGroup(): Promise<{ groupId: string } | NextResponse> {
  const session = await getSessionWithGroup();
  if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });
  return { groupId: session.groupId };
}

export async function GET() {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    const recipes = await getRecipes(gate.groupId);
    return NextResponse.json(recipes);
  } catch {
    return NextResponse.json({ error: 'Fehler beim Laden der Rezepte' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    const recipe: Recipe = await request.json();
    const recipes = await getRecipes(gate.groupId);
    recipes.push(recipe);
    await saveRecipes(recipes, gate.groupId);
    return NextResponse.json(recipe, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    const updated: Recipe = await request.json();
    const recipes = await getRecipes(gate.groupId);
    const idx = recipes.findIndex((r) => r.id === updated.id);
    if (idx === -1) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    recipes[idx] = updated;
    await saveRecipes(recipes, gate.groupId);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    // Fix #9: Reject attempts to delete global template recipes — they belong to
    // all groups and would silently "succeed" before this guard (saveRecipes only
    // persists custom recipes, so the delete appeared to work but did nothing).
    const { getTemplateRecipes } = await import('@/lib/data');
    const templates = await getTemplateRecipes();
    if (templates.some((r) => r.id === id)) {
      return NextResponse.json(
        { error: 'Vorlage-Rezepte können nicht gelöscht werden.' },
        { status: 403 }
      );
    }

    const recipes  = await getRecipes(gate.groupId);
    const filtered = recipes.filter((r) => r.id !== id);
    if (filtered.length === recipes.length) {
      return NextResponse.json({ error: 'Rezept nicht gefunden' }, { status: 404 });
    }
    await saveRecipes(filtered, gate.groupId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
