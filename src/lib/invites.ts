/**
 * Gruppen-Einladungen.
 * Wenn ein Owner ein Mitglied einlädt, wird hier ein Pending-Invite erstellt
 * und eine E-Mail mit Accept-Link versendet. Akzeptiert die Person den Link,
 * setzt sie Vorname/Nachname/Passwort, wird zum User in der Gruppe und der
 * Invite-Eintrag wird gelöscht.
 */

export interface PendingInvite {
  id:         string;
  groupId:    string;
  email:      string;       // Email der eingeladenen Person
  invitedBy:  string;       // Email des Owners
  token:      string;       // 32-byte hex
  expiresAt:  string;       // ISO date, +7 Tage
  createdAt:  string;
}

const USE_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;

function getRedis() {
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv();
}

const K = {
  invitesIndex: 'mz:invites:all',
  invite:       (id: string) => `mz:invite:${id}`,
};

function filePath(): string {
  const path = require('path') as typeof import('path');
  return path.join(process.cwd(), 'data', 'invites.json');
}

function readLocal(): PendingInvite[] {
  const fs = require('fs') as typeof import('fs');
  const file = filePath();
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function writeLocal(invites: PendingInvite[]): void {
  const fs = require('fs') as typeof import('fs');
  fs.writeFileSync(filePath(), JSON.stringify(invites, null, 2), 'utf-8');
}

export async function getAllInvites(): Promise<PendingInvite[]> {
  if (!USE_REDIS) return readLocal();
  const redis = getRedis();
  const ids   = (await redis.get<string[]>(K.invitesIndex)) ?? [];
  if (!ids.length) return [];
  const all = await Promise.all(ids.map(id => redis.get<PendingInvite>(K.invite(id))));
  return all.filter(Boolean) as PendingInvite[];
}

export async function getInvitesByGroup(groupId: string): Promise<PendingInvite[]> {
  const all = await getAllInvites();
  return all.filter(i => i.groupId === groupId);
}

export async function getInviteByToken(token: string): Promise<PendingInvite | null> {
  const all = await getAllInvites();
  return all.find(i => i.token === token) ?? null;
}

export async function createInvite(invite: PendingInvite): Promise<void> {
  if (!USE_REDIS) {
    const all = readLocal();
    all.push(invite);
    writeLocal(all);
    return;
  }
  const redis = getRedis();
  const ids   = (await redis.get<string[]>(K.invitesIndex)) ?? [];
  ids.push(invite.id);
  await Promise.all([
    redis.set(K.invitesIndex, ids),
    redis.set(K.invite(invite.id), invite),
  ]);
}

export async function deleteInvite(id: string): Promise<void> {
  if (!USE_REDIS) {
    writeLocal(readLocal().filter(i => i.id !== id));
    return;
  }
  const redis = getRedis();
  const ids   = ((await redis.get<string[]>(K.invitesIndex)) ?? []).filter(x => x !== id);
  await Promise.all([
    redis.set(K.invitesIndex, ids),
    redis.del(K.invite(id)),
  ]);
}
