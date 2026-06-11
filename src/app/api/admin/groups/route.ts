export const dynamic = 'force-dynamic';

import { NextResponse }                from 'next/server';
import { getSession, ADMIN_EMAIL }     from '@/lib/auth';
import { getGroupById, deleteGroup }   from '@/lib/groups';
import { getUsersByGroup, deleteUser } from '@/lib/users';
import { purgeGroupData }              from '@/lib/data';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

/** DELETE — Gruppe endgültig löschen (inkl. aller Daten und Mitglieder-Konten). */
export async function DELETE(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { groupId } = await request.json() as { groupId?: string };
  if (!groupId)
    return NextResponse.json({ error: 'groupId erforderlich.' }, { status: 400 });

  const group = await getGroupById(groupId);
  if (!group)
    return NextResponse.json({ error: 'Gruppe nicht gefunden.' }, { status: 404 });

  const members = await getUsersByGroup(groupId);
  for (const m of members) {
    await deleteUser(m.email);
  }
  await purgeGroupData(groupId);
  await deleteGroup(groupId);

  return NextResponse.json({ ok: true, deletedMembers: members.length });
}
