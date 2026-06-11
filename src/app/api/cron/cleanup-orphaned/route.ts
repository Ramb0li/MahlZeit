// Vercel Cron: löscht verwaiste Gruppen (Owner-Konto gelöscht) nach 30 Tagen,
// sofern kein Mitglied per Abo neuer Owner geworden ist.
// Schutz: Vercel sendet `Authorization: Bearer ${CRON_SECRET}` wenn CRON_SECRET gesetzt ist.
export const dynamic = 'force-dynamic';

import { NextResponse }              from 'next/server';
import { getAllGroups, deleteGroup } from '@/lib/groups';
import { getUsersByGroup, deleteUser } from '@/lib/users';
import { purgeGroupData }            from '@/lib/data';

const ORPHAN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
  }

  const now    = Date.now();
  const groups = await getAllGroups();
  const expired = groups.filter(
    g => g.orphaned && g.orphanedAt && now - new Date(g.orphanedAt).getTime() > ORPHAN_TTL_MS
  );

  const deleted: string[] = [];
  for (const group of expired) {
    try {
      const members = await getUsersByGroup(group.id);
      for (const m of members) {
        await deleteUser(m.email);
      }
      await purgeGroupData(group.id);
      await deleteGroup(group.id);
      deleted.push(group.id);
    } catch (e) {
      console.error('[cron/cleanup-orphaned] Fehler bei Gruppe', group.id, e);
    }
  }

  return NextResponse.json({ ok: true, checked: groups.length, deleted });
}
