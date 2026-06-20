export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getSettings, getPromotions, savePromotions, getTemplateRecipes } from '@/lib/data';
import { scrapeSwissPromotions } from '@/lib/scrapePromotions';
import type { StoreId, PromotionScope } from '@/types';

const REFRESH_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 Stunden

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

    // Rate-Limit: max 1× pro 12 Stunden (globaler Cache, gilt für alle Gruppen)
    const existing = await getPromotions();
    if (existing.lastUpdated) {
      const ageMs = Date.now() - new Date(existing.lastUpdated).getTime();
      if (ageMs < REFRESH_COOLDOWN_MS) {
        const nextMs    = new Date(existing.lastUpdated).getTime() + REFRESH_COOLDOWN_MS;
        const retryIn   = Math.ceil((nextMs - Date.now()) / 1000);
        const hoursLeft = Math.ceil(retryIn / 3600);
        return NextResponse.json(
          {
            error:       `Aktionen wurden erst kürzlich geladen. Nächste Aktualisierung in ${hoursLeft} Stunde${hoursLeft === 1 ? '' : 'n'} möglich.`,
            nextRefresh: new Date(nextMs).toISOString(),
          },
          { status: 429, headers: { 'Retry-After': String(retryIn) } },
        );
      }
    }

    const settings = await getSettings(session.groupId);
    const enabledStores: StoreId[] = settings.promotions?.enabledStores ?? ['migros', 'coop', 'lidl'];

    // Location context from weather settings
    const city   = settings.weather?.location?.trim() || undefined;
    const radius = settings.promotions?.radiusKm ?? 10;
    const scope: PromotionScope = city ? 'regional' : 'national';

    const recipes = await getTemplateRecipes();
    const ingredientNames = Array.from(
      new Set(recipes.flatMap(r => r.ingredients.map(i => i.name))),
    );

    const scraped = await scrapeSwissPromotions(
      enabledStores,
      ingredientNames,
      { city, radiusKm: radius },
    );

    const updated = {
      ...existing,
      ...scraped,
      lastUpdated: new Date().toISOString(),
      locationContext: {
        city,
        distance: radius,
        scope,
      },
    };
    await savePromotions(updated);

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
