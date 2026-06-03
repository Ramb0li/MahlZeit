export const dynamic = 'force-dynamic';

/**
 * Writes the bundled seed recipes (data/recipes.json as built into this deployment)
 * to Redis, overwriting whatever is currently stored there.
 *
 * Use this once after a deployment that bumps the recipe count, to sync Redis
 * with the latest bundled data.  Any manual edits made in prod after this call
 * will be lost — always Export JSON first if you need to preserve them.
 */

import { NextResponse }            from 'next/server';
import { getSession, ADMIN_EMAIL } from '@/lib/auth';
import { saveTemplateRecipes }     from '@/lib/data';
import seedRecipes                 from '../../../../../../data/recipes.json';
import type { Recipe }             from '@/types';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function POST() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  if (!process.env.UPSTASH_REDIS_REST_URL)
    return NextResponse.json({ error: 'Nur in Produktion verfügbar (Redis nicht konfiguriert).' }, { status: 400 });

  await saveTemplateRecipes(seedRecipes as Recipe[]);

  return NextResponse.json({ ok: true, count: seedRecipes.length });
}
