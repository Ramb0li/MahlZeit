/**
 * Swiss supermarket promotion scraper.
 * Sources:
 *   - aktionis.ch (food category c=7-): migros, coop, denner, volg
 *   - sortiment.lidl.ch: lidl
 *   - aldi-suisse.ch: blocked by CDN — returns empty array
 */

import type { StoreId, Promotion } from '@/types';

// Maps aktionis.ch store slug → our StoreId (null = ignore)
const AKTIONIS_STORE_MAP: Record<string, StoreId | null> = {
  'migros':         'migros',
  'coop':           'coop',
  'coop-megastore': 'coop',  // treat Megastore as Coop
  'denner':         'denner',
  'volg':           'volg',
};

// Pages to scrape from aktionis.ch (sorted by discount % desc — best deals first)
const AKTIONIS_PAGES = 5;
const AKTIONIS_BASE  = 'https://www.aktionis.ch';
const LIDL_URL       = 'https://sortiment.lidl.ch/de/aktuelle-aktionen';
const FETCH_TIMEOUT  = 9000; // ms per request
const UA = 'Mozilla/5.0 (compatible; MahlZeitPlaner-Bot/1.0; +https://mahlzeit.o-v-k.ch)';

// ─── HTML parsers ─────────────────────────────────────────────────────────────

/** Parse one aktionis.ch page and return matching promotions */
function parseAktionisPage(
  html:           string,
  enabledStores:  StoreId[],
  keywordArr:     string[],
): Promotion[] {
  const results: Promotion[] = [];
  const rowRe = /<tr[^>]*data-upox-id[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];

    // Product name from <td class="content"><a ...><b>NAME</b>
    const nameMatch = /<td class="content">\s*<a[^>]*><b>(.*?)<\/b>/.exec(row);
    if (!nameMatch) continue;
    const product = nameMatch[1].trim();
    if (!product) continue;

    // Store from the <td class="logo"> image src (separate from product image)
    const logoCellMatch = /<td class="logo">\s*<img src="([^"]+)"/.exec(row);
    if (!logoCellMatch) continue;
    const logoSlugMatch = /\/minicrop\/(.+?)-[a-f0-9]{8}--/.exec(logoCellMatch[1]);
    if (!logoSlugMatch) continue;
    const storeId = AKTIONIS_STORE_MAP[logoSlugMatch[1]] ?? null;
    if (!storeId || !enabledStores.includes(storeId)) continue;

    // Ingredient keyword match
    const productLower = product.toLowerCase();
    if (!keywordArr.some(kw => productLower.includes(kw))) continue;

    // Discount % (optional)
    const discountMatch = /<td class="price-discount">\s*(\d+%)\s*<\/td>/.exec(row);

    // Valid-until date from <td class="offer-date hidden-xs">DD.MM.YYYY - DD.MM.YYYY</td>
    const dateMatch = /<td class="offer-date hidden-xs">\s*(.*?)\s*<\/td>/.exec(row);
    const validUntil = dateMatch?.[1]?.split(' - ')[1]?.trim();

    results.push({
      store: storeId,
      product,
      ...(discountMatch && { discount: discountMatch[1] }),
      ...(validUntil     && { validUntil }),
    });
  }
  return results;
}

/** Parse Lidl promotions page (Magento-based, SSR) */
function parseLidlPage(html: string, keywordArr: string[]): Promotion[] {
  const results: Promotion[] = [];
  const nameRe = /<strong[^>]*class="[^"]*product[^"]*name[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/strong>/g;
  let m: RegExpExecArray | null;

  while ((m = nameRe.exec(html)) !== null) {
    const product = m[1].replace(/<[^>]+>/g, '').trim();
    if (!product) continue;
    const productLower = product.toLowerCase();
    if (!keywordArr.some(kw => productLower.includes(kw))) continue;
    results.push({ store: 'lidl', product });
  }
  return results;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Scrape Swiss supermarket promotions and filter to recipe ingredients only.
 *
 * @param enabledStores  Which stores the group has enabled
 * @param ingredientNames All ingredient names from global recipe templates
 * @returns Partial cache update — only keys for stores that were scraped
 */
export async function scrapeSwissPromotions(
  enabledStores:   StoreId[],
  ingredientNames: string[],
): Promise<Partial<Record<StoreId, Promotion[]>>> {

  // Keyword array: first word of each ingredient name, min 3 chars (avoids noise from "ei", "öl")
  const keywordArr = Array.from(new Set(
    ingredientNames
      .map(n => n.toLowerCase().split(/\s+/)[0])
      .filter(k => k.length >= 3),
  ));

  // Initialise result for all enabled stores
  const result: Partial<Record<StoreId, Promotion[]>> = {};
  for (const s of enabledStores) result[s] = [];

  const needsAktionis = enabledStores.some(s =>
    (['migros', 'coop', 'denner', 'volg'] as StoreId[]).includes(s)
  );
  const needsLidl = enabledStores.includes('lidl');

  // ── aktionis.ch ──────────────────────────────────────────────────────────────
  if (needsAktionis) {
    const pageUrls = [
      `${AKTIONIS_BASE}/deals?c=7-&page=1&f=t&empty_search=false`,
      ...Array.from({ length: AKTIONIS_PAGES - 1 }, (_, i) =>
        `${AKTIONIS_BASE}/deals/${i + 2}?c=7-&page=1&f=t&empty_search=false`,
      ),
    ];

    for (const url of pageUrls) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const promos = parseAktionisPage(html, enabledStores, keywordArr);
        for (const p of promos) {
          const arr = result[p.store];
          if (arr && !arr.some(e => e.product === p.product)) arr.push(p);
        }
      } catch {
        // timeout or network error — skip this page
      }
    }
  }

  // ── Lidl ──────────────────────────────────────────────────────────────────────
  if (needsLidl) {
    try {
      const res = await fetch(LIDL_URL, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (res.ok) {
        const html = await res.text();
        result['lidl'] = parseLidlPage(html, keywordArr);
      }
    } catch {
      // blocked or timeout — stays as []
    }
  }

  // ── Aldi: CDN blocks headless fetches — empty array stays ────────────────────

  return result;
}
