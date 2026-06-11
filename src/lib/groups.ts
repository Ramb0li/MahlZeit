/**
 * Group ("Familie") storage. Each user belongs to exactly one group.
 *
 * Roles:
 *   - owner  → der zahlende User. Darf umbenennen, einladen, Mitglieder entfernen.
 *   - member → eingeladenes Familienmitglied. Gleiche Daten-Rechte, aber keine
 *              Verwaltungs-Befugnisse (kein Rename, keine Invites).
 *
 * Storage (analog zu users.ts):
 *  - Local dev:  data/groups.json
 *  - Production: Upstash Redis (mz:groups:all + mz:group:<id>)
 */

export type GroupRole = 'owner' | 'member';

export interface Group {
  id:         string;
  name:       string;       // initial: "Meine Familie" (Platzhalter)
  nameSet:    boolean;      // false bis User beim First-Login Namen setzt
  ownerEmail: string;       // Owner = zahlender User
  createdAt:  string;       // ISO date
  // Verwaist: Owner hat sein Konto gelöscht. Daten bleiben 30 Tage erhalten;
  // schliesst ein Mitglied ein Abo ab, wird es neuer Owner und die Felder werden entfernt.
  orphaned?:         boolean;
  orphanedAt?:       string;  // ISO date — Basis für die 30-Tage-Löschfrist
  formerOwnerEmail?: string;
}

const USE_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

const K = {
  groupIndex: 'mz:groups:all',
  group: (id: string) => `mz:group:${id}`,
};

function filePath(): string {
  const path = require('path') as typeof import('path');
  return path.join(process.cwd(), 'data', 'groups.json');
}

function readLocal(): Group[] {
  const fs = require('fs') as typeof import('fs');
  const file = filePath();
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function writeLocal(groups: Group[]): void {
  const fs = require('fs') as typeof import('fs');
  fs.writeFileSync(filePath(), JSON.stringify(groups, null, 2), 'utf-8');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function newGroupId(): string {
  return `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function getGroupById(id: string): Promise<Group | null> {
  if (!USE_REDIS) {
    return readLocal().find(g => g.id === id) ?? null;
  }
  return getRedis().get<Group>(K.group(id));
}

export async function getAllGroups(): Promise<Group[]> {
  if (!USE_REDIS) return readLocal();
  const redis = getRedis();
  const ids   = (await redis.get<string[]>(K.groupIndex)) ?? [];
  if (!ids.length) return [];
  const all = await Promise.all(ids.map(id => redis.get<Group>(K.group(id))));
  return all.filter(Boolean) as Group[];
}

export async function createGroup(group: Group): Promise<void> {
  if (!USE_REDIS) {
    const all = readLocal();
    all.push(group);
    writeLocal(all);
    return;
  }
  const redis = getRedis();
  const ids   = (await redis.get<string[]>(K.groupIndex)) ?? [];
  ids.push(group.id);
  await Promise.all([
    redis.set(K.groupIndex, ids),
    redis.set(K.group(group.id), group),
  ]);
}

export async function updateGroup(group: Group): Promise<void> {
  if (!USE_REDIS) {
    const all = readLocal();
    const idx = all.findIndex(g => g.id === group.id);
    if (idx !== -1) all[idx] = group;
    else all.push(group);
    writeLocal(all);
    return;
  }
  await getRedis().set(K.group(group.id), group);
}

export async function deleteGroup(id: string): Promise<void> {
  if (!USE_REDIS) {
    const all = readLocal().filter(g => g.id !== id);
    writeLocal(all);
    return;
  }
  const redis = getRedis();
  const ids   = ((await redis.get<string[]>(K.groupIndex)) ?? []).filter(x => x !== id);
  await Promise.all([
    redis.set(K.groupIndex, ids),
    redis.del(K.group(id)),
  ]);
}
