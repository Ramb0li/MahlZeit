export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPromotions, savePromotions, getSettings, saveSettings } from '@/lib/data';
import { getSessionWithGroup as getSession } from '@/lib/session';
import type { PromotionsCache, Promotion, StoreId } from '@/types';

const ALL_STORES: StoreId[] = ['migros', 'coop', 'denner', 'aldi', 'lidl', 'volg'];

export async function GET() {
  try {
    const [cached, session] = await Promise.all([getPromotions(), getSession()]);
    const settings = session?.groupId ? await getSettings(session.groupId) : null;
    const enabledStores: StoreId[] = settings?.promotions?.enabledStores ?? ALL_STORES;

    const merged: PromotionsCache = {
      lastUpdated: cached.lastUpdated,
      locationContext: cached.locationContext,
      migros: [], coop: [], denner: [], aldi: [], lidl: [], volg: [],
    };

    for (const store of ALL_STORES) {
      if (!enabledStores.includes(store)) {
        merged[store] = [];
        continue;
      }
      const cachedArr: Promotion[] = cached[store] ?? [];
      // Backward-compat: merge legacy manual text entries if present
      const capStore = store.charAt(0).toUpperCase() + store.slice(1);
      const manualKey = `manual${capStore}` as 'manualMigros' | 'manualCoop' | 'manualLidl';
      const manualRaw = settings?.promotions?.[manualKey] as string[] | undefined;
      const manual: Promotion[] = (manualRaw ?? [])
        .map((p): Promotion => ({ store, product: p }))
        .filter(m => !cachedArr.some(c => c.product === m.product));
      merged[store] = [...cachedArr, ...manual];
    }

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.manual) {
      // Legacy manual save — kept for backward compat
      const session = await getSession();
      if (!session?.groupId) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 403 });
      const settings = await getSettings(session.groupId);
      if (body.store === 'migros') settings.promotions.manualMigros = body.items;
      if (body.store === 'coop')   settings.promotions.manualCoop   = body.items;
      if (body.store === 'lidl')   settings.promotions.manualLidl   = body.items;
      await saveSettings(settings, session.groupId);
    } else {
      await savePromotions(body);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
