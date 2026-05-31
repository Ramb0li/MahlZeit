export const dynamic = 'force-dynamic';

/**
 * Admin-only API für Template-Rezepte.
 * Lokal: liest/schreibt direkt in data/recipes/<folder>/<id>.json + rebuildet recipes.json.
 * Prod:  GET funktioniert, Mutationen geben 501 (erfordern Deploy).
 */

import { NextResponse }           from 'next/server';
import { getSession, ADMIN_EMAIL } from '@/lib/auth';
import { getTemplateRecipes }     from '@/lib/data';
import type { Recipe }            from '@/types';

const USE_REDIS = Boolean(process.env.UPSTASH_REDIS_REST_URL);

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

// ─── Lokale Helfer ────────────────────────────────────────────────────────────

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
  'Snacks':         'snacks',
  'Brot & Aufstrich': 'brot-aufstrich',
  'Frühstück':      'frühstück',
  'Süsses':         'süsses',
  'Sonstige':       'sonstige',
  'Pasta':          'pasta',
  'Reis':           'reis',
  'Eier':           'eier',
  'Fisch':          'fisch',
  'Suppen':         'suppen',
  'Salat/Bowl':     'salat-bowl',
  'Eintopf/Gratin': 'eintopf-gratin',
  'Ofen':           'ofen',
  'Asiatisch':      'asiatisch',
};

function rebuild() {
  const { execSync } = require('child_process') as typeof import('child_process');
  execSync('node scripts/build-recipes.js', { cwd: process.cwd(), stdio: 'pipe' });
}

const PROD_ERROR = 'In Produktion erfordern Template-Änderungen ein Deployment (lokal bearbeiten → git push).';

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

  if (USE_REDIS) return NextResponse.json({ error: PROD_ERROR }, { status: 501 });

  const updated: Recipe = await request.json();
  const fs      = require('fs') as typeof import('fs');
  const filePath = findRecipeFile(updated.id);

  if (!filePath) return NextResponse.json({ error: `Datei für ${updated.id} nicht gefunden.` }, { status: 404 });

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  rebuild();
  return NextResponse.json({ ok: true, recipe: updated });
}

export async function POST(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  if (USE_REDIS) return NextResponse.json({ error: PROD_ERROR }, { status: 501 });

  const recipe: Recipe = await request.json();
  const fs   = require('fs')   as typeof import('fs');
  const path = require('path') as typeof import('path');
  const folder  = CATEGORY_FOLDER[recipe.category] ?? 'sonstige';
  const dir     = path.join(process.cwd(), 'data', 'recipes', folder);

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${recipe.id}.json`), JSON.stringify(recipe, null, 2), 'utf-8');
  rebuild();
  return NextResponse.json({ ok: true, recipe });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  if (USE_REDIS) return NextResponse.json({ error: PROD_ERROR }, { status: 501 });

  const { id } = await request.json() as { id: string };
  const fs = require('fs') as typeof import('fs');
  const filePath = findRecipeFile(id);

  if (!filePath) return NextResponse.json({ error: `Datei für ${id} nicht gefunden.` }, { status: 404 });

  fs.unlinkSync(filePath);
  rebuild();
  return NextResponse.json({ ok: true });
}
