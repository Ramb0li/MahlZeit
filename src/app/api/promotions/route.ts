import { NextResponse } from 'next/server';
import { getPromotions, savePromotions, getSettings, saveSettings } from '@/lib/data';
import type { PromotionsCache, Promotion } from '@/types';

export async function GET() {
  try {
    const [cached, settings] = await Promise.all([getPromotions(), getSettings()]);

    const manualMigros: Promotion[] = settings.promotions.manualMigros.map((p) => ({ store: 'migros' as const, product: p }));
    const manualCoop:   Promotion[] = settings.promotions.manualCoop.map((p)   => ({ store: 'coop'   as const, product: p }));
    const manualLidl:   Promotion[] = settings.promotions.manualLidl.map((p)   => ({ store: 'lidl'   as const, product: p }));

    const merged: PromotionsCache = {
      lastUpdated: cached.lastUpdated,
      migros: [...cached.migros, ...manualMigros],
      coop:   [...cached.coop,   ...manualCoop],
      lidl:   [...cached.lidl,   ...manualLidl],
    };

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.manual) {
      const settings = await getSettings();
      if (body.store === 'migros') settings.promotions.manualMigros = body.items;
      if (body.store === 'coop')   settings.promotions.manualCoop   = body.items;
      if (body.store === 'lidl')   settings.promotions.manualLidl   = body.items;
      await saveSettings(settings);
    } else {
      await savePromotions(body);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
