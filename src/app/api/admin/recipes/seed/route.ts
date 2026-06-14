export const dynamic = 'force-dynamic';

/**
 * Schreibt die gebündelten Seed-Rezepte (data/recipes.json) autoritär nach Redis.
 *
 * Strategy via Seed-Manifest:
 *  - Ein "Seed-Manifest" (mz:recipes:seed_manifest) speichert die IDs des letzten Seeds.
 *  - Beim Seeden gilt:
 *      1. Seed-Rezepte → immer in Redis (mit Bild-URL-Erhalt aus Redis).
 *      2. Redis-Rezepte die im alten Manifest waren, aber nicht mehr im neuen Seed
 *         → werden ENTFERNT (absichtlich gelöscht).
 *      3. Redis-Rezepte die NIE im Manifest waren (via Admin-Import hinzugefügt)
 *         → bleiben ERHALTEN.
 *  - So können Template-Rezepte sauber gelöscht werden, ohne Admin-importe zu verlieren.
 */

import { NextResponse }                          from 'next/server';
import { getSession, ADMIN_EMAIL }               from '@/lib/auth';
import { getTemplateRecipes, saveTemplateRecipes } from '@/lib/data';
import seedRecipes                               from '../../../../../../data/recipes.json';
import type { Recipe }                           from '@/types';

// Inline Redis-Zugriff für das Manifest (kein Export nötig)
import { Redis } from '@upstash/redis';
const MANIFEST_KEY = 'mz:recipes:seed_manifest';

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

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

  const redis = getRedis();

  // Altes Seed-Manifest laden (IDs die beim letzten Seed vorhanden waren)
  const oldManifest: string[] = (await redis.get<string[]>(MANIFEST_KEY)) ?? [];
  const oldManifestSet = new Set(oldManifest);

  // Bestehende Templates aus Redis laden
  const existing    = await getTemplateRecipes();
  const existingMap = new Map(existing.map((r) => [r.id, r]));

  const seed    = seedRecipes as Recipe[];
  const seedIds = new Set(seed.map((s) => s.id));

  // 1. Seed-Rezepte mit bestehenden Bild-URLs mergen; approved-Status aus Redis erhalten
  const merged: Recipe[] = seed.map((s) => {
    const ex = existingMap.get(s.id);
    if (!ex) return { ...s, approved: false };
    return {
      ...s,
      approved:      ex.approved,   // bestehende Freigabe erhalten, nicht überschreiben
      imageUrl:      s.imageUrl      ?? ex.imageUrl,
      imageZutaten:  s.imageZutaten  ?? ex.imageZutaten,
      imageKochen:   s.imageKochen   ?? ex.imageKochen,
    };
  });

  // 2. Redis-Rezepte die NICHT im Seed sind:
  //    - Im alten Manifest (= frühere Template-Rezepte) → ENTFERNEN (absichtlich gelöscht)
  //    - Nicht im Manifest (= via Admin-Import hinzugefügt) → BEHALTEN
  let removedCount = 0;
  let preservedCount = 0;
  for (const ex of existing) {
    if (seedIds.has(ex.id)) continue; // bereits in merged (seed)
    if (oldManifestSet.has(ex.id)) {
      removedCount++; // war im alten Seed, nicht mehr im neuen → löschen
    } else {
      merged.push(ex); // nie im Seed → Admin-Import → behalten
      preservedCount++;
    }
  }

  // 3. Neues Manifest speichern (exakt die IDs des aktuellen Seeds)
  await redis.set(MANIFEST_KEY, Array.from(seedIds));

  await saveTemplateRecipes(merged);

  return NextResponse.json({
    ok:        true,
    seeded:    seed.length,
    removed:   removedCount,
    preserved: preservedCount,
    total:     merged.length,
  });
}
