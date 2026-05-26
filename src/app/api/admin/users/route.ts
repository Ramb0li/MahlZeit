export const dynamic = 'force-dynamic';

import { NextResponse }                from 'next/server';
import { getSession, ADMIN_EMAIL }     from '@/lib/auth';
import { getAllUsers, updateUser, deleteUser } from '@/lib/users';

/** Guard: only the admin may call these routes. */
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const users = await getAllUsers();
  // Never return password hashes to the client
  const safe  = users.map(({ passwordHash: _pw, ...u }) => u);
  return NextResponse.json(safe);
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const body = await request.json() as {
    email:    string;
    status?:  'active' | 'inactive';
    plan?:    'trial' | 'lifetime' | 'abo';
  };
  const users = await getAllUsers();
  const user  = users.find((u) => u.email === body.email);
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 });
  const updated = {
    ...user,
    ...(body.status ? { status: body.status } : {}),
    ...(body.plan   ? { plan:   body.plan   } : {}),
    // Lifetime hat keinen accessUntil — wenn auf lifetime gewechselt wird, entfernen
    ...(body.plan === 'lifetime' ? { accessUntil: undefined } : {}),
  };
  await updateUser(updated);
  return NextResponse.json({ ok: true, user: updated });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const { email } = await request.json() as { email: string };
  await deleteUser(email);
  return NextResponse.json({ ok: true });
}
