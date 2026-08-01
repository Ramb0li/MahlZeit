/**
 * SSRF-Schutz für den Rezept-Import.
 *
 * Der Import holt eine vom Nutzer angegebene URL serverseitig ab. Ohne Prüfung
 * liesse sich damit das interne Netz der Hosting-Umgebung abfragen — allen voran
 * der Cloud-Metadata-Endpunkt 169.254.169.254.
 *
 * Bewusst als eigenes Modul (statt in der Route), damit die Prüfung ohne
 * Next.js-Laufzeit getestet werden kann.
 */

/** Private bzw. reservierte IPv4-Bereiche. */
function isPrivateIpv4(a: number, b: number): boolean {
  if (a === 0)   return true;                       // 0.0.0.0/8
  if (a === 10)  return true;                       // 10.0.0.0/8
  if (a === 127) return true;                       // 127.0.0.0/8 — gesamtes Loopback
  if (a === 169 && b === 254) return true;          // 169.254.0.0/16 — link-local, Cloud-Metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  return false;
}

/**
 * true, wenn die URL gefahrlos serverseitig abgerufen werden darf.
 *
 * Deckt ab: Nicht-HTTP-Protokolle, localhost, Punkt- und Dezimalnotation von
 * IPv4, IPv4-mapped IPv6, private IPv6-Bereiche sowie interne Hostnamen.
 * Nicht abgedeckt: DNS-Rebinding (ein Name, der erst bei der Auflösung auf eine
 * interne Adresse zeigt) — dafür wäre eine Auflösung vor dem Verbindungsaufbau
 * nötig, die die Fetch-API nicht anbietet.
 */
export function isSafeExternalUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

  // Eckige Klammern gehören zur IPv6-Notation, nicht zur Adresse selbst
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;

  if (host === 'localhost' || host === '::1' || host === '::') return false;
  if (host === 'metadata.google.internal') return false;

  // IPv4 in Punktnotation
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return false;
    return !isPrivateIpv4(parts[0], parts[1]);
  }

  // IPv4 als reine Dezimalzahl — http://2130706433/ ist 127.0.0.1
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isSafeInteger(n) || n > 0xffffffff) return false;
    return !isPrivateIpv4((n >>> 24) & 0xff, (n >>> 16) & 0xff);
  }

  // IPv6
  if (host.includes(':')) {
    const mapped = host.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (mapped) {
      const parts = mapped.slice(1).map(Number);
      if (parts.some((n) => n > 255)) return false;
      return !isPrivateIpv4(parts[0], parts[1]);
    }
    if (/^f[cd]/.test(host))   return false; // fc00::/7  Unique Local
    if (/^fe[89ab]/.test(host)) return false; // fe80::/10 Link Local
    return false; // sonstige IPv6-Literale werden für Rezept-Importe nicht gebraucht
  }

  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return false;
  }

  return true;
}

export const MAX_REDIRECTS = 3;

/**
 * Holt eine externe Seite und prüft JEDEN Redirect-Hop erneut.
 *
 * `fetch` folgt Weiterleitungen sonst automatisch — eine erlaubte Domain könnte
 * damit per 302 auf http://169.254.169.254/ zeigen und den Guard aushebeln.
 * Genau deshalb steht hier `redirect: 'manual'`.
 */
export async function fetchExternalHtml(startUrl: string): Promise<string> {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeExternalUrl(url)) throw new Error('Weiterleitung auf nicht erlaubtes Ziel.');

    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; MahlZytPlaner/1.0; recipe-import)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'de,en;q=0.9',
      },
      redirect: 'manual',
      signal:   AbortSignal.timeout(10_000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`HTTP ${res.status} ohne Ziel-Adresse`);
      url = new URL(location, url).toString(); // relative Redirects auflösen
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  throw new Error('Zu viele Weiterleitungen.');
}
