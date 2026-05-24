/**
 * User data layer — same dual-mode pattern as data.ts:
 * - Local dev (no Redis): reads/writes data/users.json
 * - Production (Vercel):  reads/writes Upstash Redis
 */

export type PlanType   = 'trial' | 'lifetime' | 'abo';
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
  await getRedis().set(K.user(user.email), user);
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
