export const dynamic = 'force-dynamic';

/**
 * Merges the bundled seed recipes (data/recipes.json) into Redis.
 *
 * Strategy:
 *  - Neue Rezepte (ID noch nicht in Redis) werden hinzugefügt.
 *  - Bestehende Rezepte werden aktualisiert, aber imageUrl / imageZutaten
 *    aus Redis bleiben erhalten, falls der Seed-Eintrag diese Felder nicht hat
 *    (null / undefined). So gehen online hochgeladene Bilder beim Seeden nicht verloren.
 *  - Rezepte, die in Redis aber nicht im Seed sind, bleiben unverändert.
 */

import { NextResponse }                          from 'next/server';
import { getSession, ADMIN_EMAIL }               from '@/lib/auth';
import { getTemplateRecipes, saveTemplateRecipes } from '@/lib/data';
import seedRecipes                               from '../../../../../../data/recipes.json';
import type { Recipe }                           from '@/types';

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

  // Bestehende Templates aus Redis laden, um Bilder zu bewahren
  const existing    = await getTemplateRecipes();
  const existingMap = new Map(existing.map((r) => [r.id, r]));

  // Seed-Rezepte mit bestehenden Bild-URLs mergen
  const seed = seedRecipes as Recipe[];
  const merged: Recipe[] = seed.map((s) => {
    const ex = existingMap.get(s.id);
    if (!ex) return s;                       // neues Rezept — direkt übernehmen
    return {
      ...s,
      // Bild-URLs aus Redis erhalten, wenn Seed keinen Wert hat
      imageUrl:      s.imageUrl      ?? ex.imageUrl,
      imageZutaten:  s.imageZutaten  ?? ex.imageZutaten,
    };
  });

  // Rezepte aus Redis, die nicht im Seed sind, anhängen (custom/unlisted)
  for (const ex of existing) {
    if (!merged.some((m) => m.id === ex.id)) merged.push(ex);
  }

  await saveTemplateRecipes(merged);

  return NextResponse.json({
    ok: true,
    seeded: seed.length,
    total: merged.length,
    preserved: merged.filter((m) => {
      const s = seed.find((x) => x.id === m.id);
      return s && m.imageUrl && !s.imageUrl;
    }).length,
  });
}
