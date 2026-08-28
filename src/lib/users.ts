/**
 * User data layer — same dual-mode pattern as data.ts:
 * - Local dev (no Redis): reads/writes data/users.json
 * - Production (Vercel):  reads/writes Upstash Redis
 */

export type PlanType   = 'trial' | 'lifetime' | 'abo' | 'yearly' | 'beta';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface AppUser {
  id:                   string;
  firstName:            string;
  lastName:             string;
  email:                string;
  passwordHash:         string;
  plan:                 PlanType;
  status:               UserStatus;
  registeredAt:         string;          // ISO date
  stripeCustomerId?:    string;
  stripeSubscriptionId?: string;
  accessUntil?:         string;          // ISO date – for trial / abo
  confirmationToken?:           string;  // Doppelt-Opt-In: Token aus crypto.randomBytes(32)
  confirmationTokenExpiresAt?:  string;  // ISO date – Token ist 24h gültig
  /**
   * True, sobald der User sein Passwort selbst gesetzt hat.
   * Im Stripe-first-Flow wird der User zunächst mit einem Zufalls-Hash angelegt,
   * den niemand kennt — dieses Flag unterscheidet das zuverlässig von einem
   * echten Passwort. (Vorher wurde am Hash-Präfix geraten, was nie zutraf.)
   */
  passwordSet?:                 boolean;
  groupId?:                     string;  // Familie/Haushalt (siehe groups.ts)
  groupRole?:                   'owner' | 'member';  // Rolle innerhalb der Gruppe
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const USE_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

const K = {
  userIndex: 'mz:users:all',           // JSON array of emails
  user: (email: string) => `mz:user:${email.toLowerCase()}`,
};

// ─── local JSON fallback ───────────────────────────────────────────────────────

function usersFilePath(): string {
  const path = require('path') as typeof import('path');
  return path.join(process.cwd(), 'data', 'users.json');
}

function readUsersLocal(): AppUser[] {
  const fs   = require('fs')   as typeof import('fs');
  const file = usersFilePath();
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function writeUsersLocal(users: AppUser[]): void {
  const fs = require('fs') as typeof import('fs');
  fs.writeFileSync(usersFilePath(), JSON.stringify(users, null, 2), 'utf-8');
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AppUser[]> {
  if (!USE_REDIS) return readUsersLocal();
  const redis  = getRedis();
  const emails = (await redis.get<string[]>(K.userIndex)) ?? [];
  if (!emails.length) return [];
  const users = await Promise.all(emails.map((e) => redis.get<AppUser>(K.user(e))));
  return users.filter(Boolean) as AppUser[];
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  if (!USE_REDIS) {
    const all = readUsersLocal();
    return all.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  return getRedis().get<AppUser>(K.user(email));
}

export async function createUser(user: AppUser): Promise<void> {
  if (!USE_REDIS) {
    const all = readUsersLocal();
    all.push(user);
    writeUsersLocal(all);
    return;
  }
  const redis  = getRedis();
  const emails = (await redis.get<string[]>(K.userIndex)) ?? [];
  emails.push(user.email.toLowerCase());
  await Promise.all([
    redis.set(K.userIndex, emails),
    redis.set(K.user(user.email), user),
  ]);
}

export async function updateUser(user: AppUser): Promise<void> {
  if (!USE_REDIS) {
    const all = readUsersLocal();
    const idx = all.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
    if (idx !== -1) all[idx] = user;
    else all.push(user);
    writeUsersLocal(all);
    return;
  }
  const redis = getRedis();
  // Defensiv: User immer in den Global-Index aufnehmen (idempotent).
  // Heilt automatisch Sessions wo der Index nach Tabula Rasa o.Ä. inkonsistent ist.
  const emails = (await redis.get<string[]>(K.userIndex)) ?? [];
  const lowerEmail = user.email.toLowerCase();
  const alreadyIndexed = emails.some(e => e.toLowerCase() === lowerEmail);
  await Promise.all([
    redis.set(K.user(user.email), user),
    alreadyIndexed ? Promise.resolve() : redis.set(K.userIndex, [...emails, lowerEmail]),
  ]);
}

// ─── Confirmation Token Index (Fix #11) ──────────────────────────────────────
// In production: a dedicated Redis key per token avoids O(n) scan over all users.
// In local dev:  linear scan over users.json (fine for development).

const TOKEN_INDEX_TTL_SECS = 26 * 60 * 60; // 26h — outlives the 24h token TTL

export async function setConfirmationTokenIndex(token: string, email: string): Promise<void> {
  if (!USE_REDIS) return; // local dev: linear scan is fine
  await getRedis().set(`mz:confirm:${token}`, email.toLowerCase(), { ex: TOKEN_INDEX_TTL_SECS });
}

export async function deleteConfirmationTokenIndex(token: string): Promise<void> {
  if (!USE_REDIS) return;
  await getRedis().del(`mz:confirm:${token}`);
}

export async function getUserByConfirmationToken(token: string): Promise<AppUser | null> {
  if (!USE_REDIS) {
    // Local dev: O(n) scan — acceptable for <100 users in dev
    const all = await getAllUsers();
    return all.find(u => u.confirmationToken === token) ?? null;
  }
  // Production: O(1) lookup via token index key
  const email = await getRedis().get<string>(`mz:confirm:${token}`);
  if (!email) return null;
  return getUserByEmail(email);
}

export async function getUsersByGroup(groupId: string): Promise<AppUser[]> {
  const all = await getAllUsers();
  return all.filter(u => u.groupId === groupId);
}

// ─── Access State (Freemium-Sperre) ──────────────────────────────────────────
// locked = Trial abgelaufen ODER Gruppe verwaist, und kein eigenes aktives
// Bezahl-Abo. Gesperrte User können sich einloggen, aber Menüvorschlag,
// Template-Rezepte und KI-Import sind blockiert (Client-UI + Server-Routen).

export interface AccessState {
  locked: boolean;
  reason: 'trial-expired' | 'group-orphaned' | null;
}

/**
 * True, wenn der User noch ein Passwort setzen muss — Stripe-first-Flow:
 * das Konto wurde bei der Bezahlung mit einem Zufalls-Hash angelegt, den
 * niemand kennt, und wartet auf die Setup-Mail.
 *
 * Wichtig: NICHT am Hash-Präfix erkennbar. Der Platzhalter aus
 * /api/auth/register ist ein echter bcrypt-Hash und beginnt damit ebenfalls
 * mit '$2' — die frühere Prüfung `!passwordHash.startsWith('$2')` war deshalb
 * immer false, die Setup-Mail wurde nie verschickt und zahlende Kunden waren
 * nach Ablauf des Session-Cookies ausgesperrt.
 */
export function needsPasswordSetup(u: Pick<AppUser, 'status' | 'passwordSet'>): boolean {
  return u.status === 'pending' && u.passwordSet !== true;
}

export function isPremiumActive(u: AppUser): boolean {
  return u.status === 'active' &&
    (u.plan === 'lifetime' || u.plan === 'abo' || u.plan === 'yearly' || u.plan === 'beta');
}

export function isTrialExpired(u: AppUser): boolean {
  return u.plan === 'trial' && !!u.accessUntil && new Date(u.accessUntil) < new Date();
}

/**
 * Entscheidet den Zugriff aus bereits geladenen Datensaetzen.
 *
 * Als reine Funktion herausgezogen, damit die Regel ohne Redis pruefbar ist —
 * getAccessState() daneben besorgt nur noch die Daten.
 *
 * Die Vererbung an Mitglieder war unvollstaendig: sie deckte den Owner mit
 * Premium und den Owner mit abgelaufenem Trial ab, aber nicht den Owner in einem
 * LAUFENDEN Trial. In dem Fall fiel die Pruefung auf den eigenen Trial des
 * Mitglieds zurueck. Wer der Familie spaeter beitrat und dessen eigener Trial
 * schon abgelaufen war, wurde gesperrt, waehrend der Owner weiterarbeiten konnte.
 * Jetzt gilt: gibt es einen Owner, entscheidet ausschliesslich dieser.
 */
export function resolveAccessState(
  user: AppUser | null,
  group: { orphaned?: boolean; ownerEmail: string } | null,
  owner: AppUser | null,
): AccessState {
  if (!user) return { locked: true, reason: null };
  if (isPremiumActive(user)) return { locked: false, reason: null };

  if (group?.orphaned) return { locked: true, reason: 'group-orphaned' };

  const istFremderOwner = !!group
    && user.groupRole === 'member'
    && group.ownerEmail.toLowerCase() !== user.email.toLowerCase();

  if (istFremderOwner && owner) {
    if (isPremiumActive(owner)) return { locked: false, reason: null };
    if (isTrialExpired(owner))  return { locked: true,  reason: 'trial-expired' };
    // Owner in einem laufenden Trial — das Mitglied erbt diesen Zugriff.
    return { locked: false, reason: null };
  }

  if (isTrialExpired(user)) return { locked: true, reason: 'trial-expired' };
  return { locked: false, reason: null };
}

export async function getAccessState(email: string): Promise<AccessState> {
  const user = await getUserByEmail(email);
  if (!user) return { locked: true, reason: null };
  if (isPremiumActive(user)) return { locked: false, reason: null };

  if (!user.groupId) return resolveAccessState(user, null, null);

  const { getGroupById } = await import('@/lib/groups');
  const group = (await getGroupById(user.groupId)) ?? null;
  const brauchtOwner = !!group
    && user.groupRole === 'member'
    && group.ownerEmail.toLowerCase() !== user.email.toLowerCase();
  const owner = brauchtOwner ? await getUserByEmail(group.ownerEmail) : null;

  return resolveAccessState(user, group, owner);
}

/**
 * Verwaiste Gruppe wiederbeleben: Schliesst ein Mitglied einer verwaisten Gruppe
 * ein Abo ab, wird es neuer Owner und die Orphaned-Markierung wird entfernt.
 * Gibt den (ggf. aktualisierten) User zurück.
 */
export async function reviveOrphanedGroup(user: AppUser): Promise<AppUser> {
  if (!user.groupId) return user;
  const { getGroupById, updateGroup } = await import('@/lib/groups');
  const group = await getGroupById(user.groupId);
  if (!group?.orphaned) return user;

  const { orphaned, orphanedAt, formerOwnerEmail, ...rest } = group;
  await updateGroup({ ...rest, ownerEmail: user.email });

  const updated: AppUser = { ...user, groupRole: 'owner' };
  await updateUser(updated);
  return updated;
}

export async function deleteUser(email: string): Promise<void> {
  if (!USE_REDIS) {
    const all = readUsersLocal().filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    writeUsersLocal(all);
    return;
  }
  const redis  = getRedis();
  const emails = ((await redis.get<string[]>(K.userIndex)) ?? [])
    .filter((e) => e.toLowerCase() !== email.toLowerCase());
  await Promise.all([
    redis.set(K.userIndex, emails),
    redis.del(K.user(email)),
  ]);
}
