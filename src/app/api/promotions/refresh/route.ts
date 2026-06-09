export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getSettings, getPromotions, savePromotions, getTemplateRecipes } from '@/lib/data';
import { scrapeSwissPromotions } from '@/lib/scrapePromotions';
import type { StoreId } from '@/types';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

    // Determine which stores are enabled for this group
    const settings = await getSettings(session.groupId);
    const enabledStores: StoreId[] = settings.promotions?.enabledStores ?? ['migros', 'coop', 'lidl'];

    // Collect all ingredient names from global recipe templates
    const recipes = await getTemplateRecipes();
    const ingredientNames = Array.from(
      new Set(recipes.flatMap(r => r.ingredients.map(i => i.name))),
    );

    // Scrape enabled stores
    const scraped = await scrapeSwissPromotions(enabledStores, ingredientNames);

    // Merge into existing global cache (only update stores that were scraped)
    const existing = await getPromotions();
    const updated = {
      ...existing,
      ...scraped,
      lastUpdated: new Date().toISOString(),
    };
    await savePromotions(updated);

    // Build counts for response
    const counts: Record<string, number> = {};
    for (const s of enabledStores) {
      counts[s] = (updated[s as keyof typeof updated] as unknown[])?.length ?? 0;
    }

    return NextResponse.json({ success: true, lastUpdated: updated.lastUpdated, counts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    console.error('[promotions/refresh]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
