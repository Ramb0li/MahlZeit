import { describe, it, expect, beforeEach } from 'vitest';
import { allowN, allowOnce, allowOnceWithRetry, clientIp, __resetLocalRateLimits } from '../rateLimit';

// Ohne UPSTASH_REDIS_REST_URL laeuft der In-Memory-Pfad — genau der, den die
// lokale Entwicklung nutzt. Die Redis-Variante teilt sich dieselbe Semantik.
beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  __resetLocalRateLimits();
});

describe('allowN', () => {
  it('laesst genau max Aufrufe durch und blockt danach', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await allowN('test', 'ip-1', 3, 60)).toBe(true);
    }
    expect(await allowN('test', 'ip-1', 3, 60)).toBe(false);
  });

  it('zaehlt pro id getrennt', async () => {
    expect(await allowN('test', 'ip-a', 1, 60)).toBe(true);
    expect(await allowN('test', 'ip-a', 1, 60)).toBe(false);
    expect(await allowN('test', 'ip-b', 1, 60)).toBe(true);
  });

  it('zaehlt pro scope getrennt', async () => {
    expect(await allowN('login', 'x', 1, 60)).toBe(true);
    expect(await allowN('login', 'x', 1, 60)).toBe(false);
    expect(await allowN('register', 'x', 1, 60)).toBe(true);
  });

  it('gibt nach Ablauf des Fensters wieder frei', async () => {
    expect(await allowN('test', 'ip-1', 1, 0)).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(await allowN('test', 'ip-1', 1, 0)).toBe(true);
  });
});

describe('allowOnce', () => {
  it('erlaubt nur den ersten Aufruf im Fenster', async () => {
    expect(await allowOnce('confirm', 'a@b.ch', 60)).toBe(true);
    expect(await allowOnce('confirm', 'a@b.ch', 60)).toBe(false);
  });
});

describe('allowOnceWithRetry', () => {
  it('liefert beim zweiten Aufruf eine Restzeit', async () => {
    const first = await allowOnceWithRetry('confirm', 'c@d.ch', 60);
    expect(first.allowed).toBe(true);

    const second = await allowOnceWithRetry('confirm', 'c@d.ch', 60);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSecs).toBeGreaterThan(0);
    expect(second.retryAfterSecs).toBeLessThanOrEqual(60);
  });
});

describe('clientIp', () => {
  it('nimmt den ersten Eintrag aus x-forwarded-for', () => {
    const req = new Request('https://example.ch', {
      headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
    });
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('faellt auf "unknown" zurueck wenn kein Header da ist', () => {
    expect(clientIp(new Request('https://example.ch'))).toBe('unknown');
  });
});
