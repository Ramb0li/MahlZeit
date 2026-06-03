export const dynamic = 'force-dynamic';

/**
 * Admin-only export: returns the current template recipes as a downloadable JSON file.
 * Use this to sync Redis edits back into the local repo (data/recipes.json).
 *
 * Workflow:
 *   1. Edit recipes in prod via /admin
 *   2. Download via this route
 *   3. Replace data/recipes.json locally
 *   4. git push → new deployment bundles updated JSON as seed
 */

import { NextResponse }           from 'next/server';
import { getSession, ADMIN_EMAIL } from '@/lib/auth';
import { getTemplateRecipes }     from '@/lib/data';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const recipes  = await getTemplateRecipes();
  const filename = `recipes-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(recipes, null, 2), {
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
