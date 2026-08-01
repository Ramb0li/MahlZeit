/**
 * Rate-Limiting — dieselbe Dual-Mode-Logik wie der Rest der Datenschicht:
 * - Produktion (Upstash Redis): INCR + EXPIRE bzw. SET NX, damit das Limit über
 *   alle Serverless-Instanzen hinweg gilt.
 * - Lokal (kein Redis): In-Memory-Maps. Reicht für die Entwicklung; nach einem
 *   Neustart des Dev-Servers sind die Zähler weg.
 *
 * Die Logik lag vorher dupliziert in auth/forgot-password und
 * auth/resend-confirmation. Hier gebündelt, damit login, register und
 * recipes/import dieselbe Bremse nutzen können.
 */

const USE_REDIS = () => !!process.env.UPSTASH_REDIS_REST_URL;

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

// ─── Lokale Fallback-Speicher ────────────────────────────────────────────────

const localCounters = new Map<string, { count: number; resetAt: number }>();
const localOnce     = new Map<string, number>();

/** Verhindert unbegrenztes Wachstum der Maps im lang laufenden Dev-Server. */
function pruneLocal(now: number): void {
  // forEach statt for..of — der tsconfig-Target erlaubt keine Map-Iteration.
  if (localCounters.size > 5_000) {
    const stale: string[] = [];
    localCounters.forEach((v, k) => { if (v.resetAt <= now) stale.push(k); });
    stale.forEach((k) => localCounters.delete(k));
  }
  if (localOnce.size > 5_000) {
    const stale: string[] = [];
    localOnce.forEach((expiresAt, k) => { if (expiresAt <= now) stale.push(k); });
    stale.forEach((k) => localOnce.delete(k));
  }
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Fixed-Window-Zähler: erlaubt `max` Aufrufe pro `windowSecs` je `scope`+`id`.
 * Gibt true zurück, wenn die Anfrage durchgelassen wird.
 */
export async function allowN(
  scope: string,
  id: string,
  max: number,
  windowSecs: number,
): Promise<boolean> {
  const key = `mz:ratelimit:${scope}:${id}`;

  if (!USE_REDIS()) {
    const now = Date.now();
    pruneLocal(now);
    const entry = localCounters.get(key);
    if (!entry || entry.resetAt <= now) {
      localCounters.set(key, { count: 1, resetAt: now + windowSecs * 1000 });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  }

  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSecs);
  return count <= max;
}

/**
 * Einmal pro Fenster: nur der erste Aufruf innerhalb `windowSecs` wird erlaubt.
 * Für Aktionen, die eine E-Mail auslösen (Bestätigung erneut senden, Passwort
 * zurücksetzen), wo ein Zähler > 1 keinen Sinn ergäbe.
 */
export async function allowOnce(
  scope: string,
  id: string,
  windowSecs: number,
): Promise<boolean> {
  const key = `mz:ratelimit:${scope}:${id}`;

  if (!USE_REDIS()) {
    const now = Date.now();
    pruneLocal(now);
    const expiresAt = localOnce.get(key) ?? 0;
    if (expiresAt > now) return false;
    localOnce.set(key, now + windowSecs * 1000);
    return true;
  }

  // SET NX gibt null zurück, wenn der Key bereits existiert.
  const result = await getRedis().set(key, '1', { ex: windowSecs, nx: true });
  return result !== null;
}

/**
 * Wie `allowOnce`, gibt aber zusätzlich die Restzeit zurück — für Meldungen der
 * Art "Bitte warte noch X Sekunden".
 */
export async function allowOnceWithRetry(
  scope: string,
  id: string,
  windowSecs: number,
): Promise<{ allowed: boolean; retryAfterSecs: number }> {
  const key = `mz:ratelimit:${scope}:${id}`;

  if (!USE_REDIS()) {
    const now = Date.now();
    pruneLocal(now);
    const expiresAt = localOnce.get(key) ?? 0;
    if (expiresAt > now) {
      return { allowed: false, retryAfterSecs: Math.ceil((expiresAt - now) / 1000) };
    }
    localOnce.set(key, now + windowSecs * 1000);
    return { allowed: true, retryAfterSecs: 0 };
  }

  const redis  = getRedis();
  const result = await redis.set(key, '1', { ex: windowSecs, nx: true });
  if (result !== null) return { allowed: true, retryAfterSecs: 0 };

  const ttl = await redis.ttl(key);
  return { allowed: false, retryAfterSecs: ttl > 0 ? ttl : windowSecs };
}

/**
 * Client-IP aus dem Proxy-Header. Auf Vercel ist x-forwarded-for gesetzt; der
 * erste Eintrag ist die ursprüngliche Client-Adresse.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Nur für Tests: setzt die lokalen Zähler zurück. */
export function __resetLocalRateLimits(): void {
  localCounters.clear();
  localOnce.clear();
}
