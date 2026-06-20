/**
 * Swiss supermarket promotion scraper.
 * Primary source: aktionis.ch (food category c=7-, covers all enabled StoreIds).
 * Supports city-based location filtering for regional deal scope.
 *
 * Coop/Migros direct scraping is not possible (bot protection / robots.txt).
 * Direct Lidl scraping removed — aktionis.ch covers Lidl as well.
 */

import type { StoreId, Promotion, PromotionScope } from '@/types';

// Maps aktionis.ch store slug → our StoreId (null = ignore)
const AKTIONIS_STORE_MAP: Record<string, StoreId | null> = {
  'migros':         'migros',
  'coop':           'coop',
  'coop-megastore': 'coop',
  'denner':         'denner',
  'volg':           'volg',
  'lidl':           'lidl',
  'aldi-suisse':    'aldi',
};

const AKTIONIS_PAGES = 5;
const AKTIONIS_BASE  = 'https://www.aktionis.ch';
const FETCH_TIMEOUT  = 9000; // ms per request
const UA = 'Mozilla/5.0 (compatible; MahlZytPlaner-Bot/1.0; +https://www.mahlzyt.app)';

export interface PromotionFetchContext {
  city?: string;
  radiusKm?: number;
}

// ─── HTML parser ──────────────────────────────────────────────────────────────

function parseAktionisPage(
  html:          string,
  enabledStores: StoreId[],
  keywordArr:    string[],
  scope:         PromotionScope,
  sourceUrl:     string,
): Promotion[] {
  const results: Promotion[] = [];
  const rowRe = /<tr[^>]*data-upox-id[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];

    // Product name
    const nameMatch = /<td class="content">\s*<a[^>]*><b>(.*?)<\/b>/.exec(row);
    if (!nameMatch) continue;
    const product = nameMatch[1].trim();
    if (!product) continue;

    // Store slug from logo image src
    const logoCellMatch = /<td class="logo">\s*<img src="([^"]+)"/.exec(row);
    if (!logoCellMatch) continue;
    const logoSlugMatch = /\/minicrop\/(.+?)-[a-f0-9]{8}--/.exec(logoCellMatch[1]);
    if (!logoSlugMatch) continue;
    const storeId = AKTIONIS_STORE_MAP[logoSlugMatch[1]] ?? null;
    if (!storeId || !enabledStores.includes(storeId)) continue;

    // Keyword filter
    const productLower = product.toLowerCase();
    if (!keywordArr.some(kw => productLower.includes(kw))) continue;

    // Discount %
    const discountMatch = /<td class="price-discount">\s*(\d+%)\s*<\/td>/.exec(row);

    // Date range "DD.MM.YYYY - DD.MM.YYYY"
    const dateMatch = /<td class="offer-date hidden-xs">\s*(.*?)\s*<\/td>/.exec(row);
    const dateStr   = dateMatch?.[1]?.trim() ?? '';
    const dateParts = dateStr.split(' - ');
    const validFrom  = dateParts[0]?.trim() || undefined;
    const validUntil = dateParts[1]?.trim() || undefined;

    results.push({
      store: storeId,
      product,
      scope,
      sourceUrl,
      ...(discountMatch && { discount: discountMatch[1] }),
      ...(validFrom  && { validFrom  }),
      ...(validUntil && { validUntil }),
    });
  }
  return results;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Scrape Swiss supermarket promotions, optionally filtered by location.
 *
 * @param enabledStores  Which stores the group has enabled
 * @param ingredientNames All ingredient names from global recipe templates
 * @param ctx            Optional location context for regional filtering
 */
export async function scrapeSwissPromotions(
  enabledStores:   StoreId[],
  ingredientNames: string[],
  ctx?:            PromotionFetchContext,
): Promise<Partial<Record<StoreId, Promotion[]>>> {

  // Keywords: all significant words (≥4 chars) from ingredient names
  const keywordArr = Array.from(new Set(
    ingredientNames.flatMap(n =>
      n.toLowerCase().split(/\s+/).filter(k => k.length >= 4),
    ),
  ));

  const result: Partial<Record<StoreId, Promotion[]>> = {};
  for (const s of enabledStores) result[s] = [];

  if (enabledStores.length === 0) return result;

  // Build per-page URLs — with or without city filter
  const radius = ctx?.radiusKm ?? 10;
  const scope: PromotionScope = ctx?.city ? 'regional' : 'national';

  const buildUrl = (page: number): string => {
    const base = `${AKTIONIS_BASE}/deals?c=7-`;
    const loc  = ctx?.city
      ? `&city=${encodeURIComponent(ctx.city)}&distance=${radius}`
      : '';
    return `${base}${loc}&page=${page}&f=t&empty_search=false`;
  };

  const pageUrls = Array.from({ length: AKTIONIS_PAGES }, (_, i) => buildUrl(i + 1));

  const pageResults = await Promise.allSettled(
    pageUrls.map(url =>
      fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
    ),
  );

  for (let i = 0; i < pageResults.length; i++) {
    const settled = pageResults[i];
    if (settled.status === 'rejected') continue;
    const res = settled.value;
    if (!res.ok) continue;
    try {
      const html   = await res.text();
      const promos = parseAktionisPage(html, enabledStores, keywordArr, scope, pageUrls[i]);
      for (const p of promos) {
        const arr = result[p.store];
        if (arr && !arr.some(e => e.product === p.product)) arr.push(p);
      }
    } catch {
      // parse error — skip page
    }
  }

  return result;
}
