export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup } from '@/lib/session';
import { getRecipes, getVisibleRecipes, saveRecipes } from '@/lib/data';
import type { Recipe } from '@/types';

async function requireGroup(): Promise<{ groupId: string } | NextResponse> {
  const session = await getSessionWithGroup();
  if (!session)         return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!session.groupId) return NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 });
  return { groupId: session.groupId };
}

/** Obergrenze für einen Rezept-Datensatz — schützt Redis vor aufgeblähten Payloads. */
const MAX_RECIPE_BYTES = 128 * 1024;

/**
 * Minimalvalidierung der eingehenden Rezeptdaten. Vorher wurde der Request-Body
 * ungeprüft übernommen und direkt persistiert.
 * Gibt null zurück, wenn alles in Ordnung ist, sonst die Fehlermeldung.
 */
function validateRecipe(input: unknown): string | null {
  if (!input || typeof input !== 'object') return 'Ungültige Daten.';
  const r = input as Record<string, unknown>;

  if (typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(r.id)) {
    return 'Ungültige Rezept-ID.';
  }
  if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > 200) {
    return 'Name fehlt oder ist zu lang.';
  }
  if (typeof r.category !== 'string' || !r.category.trim()) {
    return 'Kategorie fehlt.';
  }
  if (!Array.isArray(r.ingredients) || r.ingredients.length > 200) {
    return 'Zutatenliste fehlt oder ist zu lang.';
  }
  if (r.steps !== undefined && (!Array.isArray(r.steps) || r.steps.length > 100)) {
    return 'Zubereitungsschritte ungültig.';
  }
  if (r.timeMinutes !== undefined &&
      (typeof r.timeMinutes !== 'number' || r.timeMinutes < 0 || r.timeMinutes > 10_000)) {
    return 'Zeitangabe ungültig.';
  }
  if (r.basePortions !== undefined &&
      (typeof r.basePortions !== 'number' || r.basePortions < 1 || r.basePortions > 100)) {
    return 'Portionenzahl ungültig.';
  }
  if (JSON.stringify(input).length > MAX_RECIPE_BYTES) {
    return 'Rezept ist zu gross.';
  }
  return null;
}

export async function GET() {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    return NextResponse.json(await getVisibleRecipes(gate.groupId));
  } catch {
    return NextResponse.json({ error: 'Fehler beim Laden der Rezepte' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    const recipe: Recipe = await request.json();
    const invalid = validateRecipe(recipe);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const withApproved: Recipe = { ...recipe, approved: true };
    const recipes = await getRecipes(gate.groupId);
    if (recipes.some((r) => r.id === withApproved.id)) {
      return NextResponse.json({ error: 'Ein Rezept mit dieser ID existiert bereits.' }, { status: 409 });
    }
    recipes.push(withApproved);
    await saveRecipes(recipes, gate.groupId);
    return NextResponse.json(withApproved, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const gate = await requireGroup();
    if (gate instanceof NextResponse) return gate;
    const updated: Recipe = await request.json();
    const invalid = validateRecipe(updated);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

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
