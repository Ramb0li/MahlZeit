export const dynamic = 'force-dynamic';

/**
 * Zutaten-Verwaltung für den Admin-Bereich.
 *
 * GET   liefert den aus den Rezepten abgeleiteten Zutaten-Index.
 * POST  liefert die Vorschau eines Umbenennens, ohne zu speichern.
 * PATCH führt das Umbenennen aus.
 *
 * Vorschau und Ausführung nutzen dieselben Funktionen aus src/lib/ingredientIndex.ts.
 * Sie können deshalb nicht auseinanderlaufen — was die Vorschau zeigt, ist genau
 * das, was gespeichert wird.
 */

import { NextResponse }                            from 'next/server';
import { getSession, ADMIN_EMAIL }                 from '@/lib/auth';
import { getTemplateRecipes, saveTemplateRecipes } from '@/lib/data';
import { buildIngredientIndex, planRename, applyRename, ingredientKey } from '@/lib/ingredientIndex';
import { writeRecipeFile, rebuildRecipesJson }     from '@/lib/recipeFiles';
import type { Recipe }                             from '@/types';

const USE_REDIS = Boolean(process.env.UPSTASH_REDIS_REST_URL);

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

interface RenameBody {
  von?:             unknown;
  nach?:            unknown;
  auchInSchritten?: unknown;
}

/** Prüft den Rumpf und gibt entweder die Werte oder eine Fehlerantwort zurück. */
function parseBody(body: RenameBody):
  | { ok: true; von: string[]; nach: string; auchInSchritten: boolean }
  | { ok: false; response: NextResponse } {

  const von = Array.isArray(body.von) ? body.von.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [];
  const nach = typeof body.nach === 'string' ? body.nach.trim() : '';

  if (von.length === 0) {
    return { ok: false, response: NextResponse.json({ error: '«von» fehlt oder ist leer.' }, { status: 400 }) };
  }
  if (!nach) {
    return { ok: false, response: NextResponse.json({ error: '«nach» fehlt oder ist leer.' }, { status: 400 }) };
  }
  // Ein Zielname, der selbst wieder auf einen der Quellnamen zeigt, wäre eine
  // Umbenennung ohne Wirkung — lieber melden als stillschweigend nichts tun.
  if (von.length === 1 && ingredientKey(von[0]) === ingredientKey(nach) && von[0] === nach) {
    return { ok: false, response: NextResponse.json({ error: 'Quelle und Ziel sind identisch.' }, { status: 400 }) };
  }

  return { ok: true, von, nach, auchInSchritten: body.auchInSchritten !== false };
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const recipes = await getTemplateRecipes();
  return NextResponse.json({ entries: buildIngredientIndex(recipes), recipeCount: recipes.length });
}

export async function POST(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const parsed = parseBody(await request.json());
  if (!parsed.ok) return parsed.response;

  const recipes = await getTemplateRecipes();
  const changes = planRename(recipes, parsed.von, parsed.nach, parsed.auchInSchritten);

  return NextResponse.json({
    changes,
    rezepte:  changes.length,
    zutaten:  changes.reduce((n, c) => n + c.zutaten.length, 0),
    schritte: changes.reduce((n, c) => n + c.schritte.length, 0),
  });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const parsed = parseBody(await request.json());
  if (!parsed.ok) return parsed.response;
  const { von, nach, auchInSchritten } = parsed;

  const recipes  = await getTemplateRecipes();
  const betroffen = new Set(planRename(recipes, von, nach, auchInSchritten).map(c => c.recipeId));
  if (betroffen.size === 0) {
    return NextResponse.json({ ok: true, geaendert: 0, hinweis: 'Keine Rezepte betroffen.' });
  }

  const aktualisiert: Recipe[] = recipes.map(r =>
    betroffen.has(r.id) ? applyRename(r, von, nach, auchInSchritten) : r,
  );

  if (USE_REDIS) {
    await saveTemplateRecipes(aktualisiert);
    return NextResponse.json({ ok: true, geaendert: betroffen.size });
  }

  // Dev: Einzeldateien schreiben, danach data/recipes.json neu bauen.
  const fehlend: string[] = [];
  for (const r of aktualisiert) {
    if (!betroffen.has(r.id)) continue;
    if (!writeRecipeFile(r.id, r)) fehlend.push(r.id);
  }
  rebuildRecipesJson();

  return NextResponse.json({
    ok: true,
    geaendert: betroffen.size - fehlend.length,
    ...(fehlend.length ? { ohneDatei: fehlend } : {}),
  });
}
