import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSafeExternalUrl, fetchExternalHtml } from '../urlGuard';

afterEach(() => { vi.unstubAllGlobals(); });

describe('isSafeExternalUrl — erlaubte Ziele', () => {
  it('laesst normale Rezeptseiten durch', () => {
    expect(isSafeExternalUrl('https://fooby.ch/de/rezepte/123')).toBe(true);
    expect(isSafeExternalUrl('http://herrbuettner.de/rezept')).toBe(true);
    expect(isSafeExternalUrl('https://8.8.8.8/seite')).toBe(true);
  });
});

describe('isSafeExternalUrl — blockierte Ziele', () => {
  it('blockt Nicht-HTTP-Protokolle', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('ftp://example.ch')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('nicht-mal-eine-url')).toBe(false);
  });

  it('blockt localhost in allen Schreibweisen', () => {
    expect(isSafeExternalUrl('http://localhost/x')).toBe(false);
    expect(isSafeExternalUrl('http://localhost:3000/x')).toBe(false);
    expect(isSafeExternalUrl('http://127.0.0.1/x')).toBe(false);
    expect(isSafeExternalUrl('http://[::1]/x')).toBe(false);
  });

  it('blockt das GESAMTE Loopback-Netz, nicht nur 127.0.0.1', () => {
    // 127.0.0.2 war vorher erlaubt
    expect(isSafeExternalUrl('http://127.0.0.2/x')).toBe(false);
    expect(isSafeExternalUrl('http://127.99.88.77/x')).toBe(false);
  });

  it('blockt Cloud-Metadata', () => {
    expect(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeExternalUrl('http://metadata.google.internal/x')).toBe(false);
  });

  it('blockt private IPv4-Netze', () => {
    expect(isSafeExternalUrl('http://10.0.0.5/x')).toBe(false);
    expect(isSafeExternalUrl('http://172.16.0.1/x')).toBe(false);
    expect(isSafeExternalUrl('http://172.31.255.254/x')).toBe(false);
    expect(isSafeExternalUrl('http://192.168.1.1/x')).toBe(false);
    expect(isSafeExternalUrl('http://0.0.0.0/x')).toBe(false);
  });

  it('blockt IPv4 in Dezimalnotation', () => {
    // 2130706433 === 127.0.0.1, 2852039166 === 169.254.169.254
    expect(isSafeExternalUrl('http://2130706433/x')).toBe(false);
    expect(isSafeExternalUrl('http://2852039166/x')).toBe(false);
  });

  it('blockt IPv4-mapped IPv6', () => {
    expect(isSafeExternalUrl('http://[::ffff:127.0.0.1]/x')).toBe(false);
    expect(isSafeExternalUrl('http://[::ffff:169.254.169.254]/x')).toBe(false);
  });

  it('blockt private IPv6-Bereiche', () => {
    expect(isSafeExternalUrl('http://[fc00::1]/x')).toBe(false);
    expect(isSafeExternalUrl('http://[fd12:3456::1]/x')).toBe(false);
    expect(isSafeExternalUrl('http://[fe80::1]/x')).toBe(false);
  });

  it('blockt interne Hostnamen', () => {
    expect(isSafeExternalUrl('http://server.local/x')).toBe(false);
    expect(isSafeExternalUrl('http://db.internal/x')).toBe(false);
    expect(isSafeExternalUrl('http://foo.localhost/x')).toBe(false);
  });
});

describe('fetchExternalHtml — Redirect-Kette', () => {
  /**
   * Der praktisch relevante Bypass: die Start-URL ist erlaubt, leitet aber auf
   * ein internes Ziel weiter. `fetch` folgt Redirects sonst automatisch, womit
   * die Pruefung der Start-URL wirkungslos waere.
   */
  it('blockt eine Weiterleitung auf den Metadata-Endpunkt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    })));

    await expect(fetchExternalHtml('https://harmlos.example.ch/rezept'))
      .rejects.toThrow('Weiterleitung auf nicht erlaubtes Ziel.');
  });

  it('folgt einer Weiterleitung auf ein erlaubtes Ziel', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) {
        return new Response(null, { status: 301, headers: { location: 'https://example.ch/final' } });
      }
      return new Response('<html>Rezept</html>', { status: 200 });
    }));

    await expect(fetchExternalHtml('https://example.ch/start')).resolves.toContain('Rezept');
  });

  it('bricht bei einer Weiterleitungsschleife ab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://example.ch/loop' },
    })));

    await expect(fetchExternalHtml('https://example.ch/loop'))
      .rejects.toThrow('Zu viele Weiterleitungen.');
  });

  it('loest relative Weiterleitungen gegen die aktuelle URL auf', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seen.push(url);
      if (seen.length === 1) {
        return new Response(null, { status: 302, headers: { location: '/rezept/final' } });
      }
      return new Response('<html>ok</html>', { status: 200 });
    }));

    await fetchExternalHtml('https://example.ch/start');
    expect(seen[1]).toBe('https://example.ch/rezept/final');
  });
});
