export const dynamic = 'force-dynamic';

/**
 * Admin-only API für Template-Rezepte.
 * Prod (USE_REDIS):  liest/schreibt Upstash Redis (mz:recipes).
 * Lokal (!USE_REDIS): liest/schreibt data/recipes/<folder>/<id>.json + rebuildet recipes.json.
 */

import { NextResponse }                      from 'next/server';
import { getSession, ADMIN_EMAIL }            from '@/lib/auth';
import { getTemplateRecipes, saveTemplateRecipes } from '@/lib/data';
import type { Recipe }                        from '@/types';

const USE_REDIS = Boolean(process.env.UPSTASH_REDIS_REST_URL);

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

// ─── Lokale Helfer (nur dev) ──────────────────────────────────────────────────

function findRecipeFile(id: string): string | null {
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const dir  = path.join(process.cwd(), 'data', 'recipes');
  for (const sub of fs.readdirSync(dir)) {
    const candidate = path.join(dir, sub, `${id}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

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

function rebuild() {
  const { execSync } = require('child_process') as typeof import('child_process');
  execSync('node scripts/build-recipes.js', { cwd: process.cwd(), stdio: 'pipe' });
}

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

  if (USE_REDIS) {
    const all = await getTemplateRecipes();
    if (all.some(r => r.id === recipe.id))
      return NextResponse.json({ error: 'ID bereits vergeben.' }, { status: 409 });
    await saveTemplateRecipes([...all, recipe]);
    return NextResponse.json({ ok: true, recipe });
  }

  // Dev: write to individual category file + rebuild
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const folder = CATEGORY_FOLDER[recipe.category] ?? 'sonstige';
  const dir    = path.join(process.cwd(), 'data', 'recipes', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${recipe.id}.json`), JSON.stringify(recipe, null, 2), 'utf-8');
  rebuild();
  return NextResponse.json({ ok: true, recipe });
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
