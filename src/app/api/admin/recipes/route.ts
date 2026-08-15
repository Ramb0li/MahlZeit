export const dynamic = 'force-dynamic';

/**
 * Admin-only API für Template-Rezepte.
 * Prod (USE_REDIS):  liest/schreibt Upstash Redis (mz:recipes).
 * Lokal (!USE_REDIS): liest/schreibt data/recipes/<folder>/<id>.json + rebuildet recipes.json.
 */

import { NextResponse }                      from 'next/server';
import { getSession, ADMIN_EMAIL }            from '@/lib/auth';
import { getTemplateRecipes, saveTemplateRecipes } from '@/lib/data';
import { findRecipeFile, rebuildRecipesJson }  from '@/lib/recipeFiles';
import type { Recipe }                        from '@/types';

const USE_REDIS = Boolean(process.env.UPSTASH_REDIS_REST_URL);

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

/**
 * Die Freigabe wird serverseitig nicht mehr verweigert. Offene Punkte (Lizenzstatus,
 * fremdes Bild, fehlende Neufassung) zeigt das Admin-Panel über approvalWarnings()
 * als Hinweis an; die Entscheidung trifft die Redaktion.
 */

// ─── Lokale Helfer (nur dev) ──────────────────────────────────────────────────
// findRecipeFile und rebuildRecipesJson liegen in src/lib/recipeFiles.ts, weil
// die Zutaten-Route denselben Weg braucht.

const CATEGORY_FOLDER: Record<string, string> = {
  'Snacks':                      'snacks',
  'Brot & Aufstrich':            'brot-aufstrich',
  'Frühstück':                   'frühstück',
  'Süsses':                      'süsses',
  'Sonstige':                    'sonstige',
  'Pasta':                       'pasta',
  'Reis':                        'reis',
  'Eier':                        'eier',
  'Fisch':                       'fisch',
  'Suppen':                      'suppen',
  'Salat/Bowl':                  'salat-bowl',
  'Eintopf/Gratin':              'eintopf-gratin',
  'Ofen':                        'ofen',
  'Asiatisch':                   'asiatisch',
};

const rebuild = rebuildRecipesJson;

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  const templates = await getTemplateRecipes();
  return NextResponse.json(templates);
}

export async function PUT(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const updated: Recipe = await request.json();

  if (USE_REDIS) {
    const all    = await getTemplateRecipes();
    const newAll = all.map(r => r.id === updated.id ? updated : r);
    if (!newAll.some(r => r.id === updated.id))
      return NextResponse.json({ error: `Rezept ${updated.id} nicht gefunden.` }, { status: 404 });
    await saveTemplateRecipes(newAll);
    return NextResponse.json({ ok: true, recipe: updated });
  }

  // Dev: write individual file + rebuild
  const fs       = require('fs') as typeof import('fs');
  const filePath = findRecipeFile(updated.id);
  if (!filePath)
    return NextResponse.json({ error: `Datei für ${updated.id} nicht gefunden.` }, { status: 404 });
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  rebuild();
  return NextResponse.json({ ok: true, recipe: updated });
}

export async function POST(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const recipe: Recipe = await request.json();
  const withDefault: Recipe = { ...recipe, approved: recipe.approved ?? false };

  if (USE_REDIS) {
    const all = await getTemplateRecipes();
    if (all.some(r => r.id === withDefault.id))
      return NextResponse.json({ error: 'ID bereits vergeben.' }, { status: 409 });
    await saveTemplateRecipes([...all, withDefault]);
    return NextResponse.json({ ok: true, recipe: withDefault });
  }

  // Dev: write to individual category file + rebuild
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const folder = CATEGORY_FOLDER[withDefault.category] ?? 'sonstige';
  const dir    = path.join(process.cwd(), 'data', 'recipes', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${withDefault.id}.json`), JSON.stringify(withDefault, null, 2), 'utf-8');
  rebuild();
  return NextResponse.json({ ok: true, recipe: withDefault });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { id } = await request.json() as { id: string };

  if (USE_REDIS) {
    const all    = await getTemplateRecipes();
    const newAll = all.filter(r => r.id !== id);
    if (newAll.length === all.length)
      return NextResponse.json({ error: `Rezept ${id} nicht gefunden.` }, { status: 404 });
    await saveTemplateRecipes(newAll);
    return NextResponse.json({ ok: true });
  }

  // Dev: delete individual file + rebuild
  const fs       = require('fs') as typeof import('fs');
  const filePath = findRecipeFile(id);
  if (!filePath)
    return NextResponse.json({ error: `Datei für ${id} nicht gefunden.` }, { status: 404 });
  fs.unlinkSync(filePath);
  rebuild();
  return NextResponse.json({ ok: true });
}
